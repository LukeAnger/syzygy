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
 * Ordered so the positional rule wins.
 *
 * `parse` keeps the first match per variable, so `two-velocities` must precede
 * `rv-single-velocity` — otherwise a two-speed problem would take the first
 * speed twice and never see the second.
 */
export const RELATIVE_RULES: Rule[] = [
  twoVelocities,
  ...separation,
  elapsed,
  soleVelocity,
];

/** Exported for tests; `fromUnit` keeps the conversion honest elsewhere. */
export const __testing = { movingApart, fromUnit };
