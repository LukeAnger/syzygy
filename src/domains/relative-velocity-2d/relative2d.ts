/**
 * Two velocities combined in a plane.
 *
 * A duck crossing a flowing river, a plane in a crosswind, a puck thrown from a
 * moving skater. Every one of them is the same relation:
 *
 *     v(A relative to C)  =  v(A relative to B)  +  v(B relative to C)
 *
 * which is vector addition, `R = V₁ + V₂`. Subtraction is not a separate case:
 * "the motorcycle as seen from the car" asks for V₁ given R and V₂, and the
 * solver runs the same equations backwards. One relation covers composition and
 * relative motion both, so the domain models that and nothing else.
 *
 * Each vector carries four variables — two components, a magnitude and a
 * direction — related by the usual trigonometry, and the composition adds the
 * components. Working in components is also how the topic is taught, so a
 * student sees the steps they were told to write down.
 *
 * Angles are measured anticlockwise from the +x axis and stored in radians;
 * degrees are the display unit. Deliberately *not* "degrees from north" or
 * "downstream of straight across" — those are per-problem conventions, and
 * baking one in would silently misread every problem using another.
 *
 * One orientation choice *is* baked in: +y points the way the first body is
 * going, so `v1y` is never negative. It is needed because the interesting
 * question — "at what angle must she head to land directly opposite?" — gives a
 * magnitude and one component, and `y = ±√(|v|² − x²)` has two answers that no
 * equation can choose between. Every planar problem can be set up this way, so
 * the assumption costs nothing and it is what lets those problems finish. It
 * prunes rather than forbids: a `v1y` that some *other* equation determines
 * negative still stands, because the solver keeps raw roots when a constraint
 * leaves none.
 */
import {
  DIMENSIONLESS,
  LENGTH,
  TIME,
  VELOCITY,
  add,
  atan2,
  cos,
  divide,
  hypot,
  multiply,
  negate,
  otherLeg,
  sin,
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

/** One vector's four variables: x, y, magnitude, direction. */
interface VectorKeys {
  readonly x: VariableKey;
  readonly y: VariableKey;
  readonly mag: VariableKey;
  readonly dir: VariableKey;
  /** For LaTeX, e.g. `1` renders v_{1x}, |v_1|, θ_1. */
  readonly sub: string;
}

const V1: VectorKeys = { x: 'v1x', y: 'v1y', mag: 'v1', dir: 'th1', sub: '1' };
const V2: VectorKeys = { x: 'v2x', y: 'v2y', mag: 'v2', dir: 'th2', sub: '2' };
const VR: VectorKeys = { x: 'vrx', y: 'vry', mag: 'vr', dir: 'thr', sub: 'R' };

/**
 * The four equations relating a vector's components to its magnitude and
 * direction.
 *
 * Written as a factory because all three vectors obey them identically; three
 * hand-copied sets would be three chances to typo a sign.
 *
 * Five, not four: the last recovers the y-component from the magnitude and the
 * x-component, which is the step a compensation problem turns on. It offers
 * *both* roots and lets the solver's own constraint machinery pick, rather than
 * returning one and calling it the answer — so when the orientation rule above
 * does not apply, the ambiguity is still visible instead of resolved by fiat.
 */
function vectorEquations(v: VectorKeys): Equation[] {
  const s = v.sub;
  return [
    {
      id: `${s}-x`,
      latex: `v_{${s}x} = |v_{${s}}| \\cos\\theta_{${s}}`,
      variables: [v.x, v.mag, v.dir],
      solveFor(target, k) {
        if (target !== v.x) return null;
        return one(
          [multiply(need(k, v.mag), cos(need(k, v.dir)))],
          `v_{${s}x} = |v_{${s}}| \\cos\\theta_{${s}}`,
          [v.mag, v.dir],
        );
      },
    },
    {
      id: `${s}-y`,
      latex: `v_{${s}y} = |v_{${s}}| \\sin\\theta_{${s}}`,
      variables: [v.y, v.mag, v.dir],
      solveFor(target, k) {
        if (target !== v.y) return null;
        return one(
          [multiply(need(k, v.mag), sin(need(k, v.dir)))],
          `v_{${s}y} = |v_{${s}}| \\sin\\theta_{${s}}`,
          [v.mag, v.dir],
        );
      },
    },
    {
      id: `${s}-mag`,
      latex: `|v_{${s}}| = \\sqrt{v_{${s}x}^2 + v_{${s}y}^2}`,
      variables: [v.mag, v.x, v.y],
      solveFor(target, k) {
        if (target !== v.mag) return null;
        return one(
          [hypot(need(k, v.x), need(k, v.y))],
          `|v_{${s}}| = \\sqrt{v_{${s}x}^2 + v_{${s}y}^2}`,
          [v.x, v.y],
        );
      },
    },
    {
      id: `${s}-dir`,
      latex: `\\theta_{${s}} = \\operatorname{atan2}(v_{${s}y},\\, v_{${s}x})`,
      variables: [v.dir, v.x, v.y],
      solveFor(target, k) {
        if (target !== v.dir) return null;
        const x = need(k, v.x);
        const y = need(k, v.y);
        // Both zero: every direction is equally true, so report none.
        if (x.value === 0 && y.value === 0) return null;
        return one(
          [atan2(y, x)],
          `\\theta_{${s}} = \\operatorname{atan2}(v_{${s}y},\\, v_{${s}x})`,
          [v.y, v.x],
        );
      },
    },
    {
      id: `${s}-leg`,
      latex: `v_{${s}y} = \\pm\\sqrt{|v_{${s}}|^2 - v_{${s}x}^2}`,
      variables: [v.y, v.mag, v.x],
      solveFor(target, k) {
        if (target !== v.y) return null;
        const leg = otherLeg(need(k, v.mag), need(k, v.x));
        // A component longer than the magnitude describes no vector.
        if (leg === null) return null;
        return one(
          [leg, negate(leg)],
          `v_{${s}y} = \\pm\\sqrt{|v_{${s}}|^2 - v_{${s}x}^2}`,
          [v.mag, v.x],
        );
      },
    },
  ];
}

/**
 * Displacement over time, per axis.
 *
 * Crossing problems state a distance and a duration rather than a speed — "6 m
 * wide, crossed in 4 s" is how the across-component is given, and without this
 * the two numbers have nowhere to go. Applies to the resultant, since a
 * displacement measured on the ground is what a bystander sees.
 */
function displacementEquation(axis: 'x' | 'y'): Equation {
  const sKey = axis === 'x' ? 'sx' : 'sy';
  const vKey = axis === 'x' ? VR.x : VR.y;
  const latex = `s_${axis} = v_{R${axis}} \\, t`;
  return {
    id: `disp-${axis}`,
    latex,
    variables: [sKey, vKey, 't'],
    solveFor(target, k) {
      switch (target) {
        case sKey:
          return one([multiply(need(k, vKey), need(k, 't'))], latex, [vKey, 't']);
        case vKey: {
          const t = need(k, 't');
          if (t.value === 0) return null;
          return one(
            [divide(need(k, sKey), t)],
            `v_{R${axis}} = \\frac{s_${axis}}{t}`,
            [sKey, 't'],
          );
        }
        case 't': {
          const v = need(k, vKey);
          if (v.value === 0) return null;
          return one([divide(need(k, sKey), v)], `t = \\frac{s_${axis}}{v_{R${axis}}}`, [
            sKey,
            vKey,
          ]);
        }
        default:
          return null;
      }
    },
  };
}

/** Componentwise composition: the whole point of the domain. */
function compositionEquation(axis: 'x' | 'y'): Equation {
  const r = axis === 'x' ? VR.x : VR.y;
  const a = axis === 'x' ? V1.x : V1.y;
  const b = axis === 'x' ? V2.x : V2.y;
  const latex = `v_{R${axis}} = v_{1${axis}} + v_{2${axis}}`;
  return {
    id: `sum-${axis}`,
    latex,
    variables: [r, a, b],
    solveFor(target, k) {
      switch (target) {
        case r:
          return one([add(need(k, a), need(k, b))], latex, [a, b]);
        case a:
          return one([subtract(need(k, r), need(k, b))], `v_{1${axis}} = v_{R${axis}} - v_{2${axis}}`, [r, b]);
        case b:
          return one([subtract(need(k, r), need(k, a))], `v_{2${axis}} = v_{R${axis}} - v_{1${axis}}`, [r, a]);
        default:
          return null;
      }
    },
  };
}

const component = (key: VariableKey, symbol: string, latex: string): Variable => ({
  key,
  symbol,
  latex,
  dimension: VELOCITY,
  displayUnit: (kit) => kit.velocity,
});

const direction = (key: VariableKey, symbol: string, latex: string): Variable => ({
  key,
  symbol,
  latex,
  dimension: DIMENSIONLESS,
  displayUnit: (kit) => kit.angle,
});

const displacement = (key: VariableKey, symbol: string, latex: string): Variable => ({
  key,
  symbol,
  latex,
  dimension: LENGTH,
  displayUnit: (kit) => kit.length,
});

export const variables: Variable[] = [
  component('v1x', 'v₁ₓ', 'v_{1x}'),
  {
    ...component('v1y', 'v₁ᵧ', 'v_{1y}'),
    // The orientation choice, and the only one. See the note at the top: it
    // exists to break the ± tie when a heading is recovered from a magnitude
    // and one component, and it prunes rather than forbids.
    physical: {
      accepts: (q: Quantity) => q.value >= -1e-9,
      reason: '+y is the direction of travel, so the across-component is never negative',
    },
  },
  component('v1', '|v₁|', '|v_1|'),
  direction('th1', 'θ₁', '\\theta_1'),

  component('v2x', 'v₂ₓ', 'v_{2x}'),
  component('v2y', 'v₂ᵧ', 'v_{2y}'),
  component('v2', '|v₂|', '|v_2|'),
  direction('th2', 'θ₂', '\\theta_2'),

  component('vrx', 'v_Rx', 'v_{Rx}'),
  component('vry', 'v_Ry', 'v_{Ry}'),
  component('vr', '|v_R|', '|v_R|'),
  direction('thr', 'θ_R', '\\theta_R'),

  // How far the resultant carries the body, and over how long. A river's width
  // and the time to cross are stated far more often than the speed itself.
  displacement('sx', 'sₓ', 's_x'),
  displacement('sy', 'sᵧ', 's_y'),
  {
    key: 't',
    symbol: 't',
    latex: 't',
    dimension: TIME,
    displayUnit: (kit) => kit.time,
    physical: {
      accepts: (q: Quantity) => q.value >= -1e-9,
      reason: 'time cannot run backwards',
    },
  },
];

export const relativeVelocity2D: Domain = {
  id: 'relative-velocity-2d',
  name: '2-D Relative Velocity',
  variables,
  equations: [
    compositionEquation('x'),
    compositionEquation('y'),
    displacementEquation('x'),
    displacementEquation('y'),
    ...vectorEquations(V1),
    ...vectorEquations(V2),
    ...vectorEquations(VR),
  ],
};
