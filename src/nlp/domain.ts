/**
 * Which kind of problem this is.
 *
 * Deliberately detected rather than chosen. A domain picker asks the student to
 * classify the problem before solving it — but recognising *"this is a
 * relative-velocity question"* is part of what they are trying to learn, and
 * getting it wrong would silently hand them the wrong solver. So the app reads
 * the text, names what it found, and lets it be overridden.
 *
 * Conservative on purpose. Misclassifying is expensive — a relative-velocity
 * problem run through free-fall equations produces confident nonsense — so
 * relative velocity has to clear two independent bars, and anything short of
 * that falls back to kinematics.
 */
import { measuredNumbers } from './grammar.ts';
import { MEDIUM_CUES, isCrossing } from './grammar-2d.ts';
import { framedVelocityFacts } from './grammar-relative.ts';
import { defaultTokenizer } from './tokenizer.ts';
import { VELOCITY, dimensionsEqual } from '../math/index.ts';
import type { Token } from './types.ts';

export type DomainId = 'kinematics-1d' | 'relative-velocity' | 'relative-velocity-2d';

/**
 * Wording that only makes sense with two moving bodies, or with a frame of
 * reference that isn't the ground.
 */
const RELATIVE_CUES: ReadonlyArray<string[]> = [
  ['relative', 'to'],
  ['relative', 'velocity'],
  ['relative', 'speed'],
  ['from', 'the', 'point', 'of', 'view', 'of'],
  ['as', 'seen', 'from'],
  ['as', 'seen', 'by'],
  ['as', 'observed', 'by'],
  ['in', 'the', 'frame', 'of'],
  ['towards', 'each', 'other'],
  ['toward', 'each', 'other'],
  ['approach', 'each', 'other'],
  ['approaching', 'each', 'other'],
  ['head', 'on'],
  ['overtakes'],
  ['overtake'],
  ['catches', 'up'],
  ['catch', 'up'],
  ['gains', 'on'],
  ['pulls', 'away', 'from'],
  ['apart'],
];

function phraseAt(tokens: Token[], at: number, words: readonly string[]): boolean {
  return words.every((word, j) => {
    const token = tokens[at + j];
    return token?.kind === 'word' && token.text === word;
  });
}

/** How many numbers in the text are written with a velocity unit. */
function velocityCount(tokens: Token[]): number {
  return measuredNumbers(tokens).filter(
    (m) => m.dimension && dimensionsEqual(m.dimension, VELOCITY),
  ).length;
}

/**
 * Velocity facts, which is what the second bar is really counting.
 *
 * Usually that means two numbers with speed units. But a body's velocity can be
 * stated in words — "the ball bounces straight up" says it has none along the
 * line of travel — and a story that gives one number and one such phrase has
 * described two bodies just as completely as one giving two numbers.
 *
 * Only counted inside a named frame ("velocity of X relative to Y"), which is
 * a strong two-body signal in its own right. Loose stillness phrases are common
 * in one-object problems, and letting them count anywhere would pull free-fall
 * stories across the line for a word.
 */
function velocityFacts(tokens: Token[]): number {
  return Math.max(velocityCount(tokens), framedVelocityFacts(tokens));
}

/**
 * Two dimensions, on the same two-bar principle as the one above.
 *
 * The bars are a moving medium and a crossing, and they have to appear
 * together. Either alone is common in problems that are not planar at all:
 * "ignore wind resistance" is a stock phrase in free fall, and "walks across
 * the room" is a stock phrase in anything. Together they are close to
 * diagnostic — a current *and* something getting to the other side is a river
 * problem.
 *
 * A stated speed is required as well, because a planar problem with no speed in
 * it has nothing for this domain to do; the extra bar costs nothing and keeps
 * scene-setting prose out.
 *
 * Checked before the 1-D relative test on purpose. A river problem often says
 * "relative to the shore" too, and it would otherwise be read as motion along a
 * line — which is the confidently-wrong outcome this ordering exists to avoid.
 */
function isPlanar(tokens: Token[]): boolean {
  const medium = tokens.some((_, i) =>
    MEDIUM_CUES.some((cue) => phraseAt(tokens, i, cue)),
  );
  return isCrossing(tokens) && medium && velocityCount(tokens) >= 1;
}

/**
 * The domain a story belongs to.
 *
 * Relative velocity requires *both* a two-body cue and at least two stated
 * speeds. Either alone is not enough, and the reason is concrete: "passes a
 * marker 150 m above the shaft floor" contains a passing cue but describes one
 * object, while "leaves her hand at 20 m/s and strikes the pavement at 30 m/s"
 * states two speeds but describes one object too. Both are free fall, and
 * requiring the two signals together keeps them there.
 */
export function detectDomain(text: string): DomainId {
  const tokens = defaultTokenizer.tokenize(text);
  if (isPlanar(tokens)) return 'relative-velocity-2d';
  const hasCue = tokens.some((_, i) =>
    RELATIVE_CUES.some((cue) => phraseAt(tokens, i, cue)),
  );
  return hasCue && velocityFacts(tokens) >= 2 ? 'relative-velocity' : 'kinematics-1d';
}

/**
 * True when the text hints at a second body without meeting the bar.
 *
 * Worth surfacing rather than silently defaulting: a student whose problem was
 * classified as free fall when it is about two cars should be able to see that
 * and say otherwise.
 */
export function isAmbiguousDomain(text: string): boolean {
  const tokens = defaultTokenizer.tokenize(text);
  const hasCue = tokens.some((_, i) =>
    RELATIVE_CUES.some((cue) => phraseAt(tokens, i, cue)),
  );
  return hasCue && detectDomain(text) === 'kinematics-1d';
}
