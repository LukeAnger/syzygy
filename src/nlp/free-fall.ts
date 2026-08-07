/**
 * Does this story describe something moving under gravity?
 *
 * The kinematics pack used to answer "yes, always" — every story got
 * `a = −9.81` whether or not anything in it fell. That is a fabricated value,
 * and this codebase's whole position is that a missing one is better. Two ways
 * it bites:
 *
 *   - **Silently wrong answers.** "A car reaches 30 m/s in 5 s, how far does it
 *     go?" has a duration and a final speed, so gravity is enough to close the
 *     system: the app returns a confident negative displacement for a car that
 *     went forwards.
 *   - **Nonsense in the summary.** A hockey puck sliding across ice reported
 *     "Understood: a = −9.81 m/s² (free fall)" as the only thing it had read,
 *     which is worse than reporting nothing, because it looks like comprehension.
 *
 * Deliberately narrow, and deliberately *not* keyed on throwing verbs. "Thrown"
 * covers a stone lobbed off a cliff and a newspaper flung sideways from a car
 * window, and only one of those is a free-fall problem. Every cue here names
 * height, gravity, a vertical direction, or a thing you fall off — the corpus
 * report is the check that this stays wide enough, since every case in it is a
 * free-fall problem and all of them must keep their gravity.
 */
import { defaultTokenizer } from './tokenizer.ts';
import { GROUND_SURFACES } from './grammar.ts';
import type { Token } from './types.ts';

/** Single words that only turn up when something is going up or down. */
const VERTICAL_WORDS: ReadonlySet<string> = new Set([
  'drop',
  'drops',
  'dropped',
  'dropping',
  'fall',
  'falls',
  'fell',
  'fallen',
  'falling',
  'freefall',
  'gravity',
  'height',
  'high',
  'tall',
  'deep',
  'depth',
  'altitude',
  'above',
  'below',
  'overhead',
  'upward',
  'upwards',
  'downward',
  'downwards',
  'vertically',
  'vertical',
  'plummets',
  'plunges',
  'descends',
  'ascends',
  // Places you fall from. A story naming one is describing a drop even when it
  // never uses the word.
  'cliff',
  'roof',
  'rooftop',
  'balcony',
  'ledge',
  'window',
  'bridge',
  'tower',
  'scaffold',
  'shaft',
  'well',
  'chimney',
  'skyscraper',
  'helicopter',
]);

/** Phrases where the individual words are innocent but the pair is not. */
const VERTICAL_PHRASES: ReadonlyArray<string[]> = [
  ['free', 'fall'],
  ['straight', 'up'],
  ['straight', 'down'],
  ['let', 'go'],
];

function phraseAt(tokens: Token[], at: number, words: readonly string[]): boolean {
  return words.every((word, j) => {
    const token = tokens[at + j];
    return token?.kind === 'word' && token.text === word;
  });
}

/**
 * True when the story is about vertical motion, so free fall is a fair default.
 *
 * Ground surfaces count: "hits the pavement" only makes sense as an endpoint if
 * something was above it. They are shared with the landing-height rule rather
 * than re-listed, so the two cannot drift apart.
 */
export function describesFreeFall(text: string): boolean {
  const tokens = defaultTokenizer.tokenize(text);
  return tokens.some(
    (token, i) =>
      (token.kind === 'word' &&
        (VERTICAL_WORDS.has(token.text) || GROUND_SURFACES.includes(token.text))) ||
      VERTICAL_PHRASES.some((phrase) => phraseAt(tokens, i, phrase)),
  );
}
