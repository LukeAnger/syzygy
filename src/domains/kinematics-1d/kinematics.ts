/**
 * One-dimensional constant-acceleration kinematics (SUVAT).
 *
 * Core variables — v₀, v, a, t, Δx — related by five equations, each omitting
 * one variable. Given any three knowns the solver derives the rest. Free fall
 * is just this domain with `a` preset to gravity.
 *
 * Displacement Δx is modelled as the difference of an initial and final
 * position (Δx = x₂ − x₁) rather than a single quantity. This matches how
 * problems are actually stated ("dropped from 100 m, lands on a 4 m truck"):
 * the parser extracts two positions and the solver computes the displacement,
 * instead of guessing that any distance is the displacement.
 *
 * Each equation exposes closed forms for every variable it relates, written
 * directly as operations over dimensioned Quantities from the math core. A form
 * returns `null` where it cannot yield a real value (zero divisor, negative
 * discriminant) so the solver falls through to another equation.
 */
import {
  ACCELERATION,
  GRAVITY,
  LENGTH,
  TIME,
  VELOCITY,
  add,
  divide,
  multiply,
  negate,
  pow,
  scalar,
  sqrt,
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

const HALF = scalar(0.5);
const TWO = scalar(2);

/** Time cannot run backwards; a tiny epsilon tolerates round-off at t ≈ 0. */
const NON_NEGATIVE_TIME = {
  accepts: (q: Quantity) => q.value >= -1e-9,
  reason: 'time cannot be negative',
};

export const variables: Variable[] = [
  {
    key: 'v0',
    symbol: 'v₀',
    latex: 'v_0',
    dimension: VELOCITY,
    displayUnit: (kit) => kit.velocity,
  },
  {
    key: 'v',
    symbol: 'v',
    latex: 'v',
    dimension: VELOCITY,
    displayUnit: (kit) => kit.velocity,
  },
  {
    key: 'a',
    symbol: 'a',
    latex: 'a',
    dimension: ACCELERATION,
    displayUnit: (kit) => kit.acceleration,
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
    key: 'x1',
    symbol: 'x₁',
    latex: 'x_1',
    dimension: LENGTH,
    displayUnit: (kit) => kit.length,
  },
  {
    key: 'x2',
    symbol: 'x₂',
    latex: 'x_2',
    dimension: LENGTH,
    displayUnit: (kit) => kit.length,
  },
  {
    key: 'dx',
    symbol: 'Δx',
    latex: '\\Delta x',
    dimension: LENGTH,
    displayUnit: (kit) => kit.length,
  },
];

const one = (
  roots: Quantity[],
  rearrangedLatex: string,
  inputs: VariableKey[],
): EquationSolution => ({ roots, rearrangedLatex, inputs });

// Position: Δx = x₂ − x₁   (relates displacement to the two positions)
const positionEq: Equation = {
  id: 'position',
  latex: '\\Delta x = x_2 - x_1',
  variables: ['dx', 'x1', 'x2'],
  solveFor(target, k) {
    switch (target) {
      case 'dx':
        return one(
          [subtract(need(k, 'x2'), need(k, 'x1'))],
          '\\Delta x = x_2 - x_1',
          ['x2', 'x1'],
        );
      case 'x1':
        return one(
          [subtract(need(k, 'x2'), need(k, 'dx'))],
          'x_1 = x_2 - \\Delta x',
          ['x2', 'dx'],
        );
      case 'x2':
        return one(
          [add(need(k, 'x1'), need(k, 'dx'))],
          'x_2 = x_1 + \\Delta x',
          ['x1', 'dx'],
        );
      default:
        return null;
    }
  },
};

// Eq1: v = v₀ + a·t   (omits Δx)
const eq1: Equation = {
  id: 'eq1',
  latex: 'v = v_0 + a t',
  variables: ['v', 'v0', 'a', 't'],
  solveFor(target, k) {
    switch (target) {
      case 'v':
        return one(
          [add(need(k, 'v0'), multiply(need(k, 'a'), need(k, 't')))],
          'v = v_0 + a t',
          ['v0', 'a', 't'],
        );
      case 'v0':
        return one(
          [subtract(need(k, 'v'), multiply(need(k, 'a'), need(k, 't')))],
          'v_0 = v - a t',
          ['v', 'a', 't'],
        );
      case 'a': {
        const t = need(k, 't');
        if (t.value === 0) return null;
        return one(
          [divide(subtract(need(k, 'v'), need(k, 'v0')), t)],
          'a = \\frac{v - v_0}{t}',
          ['v', 'v0', 't'],
        );
      }
      case 't': {
        const a = need(k, 'a');
        if (a.value === 0) return null;
        return one(
          [divide(subtract(need(k, 'v'), need(k, 'v0')), a)],
          't = \\frac{v - v_0}{a}',
          ['v', 'v0', 'a'],
        );
      }
      default:
        return null;
    }
  },
};

// Eq2: Δx = v₀·t + ½·a·t²   (omits v)
const eq2: Equation = {
  id: 'eq2',
  latex: '\\Delta x = v_0 t + \\tfrac12 a t^2',
  variables: ['dx', 'v0', 'a', 't'],
  solveFor(target, k) {
    switch (target) {
      case 'dx': {
        const t = need(k, 't');
        return one(
          [
            add(
              multiply(need(k, 'v0'), t),
              multiply(HALF, multiply(need(k, 'a'), pow(t, 2))),
            ),
          ],
          '\\Delta x = v_0 t + \\tfrac12 a t^2',
          ['v0', 't', 'a'],
        );
      }
      case 'v0': {
        const t = need(k, 't');
        if (t.value === 0) return null;
        return one(
          [
            divide(
              subtract(
                need(k, 'dx'),
                multiply(HALF, multiply(need(k, 'a'), pow(t, 2))),
              ),
              t,
            ),
          ],
          'v_0 = \\frac{\\Delta x - \\tfrac12 a t^2}{t}',
          ['dx', 'a', 't'],
        );
      }
      case 'a': {
        const t = need(k, 't');
        if (t.value === 0) return null;
        return one(
          [
            divide(
              multiply(TWO, subtract(need(k, 'dx'), multiply(need(k, 'v0'), t))),
              pow(t, 2),
            ),
          ],
          'a = \\frac{2(\\Delta x - v_0 t)}{t^2}',
          ['dx', 'v0', 't'],
        );
      }
      case 't': {
        const a = need(k, 'a');
        const v0 = need(k, 'v0');
        const dx = need(k, 'dx');
        if (a.value === 0) {
          // Degenerates to Δx = v₀·t.
          if (v0.value === 0) return null;
          return one([divide(dx, v0)], 't = \\frac{\\Delta x}{v_0}', ['dx', 'v0']);
        }
        // ½a·t² + v₀·t − Δx = 0  →  t = (−v₀ ± √(v₀² + 2aΔx)) / a
        const disc = add(pow(v0, 2), multiply(TWO, multiply(a, dx)));
        if (disc.value < 0) return null;
        const root = sqrt(disc);
        return one(
          [
            divide(add(negate(v0), root), a),
            divide(subtract(negate(v0), root), a),
          ],
          't = \\frac{-v_0 \\pm \\sqrt{v_0^2 + 2 a \\Delta x}}{a}',
          ['v0', 'a', 'dx'],
        );
      }
      default:
        return null;
    }
  },
};

// Eq3: Δx = ½·(v₀ + v)·t   (omits a)
const eq3: Equation = {
  id: 'eq3',
  latex: '\\Delta x = \\tfrac12 (v_0 + v) t',
  variables: ['dx', 'v0', 'v', 't'],
  solveFor(target, k) {
    switch (target) {
      case 'dx':
        return one(
          [
            multiply(
              HALF,
              multiply(add(need(k, 'v0'), need(k, 'v')), need(k, 't')),
            ),
          ],
          '\\Delta x = \\tfrac12 (v_0 + v) t',
          ['v0', 'v', 't'],
        );
      case 'v0': {
        const t = need(k, 't');
        if (t.value === 0) return null;
        return one(
          [subtract(divide(multiply(TWO, need(k, 'dx')), t), need(k, 'v'))],
          'v_0 = \\frac{2 \\Delta x}{t} - v',
          ['dx', 't', 'v'],
        );
      }
      case 'v': {
        const t = need(k, 't');
        if (t.value === 0) return null;
        return one(
          [subtract(divide(multiply(TWO, need(k, 'dx')), t), need(k, 'v0'))],
          'v = \\frac{2 \\Delta x}{t} - v_0',
          ['dx', 't', 'v0'],
        );
      }
      case 't': {
        const sum = add(need(k, 'v0'), need(k, 'v'));
        if (sum.value === 0) return null;
        return one(
          [divide(multiply(TWO, need(k, 'dx')), sum)],
          't = \\frac{2 \\Delta x}{v_0 + v}',
          ['dx', 'v0', 'v'],
        );
      }
      default:
        return null;
    }
  },
};

// Eq4: v² = v₀² + 2·a·Δx   (omits t)
const eq4: Equation = {
  id: 'eq4',
  latex: 'v^2 = v_0^2 + 2 a \\Delta x',
  variables: ['v', 'v0', 'a', 'dx'],
  solveFor(target, k) {
    switch (target) {
      case 'v': {
        const disc = add(
          pow(need(k, 'v0'), 2),
          multiply(TWO, multiply(need(k, 'a'), need(k, 'dx'))),
        );
        if (disc.value < 0) return null;
        const root = sqrt(disc);
        return one(
          [root, negate(root)],
          'v = \\pm\\sqrt{v_0^2 + 2 a \\Delta x}',
          ['v0', 'a', 'dx'],
        );
      }
      case 'v0': {
        const disc = subtract(
          pow(need(k, 'v'), 2),
          multiply(TWO, multiply(need(k, 'a'), need(k, 'dx'))),
        );
        if (disc.value < 0) return null;
        const root = sqrt(disc);
        return one(
          [root, negate(root)],
          'v_0 = \\pm\\sqrt{v^2 - 2 a \\Delta x}',
          ['v', 'a', 'dx'],
        );
      }
      case 'a': {
        const dx = need(k, 'dx');
        if (dx.value === 0) return null;
        return one(
          [
            divide(
              subtract(pow(need(k, 'v'), 2), pow(need(k, 'v0'), 2)),
              multiply(TWO, dx),
            ),
          ],
          'a = \\frac{v^2 - v_0^2}{2 \\Delta x}',
          ['v', 'v0', 'dx'],
        );
      }
      case 'dx': {
        const a = need(k, 'a');
        if (a.value === 0) return null;
        return one(
          [
            divide(
              subtract(pow(need(k, 'v'), 2), pow(need(k, 'v0'), 2)),
              multiply(TWO, a),
            ),
          ],
          '\\Delta x = \\frac{v^2 - v_0^2}{2 a}',
          ['v', 'v0', 'a'],
        );
      }
      default:
        return null;
    }
  },
};

// Eq5: Δx = v·t − ½·a·t²   (omits v₀)
const eq5: Equation = {
  id: 'eq5',
  latex: '\\Delta x = v t - \\tfrac12 a t^2',
  variables: ['dx', 'v', 'a', 't'],
  solveFor(target, k) {
    switch (target) {
      case 'dx': {
        const t = need(k, 't');
        return one(
          [
            subtract(
              multiply(need(k, 'v'), t),
              multiply(HALF, multiply(need(k, 'a'), pow(t, 2))),
            ),
          ],
          '\\Delta x = v t - \\tfrac12 a t^2',
          ['v', 't', 'a'],
        );
      }
      case 'v': {
        const t = need(k, 't');
        if (t.value === 0) return null;
        return one(
          [
            divide(
              add(
                need(k, 'dx'),
                multiply(HALF, multiply(need(k, 'a'), pow(t, 2))),
              ),
              t,
            ),
          ],
          'v = \\frac{\\Delta x + \\tfrac12 a t^2}{t}',
          ['dx', 'a', 't'],
        );
      }
      case 'a': {
        const t = need(k, 't');
        if (t.value === 0) return null;
        return one(
          [
            divide(
              multiply(TWO, subtract(multiply(need(k, 'v'), t), need(k, 'dx'))),
              pow(t, 2),
            ),
          ],
          'a = \\frac{2(v t - \\Delta x)}{t^2}',
          ['v', 'dx', 't'],
        );
      }
      case 't': {
        const a = need(k, 'a');
        const v = need(k, 'v');
        const dx = need(k, 'dx');
        if (a.value === 0) {
          if (v.value === 0) return null;
          return one([divide(dx, v)], 't = \\frac{\\Delta x}{v}', ['dx', 'v']);
        }
        // ½a·t² − v·t + Δx = 0  →  t = (v ± √(v² − 2aΔx)) / a
        const disc = subtract(pow(v, 2), multiply(TWO, multiply(a, dx)));
        if (disc.value < 0) return null;
        const root = sqrt(disc);
        return one(
          [divide(add(v, root), a), divide(subtract(v, root), a)],
          't = \\frac{v \\pm \\sqrt{v^2 - 2 a \\Delta x}}{a}',
          ['v', 'a', 'dx'],
        );
      }
      default:
        return null;
    }
  },
};

export const kinematics1D: Domain = {
  id: 'kinematics-1d',
  name: '1-D Kinematics',
  variables,
  equations: [positionEq, eq1, eq2, eq3, eq4, eq5],
};

/** Acceleration preset for free-fall problems (this domain with `a` = gravity). */
export const FREE_FALL_ACCELERATION: Quantity = GRAVITY;
