import { describe, expect, it } from 'vitest';
import { LENGTH, VELOCITY, quantity } from '../math/index.ts';
import { kinematics1D } from '../domains/kinematics-1d/index.ts';
import { solvePhases } from './phases.ts';
import type { Knowns } from './types.ts';

const m = (v: number) => quantity(v, LENGTH);
const mps = (v: number) => quantity(v, VELOCITY);
const g: Knowns = { a: quantity(-9.81, kinematics1D.variables.find((x) => x.key === 'a')!.dimension) };

describe('solvePhases', () => {
  it('behaves exactly like a bare solve for a single phase', () => {
    const { phases, conflicts } = solvePhases(kinematics1D, [
      { knowns: { ...g, x1: m(45), x2: m(0), v0: mps(0) } },
    ]);
    expect(conflicts).toEqual([]);
    expect(phases[0]!.knowns['v']?.value).toBeCloseTo(-29.71, 2);
  });

  /**
   * The roof problem. Two falls with the ball at rest between them; the answer
   * depends only on the second, so a single-phase model overshoots badly.
   */
  it('solves a rest-linked two-phase fall from the second segment only', () => {
    const { phases, conflicts } = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(150), x2: m(30), v0: mps(0) }, label: 'roof to roof' },
        { knowns: { ...g, x2: m(0) }, label: 'roof to ground' },
      ],
      [{ kind: 'rest' }],
    );

    expect(conflicts).toEqual([]);
    // Phase 2 starts at rest, 30 m up: v = −√(2·9.81·30) ≈ −24.26.
    expect(phases[1]!.knowns['v0']?.value).toBe(0);
    expect(phases[1]!.knowns['x1']?.value).toBe(30);
    expect(phases[1]!.knowns['v']?.value).toBeCloseTo(-24.26, 2);
    // Not the −54.2 a single 150 m fall would give.
    expect(phases[1]!.knowns['v']!.value).toBeGreaterThan(-30);
  });

  it('carries velocity across a continuous boundary', () => {
    const { phases } = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(100), x2: m(80), v0: mps(0) } },
        { knowns: { ...g, x2: m(0) } },
      ],
      [{ kind: 'continuous' }],
    );

    const arriving = phases[0]!.knowns['v']!.value;
    // Uninterrupted, so it departs at exactly the speed it arrived.
    expect(phases[1]!.knowns['v0']!.value).toBeCloseTo(arriving, 9);
    // And an unbroken 100 m fall is what a single phase would have given.
    expect(phases[1]!.knowns['v']?.value).toBeCloseTo(-44.29, 2);
  });

  it('reverses and scales velocity across a bounce', () => {
    const { phases } = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(20), x2: m(0), v0: mps(0) } },
        { knowns: { ...g, x1: m(0), v: mps(0) } },
      ],
      [{ kind: 'reversed', restitution: 0.5 }],
    );

    const arriving = phases[0]!.knowns['v']!.value; // ≈ −19.81
    expect(phases[1]!.knowns['v0']!.value).toBeCloseTo(-arriving * 0.5, 6);
    // Rebounds to a quarter of the drop height: 20 · 0.5² = 5 m.
    expect(phases[1]!.knowns['x2']?.value).toBeCloseTo(5, 2);
  });

  it('propagates a landing height backwards to the previous segment', () => {
    const { phases } = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(150), v0: mps(0) } },
        { knowns: { ...g, x1: m(30), x2: m(0) } }, // only the second start is stated
      ],
      [{ kind: 'rest' }],
    );
    // Phase 1's unstated end is fixed by where phase 2 begins.
    expect(phases[0]!.knowns['x2']?.value).toBe(30);
  });

  it('reports a boundary whose two sides disagree, and still solves', () => {
    const { phases, conflicts } = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(150), x2: m(30), v0: mps(0) } },
        { knowns: { ...g, x1: m(25), x2: m(0) } }, // contradicts x2 = 30
      ],
      [{ kind: 'rest' }],
    );

    // One disagreement, not two — the same boundary seen from both sides.
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.channel).toBe('position');
    expect(conflicts[0]!.link).toBe(0);
    expect(conflicts[0]!.implied.value).toBe(30);
    expect(conflicts[0]!.stated.value).toBe(25);
    // Stated values win over propagated ones; the sequence still resolves.
    expect(phases[1]!.knowns['x1']?.value).toBe(25);
  });

  it('rejects a link count that does not match the phases', () => {
    expect(() =>
      solvePhases(kinematics1D, [{ knowns: g }, { knowns: g }], []),
    ).toThrow(/expected 1 link/);
  });

  it('accepts an empty sequence', () => {
    expect(solvePhases(kinematics1D, []).phases).toEqual([]);
  });

  it('handles three chained segments', () => {
    const { phases, conflicts } = solvePhases(
      kinematics1D,
      [
        { knowns: { ...g, x1: m(100), x2: m(60), v0: mps(0) } },
        { knowns: { ...g, x2: m(20) } },
        { knowns: { ...g, x2: m(0) } },
      ],
      [{ kind: 'rest' }, { kind: 'rest' }],
    );

    expect(conflicts).toEqual([]);
    expect(phases[1]!.knowns['x1']?.value).toBe(60);
    expect(phases[2]!.knowns['x1']?.value).toBe(20);
    // Final segment: rest, 20 m up ⇒ −√(2·9.81·20) ≈ −19.81.
    expect(phases[2]!.knowns['v']?.value).toBeCloseTo(-19.81, 2);
  });
});
