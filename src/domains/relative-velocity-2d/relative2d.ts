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
 */
import {
  DIMENSIONLESS,
  VELOCITY,
  add,
  atan2,
  cos,
  hypot,
  multiply,
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
 * Note what is deliberately missing: recovering a direction from a magnitude
 * and a single component. `cos θ = x / |v|` has two solutions and nothing here
 * can choose between them, so those forms return null and the solver looks for
 * another route rather than guessing a quadrant.
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
  ];
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

export const variables: Variable[] = [
  component('v1x', 'v₁ₓ', 'v_{1x}'),
  component('v1y', 'v₁ᵧ', 'v_{1y}'),
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
];

export const relativeVelocity2D: Domain = {
  id: 'relative-velocity-2d',
  name: '2-D Relative Velocity',
  variables,
  equations: [
    compositionEquation('x'),
    compositionEquation('y'),
    ...vectorEquations(V1),
    ...vectorEquations(V2),
    ...vectorEquations(VR),
  ],
};
