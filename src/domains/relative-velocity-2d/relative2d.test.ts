import { describe, expect, it } from 'vitest';
import {
  DEGREE,
  DIMENSIONLESS,
  VELOCITY,
  dimensionsEqual,
  fromUnit,
  quantity,
  toUnit,
  unitKit,
} from '../../math/index.ts';
import { solve } from '../../engine/index.ts';
import { relativeVelocity2D } from './relative2d.ts';

const mps = (v: number) => quantity(v, VELOCITY);
const deg = (d: number) => fromUnit(d, DEGREE);
const inDeg = (q: ReturnType<typeof quantity>) => toUnit(q, DEGREE);

const run = (knowns: Record<string, ReturnType<typeof quantity>>) =>
  solve(relativeVelocity2D, knowns);

describe('2-D relative velocity', () => {
  /**
   * The duck problem, from a standard set: 6 m river crossed in 4 s (so 1.5 m/s
   * straight across, +y), flowing at 2 m/s (+x). Published answer 2.5 m/s.
   */
  it('composes a crossing with a current', () => {
    const result = run({ v1x: mps(0), v1y: mps(1.5), v2x: mps(2), v2y: mps(0) });

    expect(result.knowns['vrx']?.value).toBeCloseTo(2, 9);
    expect(result.knowns['vry']?.value).toBeCloseTo(1.5, 9);
    expect(result.knowns['vr']?.value).toBeCloseTo(2.5, 9);
    // 36.87° up from the current, i.e. 53.13° off straight across.
    expect(inDeg(result.knowns['thr']!)).toBeCloseTo(36.87, 2);
  });

  it('resolves a vector given as magnitude and heading', () => {
    const result = run({ v1: mps(10), th1: deg(30) });
    expect(result.knowns['v1x']?.value).toBeCloseTo(8.6603, 4);
    expect(result.knowns['v1y']?.value).toBeCloseTo(5, 4);
  });

  it('round-trips components to polar and back', () => {
    const polar = run({ v1x: mps(3), v1y: mps(4) });
    expect(polar.knowns['v1']?.value).toBeCloseTo(5, 9);
    expect(inDeg(polar.knowns['th1']!)).toBeCloseTo(53.13, 2);

    const back = run({ v1: mps(5), th1: polar.knowns['th1']! });
    expect(back.knowns['v1x']?.value).toBeCloseTo(3, 6);
    expect(back.knowns['v1y']?.value).toBeCloseTo(4, 6);
  });

  /** Subtraction is the same relation read backwards, not a second case. */
  it('recovers one velocity from the resultant and the other', () => {
    // Motorcycle at 120 along +x seen from a car at 90 along +x.
    const result = run({ vrx: mps(120), vry: mps(0), v2x: mps(90), v2y: mps(0) });
    expect(result.knowns['v1x']?.value).toBeCloseTo(30, 9);
    expect(result.knowns['v1']?.value).toBeCloseTo(30, 9);
  });

  it('keeps all four quadrants apart', () => {
    // atan(y/x) would report the same angle for these two.
    const ne = run({ v1x: mps(3), v1y: mps(4) });
    const sw = run({ v1x: mps(-3), v1y: mps(-4) });
    expect(inDeg(ne.knowns['th1']!)).toBeCloseTo(53.13, 2);
    expect(inDeg(sw.knowns['th1']!)).toBeCloseTo(-126.87, 2);
  });

  it('reports no direction for a zero vector', () => {
    const result = run({ v1x: mps(0), v1y: mps(0) });
    expect(result.knowns['v1']?.value).toBe(0);
    expect(result.knowns['th1']).toBeUndefined();
  });

  /**
   * A magnitude plus one component leaves two possible headings, and nothing
   * here can choose. Declining beats picking a quadrant at random.
   */
  it('declines a direction that a single component cannot fix', () => {
    const result = run({ v1: mps(5), v1x: mps(3) });
    expect(result.knowns['th1']).toBeUndefined();
    expect(result.knowns['v1y']).toBeUndefined();
  });

  it('leaves everything unsolved when nothing is known', () => {
    const result = run({});
    expect(result.steps).toEqual([]);
    expect(result.unsolved.length).toBe(relativeVelocity2D.variables.length);
  });
});

describe('domain shape', () => {
  it('treats directions as dimensionless and shows them in degrees', () => {
    for (const key of ['th1', 'th2', 'thr']) {
      const variable = relativeVelocity2D.variables.find((v) => v.key === key)!;
      expect(dimensionsEqual(variable.dimension, DIMENSIONLESS)).toBe(true);
      expect(variable.displayUnit(unitKit('metric')).symbol).toBe('°');
      // Degrees in both systems — nobody states a heading in radians.
      expect(variable.displayUnit(unitKit('imperial')).symbol).toBe('°');
    }
  });

  it('gives every component the active system velocity unit', () => {
    const components = ['v1x', 'v1y', 'v1', 'v2x', 'v2y', 'v2', 'vrx', 'vry', 'vr'];
    for (const key of components) {
      const variable = relativeVelocity2D.variables.find((v) => v.key === key)!;
      expect(dimensionsEqual(variable.dimension, VELOCITY)).toBe(true);
      expect(variable.displayUnit(unitKit('imperial')).symbol).toBe('ft/s');
    }
  });

  it('declares every variable each equation refers to', () => {
    const declared = new Set(relativeVelocity2D.variables.map((v) => v.key));
    for (const equation of relativeVelocity2D.equations) {
      for (const key of equation.variables) expect(declared).toContain(key);
    }
  });

  it('has a unique id per equation', () => {
    const ids = relativeVelocity2D.equations.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declines any target an equation does not relate', () => {
    for (const equation of relativeVelocity2D.equations) {
      expect(equation.solveFor('nonsense', {})).toBeNull();
    }
  });
});
