/**
 * Slot grammar for 1-D free-fall / kinematics word problems.
 *
 * Each rule recognizes curated trigger phrases and emits a variable assignment.
 * Rules are ordered by priority; the parser keeps the first match per variable.
 * Extending coverage means adding a phrase or a rule here — the deterministic,
 * testable alternative to the legacy regex.
 *
 * Sign conventions follow the domain: down is negative. "Hits the ground at 30"
 * ⇒ v = −30; "from a height of 45 m" ⇒ Δx = −45 (the object falls).
 */
import {
  ACCELERATION,
  FOOT,
  FOOT_PER_SECOND,
  FOOT_PER_SECOND_SQUARED,
  KILOMETRE,
  KILOMETRE_PER_HOUR,
  LENGTH,
  MILE,
  MILE_PER_HOUR,
  METRE,
  METRE_PER_SECOND,
  METRE_PER_SECOND_SQUARED,
  SECOND,
  TIME,
  VELOCITY,
  dimensionsEqual,
  fromUnit,
  quantity,
  type Dimension,
  type Unit,
} from '../math/index.ts';
import type { UnitSystem } from '../math/index.ts';
import type { VariableKey } from '../engine/index.ts';
import type { Rule, SlotMatch, Token } from './types.ts';
import { defaultTokenizer } from './tokenizer.ts';

/** Canonical unit tokens the tokenizer produces → their Unit. */
export const UNITS: Record<string, Unit> = {
  m: METRE,
  ft: FOOT,
  s: SECOND,
  'm/s': METRE_PER_SECOND,
  'ft/s': FOOT_PER_SECOND,
  'm/s2': METRE_PER_SECOND_SQUARED,
  'ft/s2': FOOT_PER_SECOND_SQUARED,
  // Road units: readable, but not display units — see math/units.ts.
  'km/h': KILOMETRE_PER_HOUR,
  mph: MILE_PER_HOUR,
  km: KILOMETRE,
  mi: MILE,
};

type Sign = 'positive' | 'negative' | 'signed';

interface SlotSpec {
  variable: VariableKey;
  dimension: Dimension;
  defaultUnit: Unit;
  sign: Sign;
  /** Require the number to carry an explicit, dimension-compatible unit. */
  requireExplicitUnit?: boolean;
}

function phraseAt(tokens: Token[], at: number, words: string[]): boolean {
  for (let j = 0; j < words.length; j++) {
    const token = tokens[at + j];
    if (!token || token.kind !== 'word' || token.text !== words[j]) return false;
  }
  return true;
}

function nextNumber(
  tokens: Token[],
  from: number,
  window: number,
): { index: number; value: number } | null {
  const limit = Math.min(tokens.length, from + window);
  for (let j = from; j < limit; j++) {
    const token = tokens[j];
    if (token && token.kind === 'number' && token.value !== undefined) {
      return { index: j, value: token.value };
    }
  }
  return null;
}

/** Canonical unit tokens the tokenizer emits, grouped by system. */
const SYSTEM_TOKENS: Record<UnitSystem, string[]> = {
  imperial: ['ft', 'ft/s', 'ft/s2', 'mph', 'mi'],
  metric: ['m', 'm/s', 'm/s2', 'km/h', 'km'],
};

/**
 * The unit system a story is written in, or null when its own units don't say.
 *
 * The tokenizer folds "feet"/"foot"/"ft" into one token, so this is a
 * deterministic fact about the text rather than an inference — which is why it
 * outranks a model's guess about units, and why the app switches its display
 * system to match. A story mixing systems returns null instead of picking one.
 */
export function detectSystem(text: string): UnitSystem | null {
  const words = new Set(
    defaultTokenizer
      .tokenize(text)
      .filter((token) => token.kind === 'word')
      .map((token) => token.text),
  );
  const imperial = SYSTEM_TOKENS.imperial.some((unit) => words.has(unit));
  const metric = SYSTEM_TOKENS.metric.some((unit) => words.has(unit));
  if (imperial === metric) return null;
  return imperial ? 'imperial' : 'metric';
}

/** A number from the text, with the dimension of any unit written next to it. */
export interface MeasuredNumber {
  readonly value: number;
  /** Absent when the number carries no unit ("32 students"). */
  readonly dimension?: Dimension;
}

/**
 * Every number in the token stream, tagged with the dimension of the unit that
 * follows it.
 *
 * The grammar already refuses a number whose unit contradicts the slot it is
 * matching (see `numberRule`). Exposing that same fact lets smart parse be held
 * to it too: "30 m/s" can only ever be a velocity, whatever a model claims
 * about it. Without this the model is free to file a speed under acceleration,
 * which is exactly what a small one does.
 */
export function measuredNumbers(tokens: Token[]): MeasuredNumber[] {
  const measured: MeasuredNumber[] = [];
  tokens.forEach((token, i) => {
    if (token.kind !== 'number' || token.value === undefined) return;
    const next = tokens[i + 1];
    const unit = next && next.kind === 'word' ? UNITS[next.text] : undefined;
    measured.push(
      unit
        ? { value: token.value, dimension: unit.dimension }
        : { value: token.value },
    );
  });
  return measured;
}

function applySign(value: number, sign: Sign): number {
  if (sign === 'signed') return value;
  return sign === 'negative' ? -Math.abs(value) : Math.abs(value);
}

function numberRule(
  id: string,
  description: string,
  phrases: string[][],
  spec: SlotSpec,
  // Six, not three: "from a scaffold plank 24 m" puts the number four tokens
  // past the cue, and three silently missed every phrasing with a noun phrase
  // in between. Safe to widen because every match still has to carry a
  // dimension-compatible unit.
  window = 6,
): Rule {
  return {
    id,
    description,
    match(tokens) {
      const matches: SlotMatch[] = [];
      for (const phrase of phrases) {
        for (let i = 0; i < tokens.length; i++) {
          if (!phraseAt(tokens, i, phrase)) continue;
          const num = nextNumber(tokens, i + phrase.length, window);
          if (!num) continue;

          const unitToken = tokens[num.index + 1];
          const explicit =
            unitToken && unitToken.kind === 'word'
              ? UNITS[unitToken.text]
              : undefined;

          let unit = spec.defaultUnit;
          let hasExplicit = false;
          if (explicit) {
            // A number carrying a unit of the wrong dimension isn't this slot.
            if (!dimensionsEqual(explicit.dimension, spec.dimension)) continue;
            unit = explicit;
            hasExplicit = true;
          } else if (spec.requireExplicitUnit) {
            continue;
          }

          const magnitude = applySign(num.value, spec.sign);
          const endToken = hasExplicit ? num.index + 1 : num.index;
          matches.push({
            ruleId: id,
            variable: spec.variable,
            quantity: fromUnit(magnitude, unit),
            startToken: i,
            endToken,
            source: tokens
              .slice(i, endToken + 1)
              .map((t) => t.text)
              .join(' '),
          });
        }
      }
      return matches;
    },
  };
}

/**
 * A rule for numbers that come *before* their cue.
 *
 * Every other rule reads "trigger, then number" — "from a height of 45 m". But
 * heights are just as often written the other way round: "24 m off the ground",
 * "40 feet above the lawn", "150 m above the shaft floor". No amount of prefix
 * phrases reaches those, because the words that identify the slot only arrive
 * after the value.
 *
 * Requires an explicit, dimension-matching unit, so a bare number followed by
 * "above" can't be captured by accident.
 */
/** Words that mean what follows is where the object *ends up*, not where it began. */
const LANDING_CUES = ['onto', 'lands', 'settles', 'stops', 'perched', 'resting'];

function postfixNumberRule(
  id: string,
  description: string,
  suffixes: string[][],
  spec: SlotSpec,
): Rule {
  return {
    id,
    description,
    match(tokens) {
      const matches: SlotMatch[] = [];
      tokens.forEach((token, i) => {
        if (token.kind !== 'number' || token.value === undefined) return;
        const unitToken = tokens[i + 1];
        const unit =
          unitToken && unitToken.kind === 'word' ? UNITS[unitToken.text] : undefined;
        if (!unit || !dimensionsEqual(unit.dimension, spec.dimension)) return;

        // "3 m above the ground" is a start height when it describes the
        // object and a landing height when it describes what the object lands
        // on — identical wording, opposite slots. Looking back for a landing
        // cue is the only thing that separates them.
        const precedingLanding = tokens
          .slice(Math.max(0, i - 6), i)
          .some((t) => t.kind === 'word' && LANDING_CUES.includes(t.text));
        if (precedingLanding) return;

        for (const suffix of suffixes) {
          if (!phraseAt(tokens, i + 2, suffix)) continue;
          const endToken = i + 1 + suffix.length;
          matches.push({
            ruleId: id,
            variable: spec.variable,
            quantity: fromUnit(applySign(token.value, spec.sign), unit),
            startToken: i,
            endToken,
            source: tokens
              .slice(i, endToken + 1)
              .map((t) => t.text)
              .join(' '),
          });
          return;
        }
      });
      return matches;
    },
  };
}

function flagRule(
  id: string,
  description: string,
  phrases: string[][],
  variable: VariableKey,
  value: ReturnType<typeof quantity>,
): Rule {
  return {
    id,
    description,
    match(tokens) {
      const matches: SlotMatch[] = [];
      for (const phrase of phrases) {
        for (let i = 0; i < tokens.length; i++) {
          if (!phraseAt(tokens, i, phrase)) continue;
          matches.push({
            ruleId: id,
            variable,
            quantity: value,
            startToken: i,
            endToken: i + phrase.length - 1,
            source: phrase.join(' '),
          });
        }
      }
      return matches;
    },
  };
}

/**
 * Things at ground level that a falling object lands on. Used to fix x₂ = 0
 * without the story having to say "the ground". Raised surfaces belong in
 * `x2-obstacle` instead — they have a height of their own.
 */
export const GROUND_SURFACES = [
  'ground',
  'pavement',
  'floor',
  'street',
  'lawn',
  'grass',
  'water',
  'sidewalk',
  'concrete',
  'dirt',
  'sand',
];

const velocity = (sign: Sign, requireExplicitUnit = false): SlotSpec => ({
  variable: 'v0',
  dimension: VELOCITY,
  defaultUnit: METRE_PER_SECOND,
  sign,
  requireExplicitUnit,
});

export const RULES: Rule[] = [
  numberRule(
    'v0-up',
    'thrown upward at N',
    [
      ['thrown', 'upward', 'at'],
      ['thrown', 'up', 'at'],
      ['thrown', 'upwards', 'at'],
      ['launched', 'upward', 'at'],
      ['projected', 'upward', 'at'],
      ['upward', 'at'],
      // Release phrased as leaving the thrower rather than as a direction.
      ['leaves', 'her', 'hand', 'at'],
      ['leaves', 'his', 'hand', 'at'],
      ['leaves', 'their', 'hand', 'at'],
      ['leaves', 'the', 'hand', 'at'],
      ['leaves', 'her', 'hand', 'travelling', 'at'],
      ['leaves', 'his', 'hand', 'travelling', 'at'],
      // Kept short so they generalize past the exact sentence that exposed the
      // gap: "straight up at" covers thrown/hurled/tossed/kicked alike.
      ['straight', 'up', 'at'],
      ['skyward', 'at'],
      ['upward', 'with', 'a', 'speed', 'of'],
      ['upward', 'with', 'a', 'velocity', 'of'],
      ['initial', 'upward', 'speed', 'of'],
      ['initial', 'upward', 'velocity', 'of'],
      ['moving', 'upward', 'at'],
    ],
    velocity('positive'),
  ),
  numberRule(
    'v0-down',
    'thrown downward at N',
    [
      ['thrown', 'downward', 'at'],
      ['thrown', 'down', 'at'],
      ['thrown', 'downwards', 'at'],
      ['downward', 'at'],
      ['straight', 'down', 'at'],
      ['downward', 'with', 'a', 'speed', 'of'],
      ['downward', 'with', 'a', 'velocity', 'of'],
      ['initial', 'downward', 'speed', 'of'],
      ['initial', 'downward', 'velocity', 'of'],
      ['already', 'falling', 'at'],
      ['still', 'falling', 'at'],
    ],
    velocity('negative'),
  ),
  numberRule(
    'v0-initial',
    'initial velocity of N',
    [
      ['initial', 'velocity', 'of'],
      ['initial', 'speed', 'of'],
      ['with', 'an', 'initial', 'velocity', 'of'],
    ],
    { variable: 'v0', dimension: VELOCITY, defaultUnit: METRE_PER_SECOND, sign: 'signed' },
  ),
  // Ordered AFTER the velocity rules on purpose: the parser keeps the first
  // match per variable, so listing this first made "released" beat a stated
  // speed. "With an initial upward speed of 23 ft/s, the ice is released"
  // came back as v0 = 0 — confidently wrong, where silence is recoverable.
  // Verbs that mean "it started at rest" without saying so. Prose reaches for
  // these far more often than "from rest": things slip, topple and break loose.
  flagRule(
    'rest',
    'initial velocity zero (from rest / dropped / came loose on its own)',
    [
      ['from', 'rest'],
      ['at', 'rest'],
      ['dropped'],
      ['released'],
      ['slips'],
      ['slipped'],
      ['topples'],
      ['toppled'],
      ['tumbles'],
      ['tumbled'],
      ['breaks', 'loose'],
      ['broke', 'loose'],
      ['comes', 'loose'],
      ['came', 'loose'],
      ['rolls', 'off'],
      ['rolled', 'off'],
    ],
    'v0',
    quantity(0, VELOCITY),
  ),
  numberRule(
    'v-impact',
    'final velocity at impact',
    [
      ['hits', 'the', 'ground', 'at'],
      ['lands', 'at'],
      ['strikes', 'the', 'ground', 'at'],
      ['impacts', 'the', 'ground', 'at'],
      ['reaches', 'the', 'ground', 'at'],
      ['hits', 'the', 'ground', 'with', 'a', 'speed', 'of'],
      // Arrival phrased without naming the surface. The corpus scored v at
      // 0/245 before these: a whole category of standard wording the grammar
      // simply could not reach.
      ['arrives', 'at'],
      ['arrives', 'travelling', 'at'],
      ['arrives', 'traveling', 'at'],
      ['arriving', 'at'],
      ['impact', 'speed', 'is'],
      ['speed', 'just', 'before', 'landing', 'is'],
      ['speed', 'on', 'impact', 'is'],
      ['final', 'speed', 'of'],
      // Impact against a named surface rather than "the ground", optionally
      // with a movement participle between the surface and the speed.
      ...['pavement', 'floor', 'street', 'lawn', 'grass', 'roof', 'water'].flatMap(
        (surface) =>
          ['hits', 'strikes', 'reaches', 'impacts'].flatMap((verb) => [
            [verb, 'the', surface, 'at'],
            [verb, 'the', surface, 'travelling', 'at'],
            [verb, 'the', surface, 'traveling', 'at'],
            [verb, 'the', surface, 'moving', 'at'],
          ]),
      ),
    ],
    { variable: 'v', dimension: VELOCITY, defaultUnit: METRE_PER_SECOND, sign: 'negative' },
  ),
  numberRule(
    'time',
    'elapsed time N',
    [['falls', 'for'], ['for'], ['after'], ['in'], ['time', 'of'], ['takes']],
    { variable: 't', dimension: TIME, defaultUnit: SECOND, sign: 'positive' },
  ),
  // Starting position: the height an object begins at → x₁ (positive up).
  numberRule(
    'x1-height',
    'starting height N',
    [
      ['from', 'a', 'height', 'of'],
      ['dropped', 'from', 'a', 'height', 'of'],
      ['height', 'of'],
      ['at', 'a', 'height', 'of'],
      ['from', 'the', 'top', 'of'],
      ['at', 'the', 'top', 'of'],
      ['from', 'a', 'platform'],
      ['from', 'a', 'building'],
      ['from', 'a', 'cliff'],
      ['from', 'a', 'window'],
    ],
    { variable: 'x1', dimension: LENGTH, defaultUnit: METRE, sign: 'positive' },
  ),
  numberRule(
    'x1-distance',
    'starting height N (explicit unit required)',
    [['from'], ['dropped', 'from'], ['falls'], ['drops'], ['fell'], ['falling']],
    {
      variable: 'x1',
      dimension: LENGTH,
      defaultUnit: METRE,
      sign: 'positive',
      requireExplicitUnit: true,
    },
  ),
  // Listed after the prefix height rules: the parser keeps the first match per
  // variable, so this only fires when nothing else claimed x₁.
  postfixNumberRule(
    'x1-postfix',
    'starting height stated before its cue (N m above/off the ...)',
    [
      ['above'],
      ['off', 'the'],
      ['up'],
      ['overhead'],
      ['high', 'up'],
      ['mark'],
    ],
    {
      variable: 'x1',
      dimension: LENGTH,
      defaultUnit: METRE,
      sign: 'positive',
      requireExplicitUnit: true,
    },
  ),
  // Final position: the height of what it lands on → x₂ (positive up).
  numberRule(
    'x2-obstacle',
    'landing height N (lands on an object N tall / on a surface N up)',
    [
      ['that', 'is'],
      ['lands', 'on', 'a'],
      ['onto', 'a'],
      ['on', 'top', 'of', 'a'],
      ['onto'],
      // Landing on a raised surface: "on a platform 15 m off the ground".
      ['on', 'a', 'platform'],
      ['on', 'a', 'ledge'],
      ['on', 'a', 'roof'],
      ['on', 'a', 'table'],
      ['on', 'a', 'shelf'],
      ['on', 'a', 'ledge', 'that', 'is'],
      ['that', 'stands'],
      ['whose', 'top', 'is'],
      ['standing'],
    ],
    {
      variable: 'x2',
      dimension: LENGTH,
      defaultUnit: METRE,
      sign: 'positive',
      requireExplicitUnit: true,
    },
  ),
  // Reaching the ground fixes the final position at x₂ = 0. Stories rarely say
  // "the ground" — they name what is at ground level. Raised surfaces (roof,
  // platform, ledge, table, shelf) are deliberately excluded: those are
  // `x2-obstacle`, and they carry a height rather than fixing x₂ at zero.
  flagRule(
    'x2-ground',
    'lands at ground level (x₂ = 0)',
    [
      ...GROUND_SURFACES.flatMap((surface) => [
        // Preposition + surface, with no verb enumerated. "Comes to rest on
        // the sand" and "settles on the grass" then work without either verb
        // being listed. Height references ("above the ground", "off the
        // ground") are deliberately excluded — those state a start, not a
        // landing, and matching them would fabricate x2 = 0.
        ['on', 'the', surface],
        ['to', 'the', surface],
        ['hits', 'the', surface],
        ['strikes', 'the', surface],
        ['reaches', 'the', surface],
        ['impacts', 'the', surface],
        ['lands', 'on', 'the', surface],
        ['into', 'the', surface],
        ['onto', 'the', surface],
      ]),
    ],
    'x2',
    quantity(0, LENGTH),
  ),
  numberRule(
    'accel',
    'acceleration of N',
    [
      ['accelerates', 'at'],
      ['acceleration', 'of'],
      ['at', 'an', 'acceleration', 'of'],
      ['decelerates', 'at'],
      ['decelerates', 'it', 'at'],
      ['decelerating', 'at'],
      ['slows', 'at'],
      ['at', 'a', 'steady'],
      ['at', 'a', 'constant'],
    ],
    { variable: 'a', dimension: ACCELERATION, defaultUnit: METRE_PER_SECOND_SQUARED, sign: 'signed' },
  ),
];
