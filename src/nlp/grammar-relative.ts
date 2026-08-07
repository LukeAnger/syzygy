/**
 * Slot grammar for two bodies moving along a line.
 *
 * The kinematics grammar works because a phrase identifies a slot: "from a
 * height of" can only introduce x₁. Two-body problems do not work that way.
 * Both speeds are introduced identically —
 *
 *     "a motorcycle travelling at 120 km/h passes a car travelling at 90 km/h"
 *
 * — and what separates them is *order*, not wording. So the central rule here
 * reads the velocities positionally: the first belongs to the body the problem
 * is about, the second to the one it is measured against. That matches how
 * these are written, and it is why this domain needs its own rule set rather
 * than more phrases in the old one.
 *
 * Direction is the other half. A stated speed is a magnitude; whether the
 * second body's velocity is positive or negative depends on the story, and
 * "towards each other" is the phrase that decides it.
 */
import { VELOCITY, dimensionsEqual, fromUnit } from '../math/index.ts';
import type { Rule, SlotMatch, Token } from './types.ts';
import {
  LENGTH,
  METRE,
  METRE_PER_SECOND,
  SECOND,
  TIME,
} from '../math/index.ts';
import { UNITS, numberRule, phraseAt, postfixNumberRule } from './grammar.ts';

/** Wording that puts the two bodies on opposing headings. */
const OPPOSING: ReadonlyArray<string[]> = [
  ['towards', 'each', 'other'],
  ['toward', 'each', 'other'],
  ['approach', 'each', 'other'],
  ['approaching', 'each', 'other'],
  ['head', 'on'],
  ['in', 'opposite', 'directions'],
  ['opposite', 'directions'],
];

function movingApart(tokens: Token[]): boolean {
  return tokens.some((_, i) => OPPOSING.some((cue) => phraseAt(tokens, i, cue)));
}

/**
 * Constructions that name the reference frame outright.
 *
 * `... of X relative to Y` — Y is the frame, whatever order the two were
 * introduced in. This is the general case the positional rule cannot see.
 */
const FRAME_MARKERS: ReadonlyArray<string[]> = [
  ['relative', 'to'],
  ['with', 'respect', 'to'],
  ['as', 'seen', 'from'],
  ['as', 'seen', 'by'],
  ['as', 'observed', 'by'],
  ['measured', 'from'],
  ['in', 'the', 'frame', 'of'],
];

/** Function words that end a noun phrase rather than belonging to one. */
const STOP: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'then', 'of', 'to', 'at', 'in', 'on',
  'for', 'from', 'by', 'with', 'is', 'was', 'are', 'were', 'be', 'been', 'as',
  'that', 'which', 'who', 'when', 'while', 'if', 'so', 'its', 'his', 'her',
  'their', 'this', 'these', 'those', 'it', 'they',
]);

/**
 * The head noun of the noun phrase starting at `from`, scanning forwards.
 *
 * Takes the *last* word of the run rather than the first, so "the pickup truck"
 * gives "truck" and not "pickup". Determiners are skipped and the run ends at
 * the first function word, which is what keeps "the truck and then" from
 * yielding "then".
 */
function headNounAfter(tokens: Token[], from: number, window = 5): string | null {
  let head: string | null = null;
  for (let i = from; i < Math.min(tokens.length, from + window); i++) {
    const token = tokens[i];
    if (!token || token.kind !== 'word') break;
    if (STOP.has(token.text)) {
      // Determiners lead the phrase; anything else ends it.
      if (head === null) continue;
      break;
    }
    head = token.text;
  }
  return head;
}

/** The head noun of the phrase *ending* at `before`, scanning backwards. */
function headNounBefore(tokens: Token[], before: number): string | null {
  for (let i = before - 1; i >= 0; i--) {
    const token = tokens[i];
    if (!token || token.kind !== 'word') break;
    if (STOP.has(token.text)) continue;
    return token.text;
  }
  return null;
}

export interface NamedFrame {
  /** The body the question is about — body A. */
  readonly subject: string;
  /** The body it is measured against — body B, the frame. */
  readonly reference: string;
  /** Where the marker sits, for reporting the phrase back. */
  readonly at: number;
}

/**
 * "The velocity of the ball relative to the truck", read as roles.
 *
 * This is the half of the problem worth solving generally: the phrase appears
 * in most two-body questions, and it should outrank word order because it says
 * outright what order cannot. In that example the truck is mentioned first and
 * is nonetheless the *frame*, so the positional rule makes it body A and
 * returns the answer with the sign inverted.
 *
 * Returns null unless both roles are named, since half of the construction is
 * no better than none — falling through to word order beats guessing one side.
 */
export function namedFrame(tokens: Token[]): NamedFrame | null {
  for (let i = 0; i < tokens.length; i++) {
    const marker = FRAME_MARKERS.find((words) => phraseAt(tokens, i, words));
    if (!marker) continue;
    const reference = headNounAfter(tokens, i + marker.length);
    const subject = headNounBefore(tokens, i);
    if (!subject || !reference || subject === reference) continue;
    return { subject, reference, at: i };
  }
  return null;
}

/**
 * Motion described without a number, meaning "no velocity along the line".
 *
 * "Bounces straight up" is the case that matters: it says the ball has no
 * horizontal velocity relative to the ground, which is the only way the RV2
 * problem states its second value. Restricted to phrases about a body being
 * still or moving purely vertically — "dropped from rest" is deliberately not
 * here, since that is a free-fall idiom and this pack is about two bodies.
 */
const STILLNESS: ReadonlyArray<string[]> = [
  ['straight', 'up'],
  ['straight', 'upward'],
  ['straight', 'upwards'],
  ['vertically', 'upward'],
  ['at', 'rest'],
  ['stationary'],
  ['standing', 'still'],
  ['not', 'moving'],
  ['motionless'],
  ['parked'],
];

/** The body a stillness phrase is talking about, by nearest earlier mention. */
function stillBody(tokens: Token[], bodies: string[]): string | null {
  for (let i = 0; i < tokens.length; i++) {
    if (!STILLNESS.some((cue) => phraseAt(tokens, i, cue))) continue;
    for (let j = i - 1; j >= 0; j--) {
      const token = tokens[j];
      if (token?.kind === 'word' && bodies.includes(token.text)) return token.text;
    }
  }
  return null;
}

/** Every stated speed, tagged with the named body it sits closest behind. */
function attributedSpeeds(
  tokens: Token[],
  bodies: string[],
): Map<string, { index: number; value: number }> {
  const byBody = new Map<string, { index: number; value: number }>();
  tokens.forEach((token, i) => {
    if (token.kind !== 'number' || token.value === undefined) return;
    const next = tokens[i + 1];
    const unit = next?.kind === 'word' ? UNITS[next.text] : undefined;
    if (!unit || !dimensionsEqual(unit.dimension, VELOCITY)) return;
    for (let j = i - 1; j >= 0; j--) {
      const word = tokens[j];
      if (word?.kind === 'word' && bodies.includes(word.text)) {
        // First mention backwards wins, and only the first speed per body:
        // "the truck, now at 30 km/h" is a second stage, not a second body.
        if (!byBody.has(word.text)) {
          byBody.set(word.text, { index: i, value: token.value * unit.factor });
        }
        return;
      }
    }
  });
  return byBody;
}

/**
 * How many velocity facts a story states about the two named bodies.
 *
 * Detection needs two, and a stated number is not the only way to give one —
 * see `STILLNESS`. Counted here rather than in `domain.ts` so the detector and
 * the rule agree by construction about what counts.
 */
export function framedVelocityFacts(tokens: Token[]): number {
  const frame = namedFrame(tokens);
  if (!frame) return 0;
  const bodies = [frame.subject, frame.reference];
  const speeds = attributedSpeeds(tokens, bodies);
  const still = stillBody(tokens, bodies);
  return speeds.size + (still && !speeds.has(still) ? 1 : 0);
}

/**
 * Velocities assigned by the roles the question names, not by word order.
 *
 * Runs ahead of the positional rule and simply declines when the story does not
 * name a frame, which is most of them.
 */
const framedVelocities: Rule = {
  id: 'framed-velocities',
  description: 'velocity of X relative to Y — X is body A, Y is the frame',
  match(tokens) {
    const frame = namedFrame(tokens);
    if (!frame) return [];

    const bodies = [frame.subject, frame.reference];
    const speeds = attributedSpeeds(tokens, bodies);
    const still = stillBody(tokens, bodies);
    if (speeds.size === 0) return [];

    const matches: SlotMatch[] = [];
    const assign = (variable: string, body: string) => {
      const speed = speeds.get(body);
      if (speed) {
        matches.push({
          ruleId: 'framed-velocities',
          variable,
          quantity: { value: speed.value, dimension: VELOCITY },
          startToken: speed.index,
          endToken: speed.index + 1,
          source: `${body}: ${tokens
            .slice(speed.index, speed.index + 2)
            .map((t) => t.text)
            .join(' ')}`,
        });
        return;
      }
      // No number for this body, but the story said it was not moving along
      // the line. That is a value, and it is the only one RV2 ever gives.
      if (still === body) {
        matches.push({
          ruleId: 'framed-velocities',
          variable,
          quantity: { value: 0, dimension: VELOCITY },
          startToken: frame.at,
          endToken: frame.at,
          source: `${body}: no motion along the line of travel`,
        });
      }
    };

    assign('va', frame.subject);
    assign('vb', frame.reference);
    return matches;
  },
};

/**
 * The two stated speeds, in the order they appear.
 *
 * Written as a bespoke rule rather than two phrase rules because no phrase
 * distinguishes them — only position does. The sign convention follows the
 * domain: the first body sets the positive direction, so it is always `+`, and
 * the second is negative exactly when the story says they are closing head-on.
 */
const twoVelocities: Rule = {
  id: 'two-velocities',
  description: 'first stated speed is body A, second is body B',
  match(tokens) {
    const speeds: { index: number; value: number }[] = [];
    tokens.forEach((token, i) => {
      if (token.kind !== 'number' || token.value === undefined) return;
      const next = tokens[i + 1];
      const unit = next?.kind === 'word' ? UNITS[next.text] : undefined;
      if (unit && dimensionsEqual(unit.dimension, VELOCITY)) {
        speeds.push({ index: i, value: token.value * unit.factor });
      }
    });
    if (speeds.length < 2) return [];

    const opposing = movingApart(tokens);
    const [a, b] = speeds as [(typeof speeds)[0], (typeof speeds)[0]];
    const make = (
      variable: string,
      at: { index: number; value: number },
      sign: number,
    ): SlotMatch => ({
      ruleId: 'two-velocities',
      variable,
      quantity: { value: sign * Math.abs(at.value), dimension: VELOCITY },
      startToken: at.index,
      endToken: at.index + 1,
      source: tokens
        .slice(at.index, at.index + 2)
        .map((t) => t.text)
        .join(' '),
    });

    return [make('va', a, 1), make('vb', b, opposing ? -1 : 1)];
  },
};

/** How far apart they start. */
const separation: Rule[] = [
  postfixNumberRule(
    'd-postfix',
    'separation stated before its cue (N m apart / ahead)',
    [['apart'], ['ahead'], ['ahead', 'of'], ['in', 'front'], ['behind'], ['between', 'them']],
    {
      variable: 'd',
      dimension: LENGTH,
      defaultUnit: METRE,
      sign: 'positive',
      requireExplicitUnit: true,
    },
  ),
  numberRule(
    'd-prefix',
    'separation stated after its cue (separated by N m)',
    [
      ['separated', 'by'],
      ['a', 'distance', 'of'],
      ['a', 'gap', 'of'],
      ['distance', 'of'],
      ['gap', 'of'],
    ],
    {
      variable: 'd',
      dimension: LENGTH,
      defaultUnit: METRE,
      sign: 'positive',
      requireExplicitUnit: true,
    },
  ),
];

/** A stated duration, for "how far apart are they after 10 s" problems. */
const elapsed = numberRule(
  'rv-time',
  'elapsed time N',
  [['after'], ['in'], ['for'], ['takes'], ['within'], ['time', 'of']],
  { variable: 't', dimension: TIME, defaultUnit: SECOND, sign: 'positive' },
);

/**
 * A single speed, when only one is stated.
 *
 * Keeps a partially-written problem useful: the form gets `v_a` filled and the
 * student supplies the rest, rather than being handed an empty form because the
 * positional rule needed two.
 */
const soleVelocity = numberRule(
  'rv-single-velocity',
  'one stated speed, assigned to body A',
  [['at'], ['travelling', 'at'], ['traveling', 'at'], ['moving', 'at'], ['speed', 'of']],
  {
    variable: 'va',
    dimension: VELOCITY,
    defaultUnit: METRE_PER_SECOND,
    sign: 'positive',
    requireExplicitUnit: true,
  },
);

/**
 * Ordered most-specific first.
 *
 * `parse` keeps the first match per variable, so `framed-velocities` leads: a
 * question that names its frame has said something word order can only guess
 * at, and letting position answer first would invert the sign. `two-velocities`
 * then precedes `rv-single-velocity`, otherwise a two-speed problem would take
 * the first speed twice and never see the second.
 */
export const RELATIVE_RULES: Rule[] = [
  framedVelocities,
  twoVelocities,
  ...separation,
  elapsed,
  soleVelocity,
];

/** Exported for tests; `fromUnit` keeps the conversion honest elsewhere. */
export const __testing = { movingApart, fromUnit };
