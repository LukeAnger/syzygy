/**
 * Thin wrapper around WebLLM. Everything here needs a GPU at runtime, so it is
 * kept minimal and is NOT unit-tested (the testable logic lives in schema.ts).
 * `@mlc-ai/web-llm` is imported dynamically so it — and nothing about it — lands
 * in the base bundle; the ~14 MB runtime and the model weights load only when a
 * user opts into smart parse.
 */
import type { MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';

/**
 * Smallest model we'd trust for this extraction task. SmolLM2-135M is smaller
 * but too weak for the compositional cases; 0.5B / 1B are more robust. One line
 * to swap.
 */
export const SMART_MODEL = {
  id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
  label: 'SmolLM2 360M',
  approxMB: 380,
};

export type LoadProgress = (fraction: number, text: string) => void;

let enginePromise: Promise<MLCEngine> | null = null;

/** WebGPU is required; absent on many mobile/older browsers. */
export function isSmartParseSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/** Load (once) and cache the WebLLM engine, reporting download/compile progress. */
export function loadEngine(onProgress?: LoadProgress): Promise<MLCEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const webllm = await import('@mlc-ai/web-llm');
      return webllm.CreateMLCEngine(SMART_MODEL.id, {
        initProgressCallback: (report: InitProgressReport) =>
          onProgress?.(report.progress, report.text),
      });
    })().catch((error) => {
      enginePromise = null; // allow a retry after a failure
      throw error;
    });
  }
  return enginePromise;
}

/** Run one constrained extraction, returning the raw JSON string. */
export async function generateExtraction(
  engine: MLCEngine,
  systemPrompt: string,
  userMessage: string,
  schema: string,
): Promise<string> {
  const reply = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0,
    max_tokens: 200,
    response_format: { type: 'json_object', schema },
  });
  return reply.choices[0]?.message.content ?? '';
}
