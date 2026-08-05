/**
 * Structured-output contract for the local LLM parser.
 *
 * The model's ONLY job is to read a word problem and fill in the variable
 * slots. It never does physics — its JSON output is mapped to the same
 * `Assignment[]` the rule parser produces and handed to the deterministic
 * solver, so the LLM contributes language understanding while the math core
 * remains the sole source of correctness.
 *
 * This module is pure (no WebLLM import) so the JSON→Assignment mapping is
 * unit-testable without a GPU.
 */
import {
  type Quantity,
  type Unit,
  type UnitKit,
  type UnitSystem,
  dimensionsEqual,
  fromUnit,
  unitKit,
} from '../../math/index.ts';
import type { Assignment, ParseResult } from '../types.ts';
import { detectSystem, measuredNumbers } from '../grammar.ts';
import { defaultTokenizer } from '../tokenizer.ts';

export { detectSystem };

export const SMART_KEYS = ['x1', 'x2', 'v0', 'v', 'a', 't'] as const;
export type SmartKey = (typeof SMART_KEYS)[number];

/** Display unit each variable's value is expressed in, per unit system. */
const UNIT_FOR: Record<SmartKey, (kit: UnitKit) => Unit> = {
  x1: (kit) => kit.length,
  x2: (kit) => kit.length,
  v0: (kit) => kit.velocity,
  v: (kit) => kit.velocity,
  a: (kit) => kit.acceleration,
  t: (kit) => kit.time,
};

/** One value per slot (null when the problem doesn't state it), plus units. */
export interface SmartExtraction {
  x1: number | null;
  x2: number | null;
  v0: number | null;
  v: number | null;
  a: number | null;
  t: number | null;
  units: UnitSystem;
}

/** JSON schema handed to WebLLM to constrain generation to valid output. */
export const SMART_JSON_SCHEMA = {
  type: 'object',
  properties: {
    x1: { type: ['number', 'null'] },
    x2: { type: ['number', 'null'] },
    v0: { type: ['number', 'null'] },
    v: { type: ['number', 'null'] },
    a: { type: ['number', 'null'] },
    t: { type: ['number', 'null'] },
    units: { type: 'string', enum: ['metric', 'imperial'] },
  },
  required: ['x1', 'x2', 'v0', 'v', 'a', 't', 'units'],
  additionalProperties: false,
} as const;

export function schemaString(): string {
  return JSON.stringify(SMART_JSON_SCHEMA);
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Defensively parse a model's JSON string into an extraction, or null. */
export function parseExtraction(
  json: string,
  fallbackSystem: UnitSystem,
): SmartExtraction | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const units = obj['units'] === 'imperial' ? 'imperial' : fallbackSystem;
  return {
    x1: coerceNumber(obj['x1']),
    x2: coerceNumber(obj['x2']),
    v0: coerceNumber(obj['v0']),
    v: coerceNumber(obj['v']),
    a: coerceNumber(obj['a']),
    t: coerceNumber(obj['t']),
    units,
  };
}

/** Free-fall gravity magnitude per unit system. */
const GRAVITY: Record<UnitSystem, number> = { metric: 9.81, imperial: 32.17 };

/**
 * Magnitudes the conventions let the model supply without the problem stating
 * them: rest / ground level, and the two gravity constants.
 */
const CONVENTION_MAGNITUDES = [0, GRAVITY.metric, GRAVITY.imperial];

/**
 * Re-express the extraction in the system the story is actually written in.
 *
 * Gravity needs restating, not just relabelling. The model supplies it from a
 * convention rather than reading it off the page, so it arrives in whichever
 * system the model guessed; switching the label alone would reinterpret a
 * metric −9.81 as −9.81 ft/s² (≈ −3 m/s²). A *stated* acceleration is left
 * exactly as written — it came from the story, so the story's units already
 * apply to it.
 */
export function applyTextUnits(
  extraction: SmartExtraction,
  text: string,
): SmartExtraction {
  const units = detectSystem(text);
  if (units === null || units === extraction.units) return extraction;

  const restated = { ...extraction, units };
  if (extraction.a !== null) {
    const magnitude = Math.abs(extraction.a);
    const wasGravity = Object.values(GRAVITY).some(
      (g) => Math.abs(g - magnitude) < 1e-9,
    );
    if (wasGravity) restated.a = Math.sign(extraction.a) * GRAVITY[units];
  }
  return restated;
}

/** Every numeric literal in the problem text. */
export function numbersIn(text: string): number[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

/**
 * Drop any slot whose value is not grounded in the problem text.
 *
 * Small models copy numbers out of the few-shot examples when they cannot
 * ground a slot — swapping the example values only changes *which* number gets
 * invented, so the prompt cannot fix this on its own. Every number the model
 * emits must therefore appear in the problem, or be one of the constants a
 * convention supplies. Anything else is a fabrication and is dropped.
 *
 * Signs are compared by magnitude: "hits the ground at 26 m/s" legitimately
 * becomes v=-26, and a text search for "26" should accept it.
 *
 * Dropping is always the safe direction. A missing slot degrades to "not
 * enough information to solve"; an invented one produces a confident wrong
 * answer with a full worked solution behind it.
 */
export function dropUngrounded(
  extraction: SmartExtraction,
  text: string,
): SmartExtraction {
  const measured = measuredNumbers(defaultTokenizer.tokenize(text));
  const kit = unitKit(extraction.units);
  const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

  const filtered = { ...extraction };
  for (const key of SMART_KEYS) {
    const value = extraction[key];
    if (value === null) continue;
    const magnitude = Math.abs(value);
    if (CONVENTION_MAGNITUDES.some((c) => same(c, magnitude))) continue;

    // The number must appear in the story, and if it was written with a unit,
    // that unit must be dimensionally capable of being this slot. "30 m/s" is
    // a velocity; no claim can make it an acceleration.
    const slot = UNIT_FOR[key](kit).dimension;
    const supported = measured.some(
      (m) =>
        same(m.value, magnitude) &&
        (m.dimension === undefined || dimensionsEqual(m.dimension, slot)),
    );
    if (!supported) filtered[key] = null;
  }
  return filtered;
}

/** True when an extraction carries no usable values at all. */
export function isEmptyExtraction(extraction: SmartExtraction): boolean {
  return SMART_KEYS.every((key) => extraction[key] === null);
}

/** Map an extraction into the shared ParseResult shape. */
export function extractionToResult(
  extraction: SmartExtraction,
  text: string,
): ParseResult {
  const kit = unitKit(extraction.units);
  const assignments: Assignment[] = [];
  for (const key of SMART_KEYS) {
    const value = extraction[key];
    if (value === null) continue;
    const quantity: Quantity = fromUnit(value, UNIT_FOR[key](kit));
    assignments.push({
      variable: key,
      quantity,
      ruleId: 'smart',
      source: 'smart parse',
    });
  }
  // Numbers in the story that no slot accounted for. Reported on the same
  // terms as the rule parser's, so the two can be intersected when their
  // results are merged: a number is only truly unplaced if neither found it.
  const used = SMART_KEYS.map((key) => extraction[key])
    .filter((value): value is number => value !== null)
    .map(Math.abs);
  const unusedNumbers = numbersIn(text).filter(
    (n) => !used.some((u) => Math.abs(u - n) < 1e-9),
  );
  return { text, assignments, unusedNumbers };
}
