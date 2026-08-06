/**
 * Picks the worked examples a prompt should carry, per problem.
 *
 * The model's dominant failure was copying values out of its examples — `v0=20`
 * from a fixed example, then `t=3.5` once the example values changed. Prompt
 * wording never stopped it, and `dropUngrounded` had to catch it downstream.
 *
 * Retrieval turns that behaviour from a bug into the mechanism. If a small
 * model is going to imitate its examples, the examples should be problems that
 * look like the one in front of it, already solved correctly. Six fixed cases
 * cannot resemble every input; the nearest three out of hundreds usually can.
 *
 * Pure and synchronous — the bank is passed in, so this is testable without a
 * GPU, a network, or the 175 KB artifact.
 */
import { defaultTokenizer } from '../tokenizer.ts';

export interface Example {
  readonly text: string;
  /** The extraction the model should produce, in its own output shape. */
  readonly extraction: Record<string, number | string | null>;
}

/**
 * Terms for similarity, with every number collapsed to `#`.
 *
 * Number-blind on purpose: "dropped from 45 m" and "dropped from 120 m" are the
 * same problem for retrieval purposes, and matching on digits would surface
 * examples that merely share a magnitude. Units survive, since metric and
 * imperial problems genuinely want different examples.
 *
 * Bigrams as well as single words — phrasing is what we are matching, and
 * "allowed to fall" is only distinctive as a sequence.
 */
export function terms(text: string): string[] {
  const words = defaultTokenizer
    .tokenize(text)
    .map((token) => (token.kind === 'number' ? '#' : token.text));
  const bigrams = words.slice(0, -1).map((word, i) => `${word} ${words[i + 1]}`);
  return [...words, ...bigrams];
}

/** Inverse document frequency over the bank, so common words count for little. */
export function buildIdf(bank: readonly Example[]): Map<string, number> {
  const documents = new Map<string, number>();
  for (const example of bank) {
    for (const term of new Set(terms(example.text))) {
      documents.set(term, (documents.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const [term, count] of documents) {
    idf.set(term, Math.log(1 + bank.length / (1 + count)));
  }
  return idf;
}

/** IDF-weighted cosine over term sets. */
function similarity(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
  idf: Map<string, number>,
): number {
  const weight = (term: string) => idf.get(term) ?? Math.log(2);
  let shared = 0;
  for (const term of a) if (b.has(term)) shared += weight(term) ** 2;
  if (shared === 0) return 0;
  let normA = 0;
  for (const term of a) normA += weight(term) ** 2;
  let normB = 0;
  for (const term of b) normB += weight(term) ** 2;
  return shared / Math.sqrt(normA * normB);
}

/**
 * The `count` closest examples to `text`.
 *
 * Plain top-K. An earlier version penalised picks that resembled each other, on
 * the theory that near-duplicates waste prompt slots — but that optimises
 * against the goal. When the bank holds two examples phrased like the problem,
 * showing both is the desired outcome; trading one away for variety hands the
 * model something less like the input, which is the failure being fixed.
 *
 * Safe because `build-examples.mjs` already deduplicates by phrasing
 * combination, so the bank has no literal repeats to return.
 */
export function selectExamples(
  text: string,
  bank: readonly Example[],
  count = 4,
  idf: Map<string, number> = buildIdf(bank),
): Example[] {
  if (bank.length === 0 || count <= 0) return [];
  const query = new Set(terms(text));
  const ranked = bank
    .map((example, i) => ({ i, score: similarity(query, new Set(terms(example.text)), idf) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, Math.min(count, bank.length));

  // Most relevant last: it sits closest to the problem the model is about to
  // read, which is the position a small model weights most heavily.
  return ranked.reverse().map(({ i }) => bank[i]!);
}
