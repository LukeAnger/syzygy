/**
 * Engine mechanics, tested against a tiny synthetic domain so the solver's
 * behaviour is isolated from any real physics.
 *
 * Domain: areas p, q, r (dimension L²) and a length n (L), related by
 *   E1: r = p + q
 *   E2: r = n²   (so n = ±√r)
 */
import { describe, expect, it } from 'vitest';
import { LENGTH, dimension, quantity, sqrt, add, subtract, pow } from '../math/index.ts';
import type { Domain, Equation, Variable } from './types.ts';
import { solve } from './solver.ts';

const AREA = dimension({ L: 2 });
const area = (v: number) => quantity(v, AREA);
const length = (v: number) => quantity(v, LENGTH);

const areaVar = (key: string): Variable => ({
  key,
  symbol: key,
  latex: key,
  dimension: AREA,
  displayUnit: (kit) => kit.length,
});

function makeDomain(constrainN: boolean): Domain {
  const nVar: Variable = {
    key: 'n',
    symbol: 'n',
    latex: 'n',
    dimension: LENGTH,
    displayUnit: (kit) => kit.length,
    ...(constrainN
      ? {
          physical: {
            accepts: (q) => q.value >= 0,
            reason: 'n must be non-negative',
          },
        }
      : {}),
  };

  const e1: Equation = {
    id: 'e1',
    latex: 'r = p + q',
    variables: ['r', 'p', 'q'],
    solveFor(target, k) {
      switch (target) {
        case 'r':
          return { roots: [add(k['p']!, k['q']!)], rearrangedLatex: 'r = p + q', inputs: ['p', 'q'] };
        case 'p':
          return { roots: [subtract(k['r']!, k['q']!)], rearrangedLatex: 'p = r - q', inputs: ['r', 'q'] };
        case 'q':
          return { roots: [subtract(k['r']!, k['p']!)], rearrangedLatex: 'q = r - p', inputs: ['r', 'p'] };
        default:
          return null;
      }
    },
  };

  const e2: Equation = {
    id: 'e2',
    latex: 'r = n^2',
    variables: ['r', 'n'],
    solveFor(target, k) {
      switch (target) {
        case 'n': {
          const root = sqrt(k['r']!);
          return { roots: [root, { value: -root.value, dimension: root.dimension }], rearrangedLatex: 'n = \\pm\\sqrt{r}', inputs: ['r'] };
        }
        case 'r':
          return { roots: [pow(k['n']!, 2)], rearrangedLatex: 'r = n^2', inputs: ['n'] };
        default:
          return null;
      }
    },
  };

  return {
    id: 'synthetic',
    name: 'Synthetic',
    variables: [areaVar('p'), areaVar('q'), areaVar('r'), nVar],
    equations: [e1, e2],
  };
}

describe('solve', () => {
  it('propagates knowns across equations (p,q → r → n)', () => {
    const result = solve(makeDomain(true), { p: area(9), q: area(16) });

    expect(result.knowns['r']?.value).toBe(25);
    expect(result.knowns['n']?.value).toBe(5);
    expect(result.solvedOrder).toEqual(['r', 'n']);
    expect(result.unsolved).toEqual([]);
    expect(result.steps).toHaveLength(2);
  });

  it('records step provenance (equation id, inputs, result)', () => {
    const result = solve(makeDomain(true), { p: area(9), q: area(16) });
    const rStep = result.steps[0]!;

    expect(rStep.target).toBe('r');
    expect(rStep.equationId).toBe('e1');
    expect(rStep.inputs.map((i) => i.key)).toEqual(['p', 'q']);
    expect(rStep.result.value).toBe(25);
  });

  it('prunes a non-physical root and records it as discarded', () => {
    const result = solve(makeDomain(true), { p: area(9), q: area(16) });
    const nStep = result.steps.find((s) => s.target === 'n')!;

    expect(nStep.result.value).toBe(5);
    expect(nStep.discarded).toHaveLength(1);
    expect(nStep.discarded[0]!.value.value).toBe(-5);
    expect(nStep.discarded[0]!.reason).toBe('n must be non-negative');
    expect(nStep.alternatives).toEqual([]);
  });

  it('keeps a second valid root as an alternative when unconstrained', () => {
    const result = solve(makeDomain(false), { r: area(25) });
    const nStep = result.steps.find((s) => s.target === 'n')!;

    expect(nStep.result.value).toBe(5);
    expect(nStep.alternatives).toHaveLength(1);
    expect(nStep.alternatives[0]!.value).toBe(-5);
    expect(nStep.discarded).toEqual([]);
  });

  it('prefers the most-determined solve (single root before ±root)', () => {
    // Knowns q and r: p is single-root via E1, n is ±root via E2.
    const result = solve(makeDomain(false), { q: area(16), r: area(25) });
    expect(result.solvedOrder[0]).toBe('p');
  });

  it('leaves an under-determined problem partially solved', () => {
    const result = solve(makeDomain(true), { r: area(25) });

    expect(result.knowns['n']?.value).toBe(5);
    expect(result.unsolved.sort()).toEqual(['p', 'q']);
  });

  it('solves nothing when given no knowns', () => {
    const result = solve(makeDomain(true), {});
    expect(result.steps).toEqual([]);
    expect(result.solvedOrder).toEqual([]);
    expect(result.unsolved.sort()).toEqual(['n', 'p', 'q', 'r']);
  });

  it('returns null from an equation for a target it does not relate', () => {
    const domain = makeDomain(true);
    expect(domain.equations.find((e) => e.id === 'e1')!.solveFor('n', {})).toBeNull();
    expect(domain.equations.find((e) => e.id === 'e2')!.solveFor('p', {})).toBeNull();
  });

  it('skips an equation whose solve throws (negative √) and leaves it unsolved', () => {
    // r < 0 makes n = √r throw; the solver catches it and moves on.
    const result = solve(makeDomain(true), { r: area(-4) });
    expect(result.unsolved).toContain('n');
  });

  it('falls back to raw roots when no root is physically admissible', () => {
    const impossible: Variable = {
      key: 'm',
      symbol: 'm',
      latex: 'm',
      dimension: LENGTH,
      displayUnit: (kit) => kit.length,
      physical: { accepts: (q) => q.value > 1000, reason: 'too small' },
    };
    const eq: Equation = {
      id: 'x',
      latex: 'm = 5',
      variables: ['m'],
      solveFor: (target) =>
        target === 'm'
          ? { roots: [length(5)], rearrangedLatex: 'm = 5', inputs: [] }
          : null,
    };
    const domain: Domain = {
      id: 'd',
      name: 'd',
      variables: [impossible],
      equations: [eq],
    };

    const result = solve(domain, {});
    expect(result.knowns['m']?.value).toBe(5);
    expect(result.steps[0]!.discarded).toEqual([]);
  });
});
