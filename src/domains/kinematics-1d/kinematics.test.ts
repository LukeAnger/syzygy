import { describe, expect, it } from 'vitest';
import {
  ACCELERATION,
  LENGTH,
  SECOND,
  TIME,
  VELOCITY,
  dimensionsEqual,
  formatQuantity,
  quantity,
  unitKit,
} from '../../math/index.ts';
import type { Equation, Knowns } from '../../engine/index.ts';
import { solve } from '../../engine/index.ts';
import { FREE_FALL_ACCELERATION, kinematics1D, variables } from './kinematics.ts';

const V = (x: number) => quantity(x, VELOCITY);
const A = (x: number) => quantity(x, ACCELERATION);
const T = (x: number) => quantity(x, TIME);
const X = (x: number) => quantity(x, LENGTH);

function eqById(id: string): Equation {
  const eq = kinematics1D.equations.find((e) => e.id === id);
  if (!eq) throw new Error(`no equation ${id}`);
  return eq;
}

// A single consistent motion: v₀=2, v=14, a=3, t=4, Δx=32 (all SI, dimensioned).
const base: Knowns = { v0: V(2), v: V(14), a: A(3), t: T(4), dx: X(32) };

function single(eq: Equation, target: string, knowns: Knowns, expected: number) {
  const s = eq.solveFor(target, knowns);
  expect(s, `${eq.id} solveFor ${target}`).not.toBeNull();
  expect(s!.roots).toHaveLength(1);
  expect(s!.roots[0]!.value).toBeCloseTo(expected, 6);
}

function nullFor(eq: Equation, target: string, knowns: Knowns) {
  expect(eq.solveFor(target, knowns)).toBeNull();
}

describe('eq1: v = v₀ + a t', () => {
  const eq = eqById('eq1');
  it('solves each variable', () => {
    single(eq, 'v', base, 14);
    single(eq, 'v0', base, 2);
    single(eq, 'a', base, 3);
    single(eq, 't', base, 4);
  });
  it('carries the right dimension', () => {
    expect(dimensionsEqual(eq.solveFor('v', base)!.roots[0]!.dimension, VELOCITY)).toBe(true);
  });
  it('returns null on degenerate inputs', () => {
    nullFor(eq, 'a', { ...base, t: T(0) });
    nullFor(eq, 't', { ...base, a: A(0) });
    nullFor(eq, 'dx', base); // not related by this equation
  });
});

describe('eq2: Δx = v₀ t + ½ a t²', () => {
  const eq = eqById('eq2');
  it('solves the linear variables', () => {
    single(eq, 'dx', base, 32);
    single(eq, 'v0', base, 2);
    single(eq, 'a', base, 3);
  });
  it('solves the quadratic for t (two roots)', () => {
    const s = eq.solveFor('t', base)!;
    expect(s.roots.map((r) => r.value)).toHaveLength(2);
    expect(s.roots[0]!.value).toBeCloseTo(4, 6);
    expect(s.roots[1]!.value).toBeCloseTo(-16 / 3, 6);
    expect(dimensionsEqual(s.roots[0]!.dimension, TIME)).toBe(true);
  });
  it('handles the a = 0 linear degenerate for t', () => {
    single(eq, 't', { ...base, a: A(0), dx: X(8) }, 4);
    nullFor(eq, 't', { ...base, a: A(0), v0: V(0) });
  });
  it('returns null on zero divisors and negative discriminant', () => {
    nullFor(eq, 'v0', { ...base, t: T(0) });
    nullFor(eq, 'a', { ...base, t: T(0) });
    nullFor(eq, 't', { v0: V(1), a: A(-1), dx: X(10) });
    nullFor(eq, 'v', base); // not related
  });
});

describe('eq3: Δx = ½ (v₀ + v) t', () => {
  const eq = eqById('eq3');
  it('solves each variable', () => {
    single(eq, 'dx', base, 32);
    single(eq, 'v0', base, 2);
    single(eq, 'v', base, 14);
    single(eq, 't', base, 4);
  });
  it('returns null on zero divisors', () => {
    nullFor(eq, 'v0', { ...base, t: T(0) });
    nullFor(eq, 'v', { ...base, t: T(0) });
    nullFor(eq, 't', { ...base, v0: V(5), v: V(-5) });
    nullFor(eq, 'a', base); // not related
  });
});

describe('eq4: v² = v₀² + 2 a Δx', () => {
  const eq = eqById('eq4');
  it('solves the ± roots for v and v₀', () => {
    const v = eq.solveFor('v', base)!;
    expect(v.roots.map((r) => r.value)).toEqual([14, -14]);
    const v0 = eq.solveFor('v0', base)!;
    expect(v0.roots.map((r) => r.value)).toEqual([2, -2]);
  });
  it('solves a and Δx', () => {
    single(eq, 'a', base, 3);
    single(eq, 'dx', base, 32);
  });
  it('returns null on negative discriminant and zero divisors', () => {
    nullFor(eq, 'v', { v0: V(1), a: A(-1), dx: X(10) });
    nullFor(eq, 'v0', { v: V(1), a: A(1), dx: X(10) });
    nullFor(eq, 'a', { ...base, dx: X(0) });
    nullFor(eq, 'dx', { ...base, a: A(0) });
    nullFor(eq, 't', base); // not related
  });
});

describe('eq5: Δx = v t - ½ a t²', () => {
  const eq = eqById('eq5');
  it('solves the linear variables', () => {
    single(eq, 'dx', base, 32);
    single(eq, 'v', base, 14);
    single(eq, 'a', base, 3);
  });
  it('solves the quadratic for t (two roots)', () => {
    const s = eq.solveFor('t', base)!;
    expect(s.roots[0]!.value).toBeCloseTo(16 / 3, 6);
    expect(s.roots[1]!.value).toBeCloseTo(4, 6);
  });
  it('handles the a = 0 linear degenerate for t', () => {
    single(eq, 't', { ...base, a: A(0), dx: X(28) }, 2);
    nullFor(eq, 't', { ...base, a: A(0), v: V(0) });
  });
  it('returns null on zero divisors and negative discriminant', () => {
    nullFor(eq, 'v', { ...base, t: T(0) });
    nullFor(eq, 'a', { ...base, t: T(0) });
    nullFor(eq, 't', { v: V(1), a: A(1), dx: X(10) });
    nullFor(eq, 'v0', base); // not related (eq5 omits v₀)
  });
});

describe('variables', () => {
  it('map to metric display units', () => {
    const kit = unitKit('metric');
    const bySymbol = Object.fromEntries(
      variables.map((v) => [v.key, v.displayUnit(kit).symbol]),
    );
    expect(bySymbol).toEqual({
      v0: 'm/s',
      v: 'm/s',
      a: 'm/s²',
      t: 's',
      dx: 'm',
    });
  });

  it('map to imperial display units', () => {
    const kit = unitKit('imperial');
    const bySymbol = Object.fromEntries(
      variables.map((v) => [v.key, v.displayUnit(kit).symbol]),
    );
    expect(bySymbol).toEqual({
      v0: 'ft/s',
      v: 'ft/s',
      a: 'ft/s²',
      t: 's',
      dx: 'ft',
    });
  });
});

describe('solve() end-to-end', () => {
  it('reproduces the legacy example (v₀, v, a → t, Δx)', () => {
    const result = solve(kinematics1D, { v0: V(-40), v: V(-80), a: A(-9.82) });

    expect(result.unsolved).toEqual([]);
    expect(result.knowns['t']?.value).toBeCloseTo(4.0733, 3);
    expect(result.knowns['dx']?.value).toBeCloseTo(-244.35, 1);
    expect(formatQuantity(result.knowns['t']!, SECOND)).toBe('4.07 s');
  });

  it('picks the physical root and correct signs (v₀, Δx, a → t, v)', () => {
    const result = solve(kinematics1D, { v0: V(40), dx: X(-200), a: A(-9.82) });

    expect(result.knowns['t']?.value).toBeCloseTo(11.6446, 3);
    // Thrown up but ending 200 m below start ⇒ moving downward at impact.
    expect(result.knowns['v']?.value).toBeCloseTo(-74.35, 1);

    const tStep = result.steps.find((s) => s.target === 't')!;
    expect(tStep.discarded).toHaveLength(1);
    expect(tStep.discarded[0]!.value.value).toBeCloseTo(-3.498, 2);
    expect(tStep.discarded[0]!.reason).toBe('time cannot be negative');
  });

  it('exposes gravity as the free-fall preset', () => {
    expect(FREE_FALL_ACCELERATION.value).toBe(-9.81);
    expect(dimensionsEqual(FREE_FALL_ACCELERATION.dimension, ACCELERATION)).toBe(
      true,
    );
  });
});
