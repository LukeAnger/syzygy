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
import { SYSTEM_PROMPT, userPrompt } from './prompt.ts';
import { extractionToResult, parseExtraction, schemaString } from './schema.ts';

export { isSmartParseSupported, SMART_MODEL };
export type { LoadProgress };

/** Ensure the model is downloaded and ready (call on opt-in). */
export async function warmUp(onProgress?: LoadProgress): Promise<void> {
  await loadEngine(onProgress);
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
    SYSTEM_PROMPT,
    userPrompt(text, system),
    schemaString(),
  );
  const extraction = parseExtraction(json, system);
  if (!extraction) return null;
  return extractionToResult(extraction, text);
}
