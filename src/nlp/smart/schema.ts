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
  fromUnit,
  unitKit,
} from '../../math/index.ts';
import type { Assignment, ParseResult } from '../types.ts';

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
  return { text, assignments, unusedNumbers: [] };
}
