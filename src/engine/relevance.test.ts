import { describe, expect, it } from 'vitest';
import { LENGTH, VELOCITY, quantity } from '../math/index.ts';
import { dependenciesOf, phaseRelevanceFor, relevanceFor } from './relevance.ts';
import { solvePhases } from './phases.ts';
import { kinematics1D } from '../domains/kinematics-1d/index.ts';
import type { SolutionStep, SolveResult, VariableKey } from './types.ts';

/** A step producing `target` from `inputs`; only those two fields matter here. */
function step(target: VariableKey, ...inputs: VariableKey[]): SolutionStep {
  return {
    target,
    equationId: 'eq',
    equationLatex: '',
    rearrangedLatex: '',
    inputs: inputs.map((key) => ({ key, value: quantity(1, LENGTH) })),
    result: quantity(1, LENGTH),
    discarded: [],
    alternatives: [],
  };
}

describe('dependenciesOf', () => {
  it('includes the target itself', () => {
    expect([...dependenciesOf('v', [])]).toEqual(['v']);
  });

  it('follows a chain of derived values back to the givens', () => {
    // dx ← x1,x2 ; t ← dx,v0,a ; v ← v0,a,t
    const steps = [step('dx', 'x1', 'x2'), step('t', 'dx', 'v0', 'a'), step('v', 'v0', 'a', 't')];
    const deps = dependenciesOf('v', steps);
    expect([...deps].sort()).toEqual(['a', 'dx', 't', 'v', 'v0', 'x1', 'x2']);
  });

  it('excludes branches the target never depended on', () => {
    // v comes straight from v0, a, t; the x1/x2 → dx branch is unrelated.
    const steps = [step('dx', 'x1', 'x2'), step('v', 'v0', 'a', 't')];
    const deps = dependenciesOf('v', steps);
    expect(deps.has('x1')).toBe(false);
    expect(deps.has('dx')).toBe(false);
    expect([...deps].sort()).toEqual(['a', 't', 'v', 'v0']);
  });

  it('terminates on a cycle', () => {
    const steps = [step('a', 'b'), step('b', 'a')];
    expect([...dependenciesOf('a', steps)].sort()).toEqual(['a', 'b']);
  });
});

describe('relevanceFor', () => {
  const solveResult = (steps: SolutionStep[], solvedKeys: VariableKey[]): SolveResult => ({
    knowns: Object.fromEntries(solvedKeys.map((k) => [k, quantity(1, VELOCITY)])),
    solvedOrder: steps.map((s) => s.target),
    steps,
    unsolved: [],
  });

  it('separates the givens that carried the answer from those that did not', () => {
    const steps = [step('dx', 'x1', 'x2'), step('v', 'v0', 'a', 't')];
    const relevance = relevanceFor(
      'v',
      ['x1', 'x2', 'v0', 'a', 't'],
      solveResult(steps, ['v', 'dx', 'x1', 'x2', 'v0', 'a', 't']),
    );

    expect(relevance.used).toEqual(['v0', 'a', 't']);
    // Solvable, but the question never needed them.
    expect(relevance.unnecessary).toEqual(['x1', 'x2']);
    expect(relevance.solved).toBe(true);
  });

  it('preserves the order the givens were reported in', () => {
    const relevance = relevanceFor(
      'v',
      ['t', 'a', 'v0'],
      solveResult([step('v', 'v0', 'a', 't')], ['v', 't', 'a', 'v0']),
    );
    expect(relevance.used).toEqual(['t', 'a', 'v0']);
  });

  /** An unfinished derivation proves nothing about what was unnecessary. */
  it('claims nothing is unnecessary when the target is unsolved', () => {
    const relevance = relevanceFor('v', ['x1', 'x2'], solveResult([], ['x1', 'x2']));
    expect(relevance.solved).toBe(false);
    expect(relevance.unnecessary).toEqual([]);
    expect(relevance.used).toEqual([]);
  });

  it('counts a given that is itself the target as used', () => {
    const relevance = relevanceFor('t', ['t', 'x1'], solveResult([], ['t', 'x1']));
    expect(relevance.used).toEqual(['t']);
    expect(relevance.unnecessary).toEqual(['x1']);
  });
});

describe('phaseRelevanceFor', () => {
  const g = { a: quantity(-9.81, kinematics1D.variables.find((v) => v.key === 'a')!.dimension) };
  const m = (v: number) => quantity(v, LENGTH);
  const mps = (v: number) => quantity(v, VELOCITY);

  /**
   * The roof problem. The ball comes to rest on the lower roof and the story
   * states that roof's height, so nothing crosses the boundary in either
   * channel and the first fall cannot reach the answer.
   */
  it('finds the earlier fall irrelevant when the ball comes to rest', () => {
    const solved = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(150), x2: m(30), v0: mps(0) } },
        { knowns: { ...g, x1: m(30), x2: m(0) } },
      ],
      [{ kind: 'rest' }],
    );
    const relevance = phaseRelevanceFor('v', solved, [{ kind: 'rest' }]);

    expect(relevance.answerPhase).toBe(1);
    expect(relevance.needed).toEqual([1]);
    expect(relevance.unnecessary.map((u) => u.phase)).toEqual([0]);
    expect(relevance.unnecessary[0]!.link).toBe('rest');
    expect(relevance.unnecessary[0]!.startWasStated).toBe(true);
  });

  /** Irrelevance is computed, not assumed: without the stated height it matters. */
  it('needs the earlier fall when it supplies the next start height', () => {
    const links = [{ kind: 'rest' as const }];
    const solved = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(150), x2: m(30), v0: mps(0) } },
        { knowns: { ...g, x2: m(0) } }, // start height not stated
      ],
      links,
    );
    const relevance = phaseRelevanceFor('v', solved, links);

    expect(relevance.needed).toEqual([0, 1]);
    expect(relevance.unnecessary).toEqual([]);
  });

  it('needs the earlier fall when velocity carries through', () => {
    const links = [{ kind: 'continuous' as const }];
    const solved = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(150), x2: m(30), v0: mps(0) } },
        { knowns: { ...g, x1: m(30), x2: m(0) } },
      ],
      links,
    );
    const relevance = phaseRelevanceFor('v', solved, links);

    // v0 of the last segment was inherited, so the trace crosses the boundary.
    expect(relevance.needed).toEqual([0, 1]);
    expect(relevance.unnecessary).toEqual([]);
  });

  it('marks every severed segment of a three-phase chain', () => {
    const links = [{ kind: 'rest' as const }, { kind: 'rest' as const }];
    const solved = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(100), x2: m(60), v0: mps(0) } },
        { knowns: { ...g, x1: m(60), x2: m(20) } },
        { knowns: { ...g, x1: m(20), x2: m(0) } },
      ],
      links,
    );
    const relevance = phaseRelevanceFor('v', solved, links);

    expect(relevance.needed).toEqual([2]);
    expect(relevance.unnecessary.map((u) => u.phase)).toEqual([0, 1]);
  });
});
