/**
 * Slot grammar for crossings: a body moving through water or air that is itself
 * moving.
 *
 * 2-D problems have a harder version of the problem the 1-D relative grammar
 * had. There, two speeds were introduced identically and only order separated
 * them. Here the numbers are usually distinguishable — a width is a width, a
 * current is a current — but the *axes are not stated at all*. "Six metres
 * wide, flowing at 2 m/s" never says which way is x.
 *
 * So this grammar chooses the frame, and the choice is part of the reading:
 *
 *     +x is downstream — the way the current or wind pushes
 *     +y is across     — the way the body is trying to go
 *
 * That is the same kind of convention as "up is positive" in free fall: not a
 * fact about the problem, a decision that has to be shown to the student. The
 * domain banner names the domain; the parsed values name the axes by landing in
 * `v2x` and `sy` where a student can see them.
 *
 * ## The two crossings
 *
 * Everything here turns on a distinction that is easy to miss and expensive to
 * get wrong, because both are written in nearly the same words:
 *
 *   - **Drift.** The body aims straight across and the current carries it
 *     downstream. Its heading is across, so `v1x = 0`, and the answer is where
 *     it actually ends up.
 *   - **Compensation.** The body aims *upstream* so that it ends up straight
 *     across. Now `v1x ≠ 0` — that is the thing being asked — and instead the
 *     resultant has no downstream component, `vrx = 0`.
 *
 * Assuming drift on a compensation problem produces a confident, wrong,
 * plausible-looking answer, which is the worst failure this app has. So the
 * compensation cues are deliberately narrow — they name aiming upstream or
 * landing directly opposite, and nothing vaguer. "At what angle" is *not* among
 * them, because it asks the drift question just as often as the other one.
 *
 * No angle-input rule: these problems ask for headings far more than they state
 * them, and teaching the unit table the word "degrees" would give every other
 * detector a dimensionless number to trip over for almost no gain.
 */
import {
  LENGTH,
  METRE,
  METRE_PER_SECOND,
  SECOND,
  TIME,
  VELOCITY,
} from '../math/index.ts';
import type { Rule, SlotMatch, Token } from './types.ts';
import { numberRule, phraseAt, postfixNumberRule } from './grammar.ts';

/** Wording that means a body is getting from one side of something to the other. */
export const CROSSING_CUES: string[][] = [
  ['across', 'the', 'river'],
  ['across', 'a', 'river'],
  ['across', 'the', 'stream'],
  ['across', 'a', 'stream'],
  ['across', 'the', 'channel'],
  ['across', 'a', 'channel'],
  ['across', 'the', 'water'],
  ['straight', 'across'],
  ['directly', 'across'],
  ['the', 'other', 'side'],
  ['other', 'side'],
  ['opposite', 'bank'],
  ['opposite', 'shore'],
  ['far', 'bank'],
  ['cross', 'the', 'river'],
  ['crosses', 'the', 'river'],
  ['crossing', 'the', 'river'],
  ['perpendicular', 'to', 'the', 'bank'],
];

/**
 * Wording that means the body is aiming upstream to cancel the drift.
 *
 * Narrow on purpose — see the note above. Each of these names an *intent to
 * counteract*, which is what separates the two archetypes; anything that merely
 * asks about an angle belongs to neither.
 */
export const COMPENSATION_CUES: string[][] = [
  ['head', 'upstream'],
  ['heads', 'upstream'],
  ['heading', 'upstream'],
  ['aim', 'upstream'],
  ['aims', 'upstream'],
  ['aimed', 'upstream'],
  ['point', 'upstream'],
  ['pointed', 'upstream'],
  ['directly', 'opposite'],
  ['must', 'head'],
  ['must', 'aim'],
  ['must', 'she', 'head'],
  ['must', 'he', 'head'],
  ['must', 'they', 'head'],
  ['should', 'head'],
  ['should', 'aim'],
  ['in', 'order', 'to', 'travel', 'straight', 'across'],
  ['in', 'order', 'to', 'cross', 'straight'],
  ['so', 'that', 'it', 'travels', 'straight', 'across'],
  ['so', 'that', 'she', 'lands'],
  ['without', 'drifting'],
  ['no', 'drift'],
  ['compensate'],
];

/**
 * Wording that puts a moving medium in the story.
 *
 * Used by domain detection as well as here: a current or a wind is what makes a
 * problem planar in the first place.
 */
export const MEDIUM_CUES: string[][] = [
  ['current'],
  ['flowing'],
  ['flows'],
  ['downstream'],
  ['upstream'],
  ['crosswind'],
  ['headwind'],
  ['tailwind'],
  ['wind'],
  ['still', 'water'],
];

function hasAny(tokens: Token[], cues: string[][]): boolean {
  return tokens.some((_, i) => cues.some((cue) => phraseAt(tokens, i, cue)));
}

function firstIndex(tokens: Token[], cues: string[][]): number {
  return tokens.findIndex((_, i) => cues.some((cue) => phraseAt(tokens, i, cue)));
}

/**
 * Compensating counts as crossing.
 *
 * "Must head upstream to land directly opposite" describes a crossing without
 * using any of the crossing words — you only ever aim upstream in order to get
 * to the other side. Folding it in here rather than duplicating the phrases
 * keeps the two lists meaning one thing each.
 */
export const isCrossing = (tokens: Token[]): boolean =>
  hasAny(tokens, CROSSING_CUES) || hasAny(tokens, COMPENSATION_CUES);

export const isCompensating = (tokens: Token[]): boolean =>
  hasAny(tokens, COMPENSATION_CUES);

/**
 * The zeros the frame choice implies.
 *
 * Two of them, and they come from the convention rather than from the text:
 * the current runs along the bank, so it has no across-component; and in a
 * drift crossing the body is aimed straight across, so it has no downstream
 * one. In a compensation crossing that second zero moves to the resultant,
 * which is the whole content of the distinction.
 *
 * These are inferences, not readings, so each one carries the phrase that
 * licensed it as its `source` — a student who disagrees can see exactly which
 * words the app leaned on and clear the field.
 */
const crossingFrame: Rule = {
  id: 'crossing-frame',
  description: 'a crossing fixes the axes: current along x, crossing along y',
  match(tokens) {
    if (!isCrossing(tokens)) return [];

    const found = firstIndex(tokens, CROSSING_CUES);
    const at = found >= 0 ? found : Math.max(firstIndex(tokens, COMPENSATION_CUES), 0);
    const compensating = isCompensating(tokens);
    const cueAt = compensating ? Math.max(firstIndex(tokens, COMPENSATION_CUES), 0) : at;

    const zero = (variable: string, index: number, why: string): SlotMatch => ({
      ruleId: 'crossing-frame',
      variable,
      quantity: { value: 0, dimension: VELOCITY },
      startToken: index,
      endToken: index,
      source: why,
    });

    return [
      compensating
        ? zero('vrx', cueAt, 'aims upstream to cancel the drift, so it ends up straight across')
        : zero('v1x', at, 'aimed straight across, so none of its own speed is downstream'),
      zero('v2y', at, 'the current runs along the bank, not across it'),
    ];
  },
};

/** How wide the thing being crossed is — the across-displacement. */
const width: Rule[] = [
  postfixNumberRule(
    'crossing-width',
    'width stated before its cue (N m wide / across)',
    [['wide'], ['in', 'width'], ['across']],
    {
      variable: 'sy',
      dimension: LENGTH,
      defaultUnit: METRE,
      sign: 'positive',
      requireExplicitUnit: true,
    },
  ),
  numberRule(
    'crossing-width-prefix',
    'width stated after its cue (a width of N m)',
    [['width', 'of'], ['wide', 'as']],
    {
      variable: 'sy',
      dimension: LENGTH,
      defaultUnit: METRE,
      sign: 'positive',
      requireExplicitUnit: true,
    },
  ),
];

/** How far downstream it ends up. */
const drift: Rule = postfixNumberRule(
  'crossing-drift',
  'downstream displacement stated before its cue (N m downstream)',
  [['downstream'], ['down', 'the', 'river'], ['down', 'stream']],
  {
    variable: 'sx',
    dimension: LENGTH,
    defaultUnit: METRE,
    sign: 'positive',
    requireExplicitUnit: true,
  },
);

/**
 * How long the crossing takes.
 *
 * `requireExplicitUnit` earns its keep on the bare `in` cue: "in still water at
 * 4 m/s" puts a velocity where the rule is looking, and demanding a time unit
 * throws it out instead of filing a speed as a duration.
 */
const elapsed: Rule = numberRule(
  'crossing-time',
  'elapsed time N',
  [['in', 'a', 'time', 'of'], ['time', 'of'], ['takes'], ['after'], ['within'], ['in']],
  {
    variable: 't',
    dimension: TIME,
    defaultUnit: SECOND,
    sign: 'positive',
    requireExplicitUnit: true,
  },
);

/** The speed of the water or the air, which by the convention is the x axis. */
const medium: Rule[] = [
  numberRule(
    'crossing-medium',
    'speed of the current or wind, stated after its cue',
    [
      ['flowing', 'at'],
      ['flows', 'at'],
      ['flowing', 'with', 'a', 'speed', 'of'],
      ['current', 'of'],
      ['current', 'flowing', 'at'],
      ['current', 'runs', 'at'],
      ['wind', 'of'],
      ['wind', 'blowing', 'at'],
      ['wind', 'blows', 'at'],
      ['crosswind', 'of'],
      ['downstream', 'at'],
      ['moving', 'downstream', 'at'],
    ],
    {
      variable: 'v2x',
      dimension: VELOCITY,
      defaultUnit: METRE_PER_SECOND,
      sign: 'positive',
      requireExplicitUnit: true,
    },
  ),
  postfixNumberRule(
    'crossing-medium-postfix',
    'speed of the current or wind, stated before its cue (a N m/s current)',
    [['current'], ['wind'], ['crosswind'], ['tailwind'], ['headwind']],
    {
      variable: 'v2x',
      dimension: VELOCITY,
      defaultUnit: METRE_PER_SECOND,
      sign: 'positive',
      requireExplicitUnit: true,
    },
  ),
];

const OWN_SPEED_PREFIX: string[][] = [
  ['swims', 'at'],
  ['swim', 'at'],
  ['swimming', 'at'],
  ['can', 'swim', 'at'],
  ['rows', 'at'],
  ['row', 'at'],
  ['rowing', 'at'],
  ['can', 'row', 'at'],
  ['paddles', 'at'],
  ['flies', 'at'],
  ['fly', 'at'],
  ['flying', 'at'],
  ['airspeed', 'of'],
];

const OWN_SPEED_POSTFIX: string[][] = [
  ['in', 'still', 'water'],
  ['relative', 'to', 'the', 'water'],
  ['with', 'respect', 'to', 'the', 'water'],
  ['through', 'the', 'water'],
  ['relative', 'to', 'the', 'air'],
  ['through', 'the', 'air'],
];

/**
 * The body's own speed through the medium — and which slot it belongs in.
 *
 * Conditional, which is why it is written out rather than declared: in a drift
 * crossing the heading is across, so the stated speed *is* the across-component
 * and goes to `v1y`. In a compensation crossing the heading is unknown — it is
 * usually what the problem asks for — so the same number is only a magnitude
 * and goes to `v1`. Filing it as `v1y` there would assert the answer.
 */
const ownSpeed: Rule = {
  id: 'crossing-own-speed',
  description: "the body's own speed through the water or air",
  match(tokens) {
    if (!isCrossing(tokens)) return [];
    const spec = {
      variable: isCompensating(tokens) ? 'v1' : 'v1y',
      dimension: VELOCITY,
      defaultUnit: METRE_PER_SECOND,
      sign: 'positive' as const,
      requireExplicitUnit: true,
    };
    const description = "the body's own speed through the medium";
    return [
      ...numberRule('crossing-own-speed', description, OWN_SPEED_PREFIX, spec).match(
        tokens,
      ),
      ...postfixNumberRule(
        'crossing-own-speed',
        description,
        OWN_SPEED_POSTFIX,
        spec,
      ).match(tokens),
    ];
  },
};

/**
 * Ordered so the specific rules win.
 *
 * `parse` keeps the first match per variable, so the frame zeros go first: they
 * are the ones a later, looser rule could otherwise overwrite with a number
 * that happened to sit near a cue.
 */
export const PLANAR_RULES: Rule[] = [
  crossingFrame,
  ...width,
  drift,
  ...medium,
  ownSpeed,
  elapsed,
];
