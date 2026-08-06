import { describe, expect, it } from 'vitest';
import {
  LENGTH,
  TIME,
  VELOCITY,
  dimensionsEqual,
  quantity,
  unitKit,
} from '../../math/index.ts';
import { solve } from '../../engine/index.ts';
import { relativeVelocity } from './relative.ts';

const m = (v: number) => quantity(v, LENGTH);
const mps = (v: number) => quantity(v, VELOCITY);
const s = (v: number) => quantity(v, TIME);

const run = (knowns: Record<string, ReturnType<typeof quantity>>) =>
  solve(relativeVelocity, knowns);

describe('relative velocity', () => {
  /** The canonical problem, and the reason the domain exists. */
  it('times two trains approaching head-on', () => {
    // A at the origin heading right; B 600 m away heading left.
    const result = run({ xa: m(0), xb: m(600), va: mps(30), vb: mps(-20) });

    expect(result.knowns['vrel']?.value).toBe(50); // 30 − (−20), the closing rate
    expect(result.knowns['d']?.value).toBe(600);
    expect(result.knowns['t']?.value).toBeCloseTo(12, 9);
    expect(result.knowns['xm']?.value).toBeCloseTo(360, 9);
  });

  it('agrees with B\'s own account of where they met', () => {
    const result = run({ xa: m(0), xb: m(600), va: mps(30), vb: mps(-20) });
    const t = result.knowns['t']!.value;
    // B travels from 600 at −20 m/s and must arrive at the same place.
    expect(600 + -20 * t).toBeCloseTo(result.knowns['xm']!.value, 9);
  });

  /** Same signed rule, no "subtract the speeds" special case. */
  it('times a pursuit along the same direction', () => {
    const result = run({ xa: m(0), xb: m(100), va: mps(30), vb: mps(20) });

    expect(result.knowns['vrel']?.value).toBe(10);
    expect(result.knowns['t']?.value).toBeCloseTo(10, 9);
    expect(result.knowns['xm']?.value).toBeCloseTo(300, 9);
  });

  /**
   * Separating bodies need no special case: the arithmetic yields a negative
   * time and the physical constraint refuses it, which is the honest answer.
   */
  it('refuses to invent a meeting for bodies moving apart', () => {
    const result = run({ xa: m(0), xb: m(100), va: mps(-10), vb: mps(20) });

    expect(result.knowns['vrel']?.value).toBe(-30);
    expect(result.knowns['t']).toBeUndefined();
    expect(result.unsolved).toContain('t');
  });

  it('offers no meeting time at all rather than a negative one', () => {
    const result = run({ xa: m(0), xb: m(100), va: mps(-10), vb: mps(20) });
    // Not merely flagged — never produced. A time of −3.3 s on screen reads as
    // an answer, which is the failure this whole app is built to avoid.
    expect(result.steps.some((step) => step.target === 't')).toBe(false);
  });

  /** Equal velocities: the gap is constant, so no time can close it. */
  it('finds no meeting time when the gap never changes', () => {
    const result = run({ xa: m(0), xb: m(100), va: mps(25), vb: mps(25) });

    expect(result.knowns['vrel']?.value).toBe(0);
    expect(result.knowns['t']).toBeUndefined();
  });

  it('works backwards from a known meeting time', () => {
    // "They met after 12 s, 600 m apart — how fast were they closing?"
    const result = run({ xa: m(0), xb: m(600), t: s(12) });
    expect(result.knowns['vrel']?.value).toBeCloseTo(50, 9);
  });

  it('recovers one velocity from the other and the closing rate', () => {
    const result = run({ va: mps(30), vrel: mps(50) });
    expect(result.knowns['vb']?.value).toBeCloseTo(-20, 9);
  });

  it('derives a starting position from the separation', () => {
    const result = run({ xb: m(600), d: m(600) });
    expect(result.knowns['xa']?.value).toBeCloseTo(0, 9);
  });

  it('leaves everything unsolved when nothing is known', () => {
    const result = run({});
    expect(result.steps).toEqual([]);
    expect(result.unsolved.length).toBe(relativeVelocity.variables.length);
  });

  it('shows its working with a rearranged form per step', () => {
    const result = run({ xa: m(0), xb: m(600), va: mps(30), vb: mps(-20) });
    for (const step of result.steps) {
      expect(step.equationLatex.length).toBeGreaterThan(0);
      expect(step.rearrangedLatex.length).toBeGreaterThan(0);
      expect(step.inputs.length).toBeGreaterThan(0);
    }
  });
});

describe('solving backwards through the meeting point', () => {
  it('recovers where A started from the meeting point', () => {
    const result = run({ xm: m(360), va: mps(30), t: s(12) });
    expect(result.knowns['xa']?.value).toBeCloseTo(0, 9);
  });

  it("recovers A's velocity from how far it got", () => {
    const result = run({ xm: m(360), xa: m(0), t: s(12) });
    expect(result.knowns['va']?.value).toBeCloseTo(30, 9);
  });

  it('cannot infer a velocity from a zero-length interval', () => {
    // x_m − x_a over t is undefined at t = 0; the equation must decline.
    const step = relativeVelocity.equations
      .find((e) => e.id === 'meeting')!
      .solveFor('va', { xm: m(5), xa: m(0), t: s(0) });
    expect(step).toBeNull();
  });

  it('cannot infer a closing rate from a zero-length interval', () => {
    const step = relativeVelocity.equations
      .find((e) => e.id === 'closing')!
      .solveFor('vrel', { d: m(5), t: s(0) });
    expect(step).toBeNull();
  });
});

describe('domain shape', () => {
  it('offers a display unit of the right dimension in both systems', () => {
    for (const system of ['metric', 'imperial'] as const) {
      const kit = unitKit(system);
      for (const variable of relativeVelocity.variables) {
        const unit = variable.displayUnit(kit);
        expect(
          dimensionsEqual(unit.dimension, variable.dimension),
          `${variable.key} in ${system}`,
        ).toBe(true);
      }
    }
  });

  it('declines any target an equation does not relate', () => {
    for (const equation of relativeVelocity.equations) {
      expect(equation.solveFor('nonsense', {})).toBeNull();
    }
  });

  it('declares every variable each equation refers to', () => {
    const declared = new Set(relativeVelocity.variables.map((v) => v.key));
    for (const equation of relativeVelocity.equations) {
      for (const key of equation.variables) expect(declared).toContain(key);
    }
  });

  it('has a unique id per equation', () => {
    const ids = relativeVelocity.equations.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
