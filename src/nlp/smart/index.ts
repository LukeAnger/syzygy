/**
 * Local-LLM word-problem parser (opt-in "smart parse").
 *
 * Produces the same `ParseResult` as the rule parser, so it is a drop-in
 * upgrade of the *language understanding* only — the deterministic engine still
 * does every calculation.
 */
import type { UnitSystem } from '../../math/index.ts';
import type { ParseResult } from '../types.ts';
import {
  type LoadProgress,
  SMART_MODEL,
  generateExtraction,
  isSmartParseSupported,
  loadEngine,
} from './engine.ts';
import { SYSTEM_PROMPT, examplesBlock, userPrompt } from './prompt.ts';
import { type Example, buildIdf, selectExamples } from './retrieve.ts';
import {
  applyTextUnits,
  dropUngrounded,
  extractionToResult,
  isEmptyExtraction,
  parseExtraction,
  schemaString,
} from './schema.ts';

export { isSmartParseSupported, SMART_MODEL };
export type { LoadProgress };

/** Ensure the model is downloaded and ready (call on opt-in). */
export async function warmUp(onProgress?: LoadProgress): Promise<void> {
  await loadEngine(onProgress);
}

/** Bank plus its IDF, built once and reused for the rest of the session. */
let bank: Promise<{ examples: Example[]; idf: Map<string, number> }> | null = null;

/**
 * The examples closest to this problem.
 *
 * The bank is imported dynamically so it lands in the lazy smart-parse chunk
 * rather than the base bundle — a user who never enables smart parse should
 * never download 175 KB of worked examples. Scoring it is cheap, but the IDF
 * pass over the whole bank is not, so both are memoised.
 */
async function nearestExamples(text: string): Promise<Example[]> {
  bank ??= import('./examples.json').then((module) => {
    const examples = module.default as Example[];
    return { examples, idf: buildIdf(examples) };
  });
  const { examples, idf } = await bank;
  return selectExamples(text, examples, 4, idf);
}

/**
 * Parse a word problem with the local model. Falls back to `null` if the model
 * returns unusable output, so the caller can drop back to the rule parser.
 */
export async function smartParse(
  text: string,
  system: UnitSystem,
): Promise<ParseResult | null> {
  const engine = await loadEngine();
  const json = await generateExtraction(
    engine,
    SYSTEM_PROMPT + examplesBlock(await nearestExamples(text)),
    userPrompt(text, system),
    schemaString(),
  );
  // The model's raw JSON is the only way to tell a bad extraction apart from a
  // bad downstream transform. Dev-only; stripped from production builds.
  if (import.meta.env.DEV) console.debug('[smart parse] raw:', json);
  const extraction = parseExtraction(json, system);
  if (!extraction) return null;
  // The story's own units outrank the model's guess about them.
  const inTextUnits = applyTextUnits(extraction, text);
  // Values the problem never mentions are copied from the prompt's examples,
  // not read out of the story. Drop them; if nothing grounded survives, report
  // failure so the caller falls back to the rule parser.
  const grounded = dropUngrounded(inTextUnits, text);
  if (isEmptyExtraction(grounded)) return null;
  return extractionToResult(grounded, text);
}
