import { describe, expect, it } from 'vitest';
import { DEGREE, toUnit } from '../math/index.ts';
import { solve } from '../engine/index.ts';
import { relativeVelocity2D } from '../domains/relative-velocity-2d/index.ts';
import { detectDomain } from './domain.ts';
import { parse, toKnowns } from './parse.ts';

const read = (text: string) => parse(text, 'relative-velocity-2d');
const valueOf = (text: string, key: string) =>
  read(text).assignments.find((a) => a.variable === key)?.quantity.value;

/** Parse and solve the way the app does, so the test covers the seam too. */
function work(text: string) {
  const result = read(text);
  const solved = solve(relativeVelocity2D, toKnowns(result.assignments));
  return { ...result, knowns: solved.knowns };
}

const DUCK =
  'A duck swims at a constant speed from one side of a river to the other ' +
  'side in a time of 4 seconds. The river is 6 meters wide and it is flowing ' +
  'at a speed of 2 m/s. What is the velocity of the duck and what is its ' +
  'direction of travel, with respect to ground?';

describe('reading a river crossing', () => {
  it('routes the duck problem to the planar domain', () => {
    expect(detectDomain(DUCK)).toBe('relative-velocity-2d');
  });

  /**
   * The end-to-end case this grammar exists for. Nothing in the text states a
   * velocity component: 1.5 m/s across has to come from 6 m and 4 s, and the
   * frame zeros have to come from the crossing itself.
   */
  it('solves the duck problem from prose alone', () => {
    const { knowns, target } = work(DUCK);

    expect(knowns['sy']?.value).toBe(6);
    expect(knowns['t']?.value).toBe(4);
    expect(knowns['v2x']?.value).toBe(2);
    expect(knowns['v2y']?.value).toBe(0);
    expect(knowns['v1x']?.value).toBe(0);

    expect(knowns['vry']?.value).toBeCloseTo(1.5, 9);
    expect(knowns['vr']?.value).toBeCloseTo(2.5, 9);
    expect(toUnit(knowns['thr']!, DEGREE)).toBeCloseTo(36.87, 2);
    expect(target).toBe('thr');
  });

  it('leaves no number unplaced', () => {
    expect(read(DUCK).unusedNumbers).toEqual([]);
  });

  it('reads a width stated before its cue', () => {
    expect(valueOf('A boat crosses the river, which is 80 m wide, in a 3 m/s current', 'sy')).toBe(80);
  });

  it('reads a current stated before its cue', () => {
    expect(valueOf('She swims straight across in a 2 m/s current', 'v2x')).toBe(2);
  });

  it('reads a speed given relative to the water', () => {
    expect(
      valueOf('A boat that does 4 m/s in still water heads straight across a 1 m/s stream', 'v1y'),
    ).toBe(4);
  });
});

/**
 * The distinction the whole grammar turns on. Both stories use nearly the same
 * words; reading one as the other produces a confident wrong answer.
 */
describe('drift versus compensation', () => {
  const DRIFT =
    'A swimmer who can swim at 1.2 m/s heads straight across a river 30 m ' +
    'wide flowing at 0.5 m/s. At what angle does she travel?';
  const COMPENSATE =
    'A swimmer who can swim at 1.2 m/s must head upstream to land directly ' +
    'opposite across a river 30 m wide flowing at 0.5 m/s. At what angle ' +
    'must she head?';

  it('gives a drifting swimmer no downstream speed of her own', () => {
    const { knowns } = work(DRIFT);
    expect(knowns['v1x']?.value).toBe(0);
    expect(knowns['v1y']?.value).toBe(1.2);
    // Carried downstream: the resultant does have an x-component.
    expect(knowns['vrx']?.value).toBe(0.5);
    expect(toUnit(knowns['thr']!, DEGREE)).toBeCloseTo(67.38, 2);
  });

  it('gives a compensating swimmer no downstream drift at all', () => {
    const { knowns, target } = work(COMPENSATE);
    expect(knowns['vrx']?.value).toBe(0);
    // Her heading is the unknown, so her speed is filed as a magnitude...
    expect(knowns['v1']?.value).toBe(1.2);
    // ...and the angle asked for is the one she must aim, not the one she makes.
    expect(target).toBe('th1');

    // She must aim upstream hard enough to cancel the current exactly.
    expect(knowns['v1x']?.value).toBeCloseTo(-0.5, 9);
    // 24.62° upstream of straight across, which is 114.62° from downstream.
    expect(toUnit(knowns['th1']!, DEGREE)).toBeCloseTo(114.62, 2);
    // And the crossing then takes 30 m ÷ 1.09 m/s.
    expect(knowns['t']?.value).toBeCloseTo(27.5, 1);
  });

  it('asks for the resultant heading when she is drifting', () => {
    expect(work(DRIFT).target).toBe('thr');
  });
});

describe('staying out of other domains', () => {
  it('does not claim a free-fall problem that mentions wind', () => {
    expect(
      detectDomain('A ball is dropped from 45 m at 0 m/s; ignore wind resistance'),
    ).toBe('kinematics-1d');
  });

  it('does not claim a crossing with no moving medium', () => {
    expect(
      detectDomain('A student walks straight across a 4 m room at 1.5 m/s'),
    ).toBe('kinematics-1d');
  });

  it('leaves two trains on a line in the 1-D domain', () => {
    expect(
      detectDomain('Two trains 600 m apart travel towards each other at 30 m/s and 20 m/s'),
    ).toBe('relative-velocity');
  });
});
