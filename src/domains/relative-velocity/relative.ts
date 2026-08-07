/**
 * Two bodies moving along a line — approaching, chasing, or separating.
 *
 * "Two trains 600 m apart travel towards each other at 30 and 20 m/s; how long
 * before they pass?" is the canonical shape, and the usual way it is taught —
 * add the speeds when they approach, subtract when they chase — is two rules
 * a student has to remember and pick between.
 *
 * Modelled instead in a single signed frame, where one rule covers every case.
 * Velocities carry a sign, so a train moving left is negative, and the relative
 * velocity is always `v_rel = v_a − v_b`. Approach and pursuit stop being
 * different formulas and become different signs:
 *
 *     towards each other   v_a = +30, v_b = −20  ⇒  v_rel = 50   (closing fast)
 *     same direction       v_a = +30, v_b = +20  ⇒  v_rel = 10   (closing slowly)
 *     separating           v_a = −10, v_b = +20  ⇒  v_rel = −30  (never meet)
 *
 * That third case needs no special handling: the separation and the relative
 * velocity have opposite signs, `t` comes out negative, and the non-negative
 * time constraint rejects it — so the solver reports that they never meet
 * rather than returning a plausible number.
 *
 * Everything here is linear. No quadratics, no discriminants, no root
 * selection, which is why every closed form below is a single expression.
 */
import {
  LENGTH,
  TIME,
  VELOCITY,
  add,
  divide,
  multiply,
  subtract,
  type Quantity,
} from '../../math/index.ts';
import type {
  Domain,
  Equation,
  EquationSolution,
  Knowns,
  Variable,
  VariableKey,
} from '../../engine/index.ts';

/** Read a required known, throwing if absent (the solver treats this as null). */
function need(knowns: Knowns, key: VariableKey): Quantity {
  const value = knowns[key];
  if (value === undefined) throw new Error(`missing known: ${key}`);
  return value;
}

const one = (
  roots: Quantity[],
  rearrangedLatex: string,
  inputs: VariableKey[],
): EquationSolution => ({ roots, rearrangedLatex, inputs });

/**
 * A meeting in the past is not an answer to "how long until they meet".
 *
 * This is what makes separating bodies fall out for free: the arithmetic
 * happily returns a negative time, and rejecting it reports the truth — these
 * two never meet — instead of a number that looks like an answer.
 */
const NON_NEGATIVE_TIME = {
  accepts: (q: Quantity) => q.value >= -1e-9,
  reason: 'they are not closing — a meeting time would be in the past',
};

export const variables: Variable[] = [
  {
    key: 'xa',
    symbol: 'xₐ',
    latex: 'x_a',
    dimension: LENGTH,
    displayUnit: (kit) => kit.length,
  },
  {
    key: 'xb',
    symbol: 'x_b',
    latex: 'x_b',
    dimension: LENGTH,
    displayUnit: (kit) => kit.length,
  },
  {
    key: 'va',
    symbol: 'vₐ',
    latex: 'v_a',
    dimension: VELOCITY,
    displayUnit: (kit) => kit.velocity,
  },
  {
    key: 'vb',
    symbol: 'v_b',
    latex: 'v_b',
    dimension: VELOCITY,
    displayUnit: (kit) => kit.velocity,
  },
  {
    key: 'vrel',
    symbol: 'v_rel',
    latex: 'v_{\\mathrm{rel}}',
    dimension: VELOCITY,
    displayUnit: (kit) => kit.velocity,
  },
  {
    key: 'd',
    symbol: 'd',
    latex: 'd',
    dimension: LENGTH,
    displayUnit: (kit) => kit.length,
  },
  {
    key: 't',
    symbol: 't',
    latex: 't',
    dimension: TIME,
    displayUnit: (kit) => kit.time,
    physical: NON_NEGATIVE_TIME,
  },
  {
    key: 'xm',
    symbol: 'x_m',
    latex: 'x_m',
    dimension: LENGTH,
    displayUnit: (kit) => kit.length,
    // Where they meet is the answer, not something a problem states.
    derived: true,
  },
];

/** The one rule that replaces "add the speeds" and "subtract the speeds". */
const relativeEq: Equation = {
  id: 'relative',
  latex: 'v_{\\mathrm{rel}} = v_a - v_b',
  variables: ['vrel', 'va', 'vb'],
  solveFor(target, k) {
    switch (target) {
      case 'vrel':
        return one(
          [subtract(need(k, 'va'), need(k, 'vb'))],
          'v_{\\mathrm{rel}} = v_a - v_b',
          ['va', 'vb'],
        );
      case 'va':
        return one(
          [add(need(k, 'vrel'), need(k, 'vb'))],
          'v_a = v_{\\mathrm{rel}} + v_b',
          ['vrel', 'vb'],
        );
      case 'vb':
        return one(
          [subtract(need(k, 'va'), need(k, 'vrel'))],
          'v_b = v_a - v_{\\mathrm{rel}}',
          ['va', 'vrel'],
        );
      default:
        return null;
    }
  },
};

/** Separation as the gap between two positions, signed the same way as v_rel. */
const separationEq: Equation = {
  id: 'separation',
  latex: 'd = x_b - x_a',
  variables: ['d', 'xa', 'xb'],
  solveFor(target, k) {
    switch (target) {
      case 'd':
        return one([subtract(need(k, 'xb'), need(k, 'xa'))], 'd = x_b - x_a', [
          'xb',
          'xa',
        ]);
      case 'xa':
        return one([subtract(need(k, 'xb'), need(k, 'd'))], 'x_a = x_b - d', [
          'xb',
          'd',
        ]);
      case 'xb':
        return one([add(need(k, 'xa'), need(k, 'd'))], 'x_b = x_a + d', ['xa', 'd']);
      default:
        return null;
    }
  },
};

/**
 * The gap closes at the relative velocity.
 *
 * `d` and `v_rel` are signed consistently, so this holds whichever way the two
 * are moving; the sign of `t` then reports whether a meeting is ahead or
 * behind.
 */
const closingEq: Equation = {
  id: 'closing',
  latex: 'd = v_{\\mathrm{rel}} \\, t',
  variables: ['d', 'vrel', 't'],
  solveFor(target, k) {
    switch (target) {
      case 'd':
        return one(
          [multiply(need(k, 'vrel'), need(k, 't'))],
          'd = v_{\\mathrm{rel}} \\, t',
          ['vrel', 't'],
        );
      case 't': {
        const vrel = need(k, 'vrel');
        // Equal velocities: the gap never changes, so no meeting time exists.
        if (vrel.value === 0) return null;
        // A meeting in the past is not an answer to "when will they meet".
        //
        // Guarded here rather than left to the variable's physical constraint,
        // because the solver deliberately falls back to raw roots when nothing
        // survives a constraint (solver.ts, and there is a test pinning it).
        // Sensible for a quadratic where some value beats none; wrong here,
        // where a negative time is exactly the signal that these two never
        // meet. The Equation contract already covers this: null means the
        // equation cannot produce a real value in the current state.
        if (divide(need(k, 'd'), vrel).value < -1e-9) return null;
        return one(
          [divide(need(k, 'd'), vrel)],
          't = \\frac{d}{v_{\\mathrm{rel}}}',
          ['d', 'vrel'],
        );
      }
      case 'vrel': {
        const t = need(k, 't');
        if (t.value === 0) return null;
        return one([divide(need(k, 'd'), t)], 'v_{\\mathrm{rel}} = \\frac{d}{t}', [
          'd',
          't',
        ]);
      }
      default:
        return null;
    }
  },
};

/** Where they meet, tracked from A. Answers "how far did each travel?". */
const meetingEq: Equation = {
  id: 'meeting',
  latex: 'x_m = x_a + v_a t',
  variables: ['xm', 'xa', 'va', 't'],
  solveFor(target, k) {
    switch (target) {
      case 'xm':
        return one(
          [add(need(k, 'xa'), multiply(need(k, 'va'), need(k, 't')))],
          'x_m = x_a + v_a t',
          ['xa', 'va', 't'],
        );
      case 'xa':
        return one(
          [subtract(need(k, 'xm'), multiply(need(k, 'va'), need(k, 't')))],
          'x_a = x_m - v_a t',
          ['xm', 'va', 't'],
        );
      case 'va': {
        const t = need(k, 't');
        if (t.value === 0) return null;
        return one(
          [divide(subtract(need(k, 'xm'), need(k, 'xa')), t)],
          'v_a = \\frac{x_m - x_a}{t}',
          ['xm', 'xa', 't'],
        );
      }
      default:
        return null;
    }
  },
};

export const relativeVelocity: Domain = {
  id: 'relative-velocity',
  name: 'Relative Velocity',
  variables,
  equations: [relativeEq, separationEq, closingEq, meetingEq],
};
