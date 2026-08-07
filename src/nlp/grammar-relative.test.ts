import { describe, expect, it } from 'vitest';
import { KILOMETRE_PER_HOUR, toUnit } from '../math/index.ts';
import { solve } from '../engine/index.ts';
import { relativeVelocity } from '../domains/relative-velocity/index.ts';
import { detectDomain } from './domain.ts';
import { parse, toKnowns } from './parse.ts';
import { defaultTokenizer } from './tokenizer.ts';
import { namedFrame } from './grammar-relative.ts';

const RV1 =
  'A motorcycle traveling on the highway at a speed of 120 km/h passes a car ' +
  'traveling at a speed of 90 km/h. From the point of view of a passenger on ' +
  'the car, what is the velocity of the motorcycle?';

const RV2 =
  'A ball is kicked off the back of a pickup truck traveling at 50 km/h. A ' +
  'pedestrian on the ground sees the ball hit the pavement and then bounce ' +
  'straight up. What was the velocity of the ball relative to the truck?';

function work(text: string) {
  const result = parse(text, 'relative-velocity');
  const solved = solve(relativeVelocity, toKnowns(result.assignments));
  return { ...result, knowns: solved.knowns };
}

const inKph = (text: string, key: string) => {
  const q = work(text).knowns[key];
  return q === undefined ? undefined : toUnit(q, KILOMETRE_PER_HOUR);
};

describe('naming the reference frame', () => {
  it('reads roles out of "of X relative to Y"', () => {
    const frame = namedFrame(defaultTokenizer.tokenize(RV2));
    expect(frame?.subject).toBe('ball');
    expect(frame?.reference).toBe('truck');
  });

  it('takes the head of a compound noun phrase', () => {
    const frame = namedFrame(
      defaultTokenizer.tokenize('the speed of the red ball relative to the pickup truck'),
    );
    expect(frame?.subject).toBe('ball');
    expect(frame?.reference).toBe('truck');
  });

  it('declines when only one role is named', () => {
    expect(namedFrame(defaultTokenizer.tokenize('relative to the truck'))).toBeNull();
  });

  it('ignores a marker whose two sides are the same body', () => {
    expect(
      namedFrame(defaultTokenizer.tokenize('the truck relative to the truck')),
    ).toBeNull();
  });
});

/**
 * The problem this was built for. Two things had to change: the truck is
 * mentioned *first* but is the frame, and the ball's velocity is given in words
 * rather than numbers.
 */
describe('RV2, the pickup truck', () => {
  it('is no longer read as a one-body problem', () => {
    expect(detectDomain(RV2)).toBe('relative-velocity');
  });

  it('puts the stated speed on the truck, not the ball', () => {
    expect(inKph(RV2, 'vb')).toBeCloseTo(50, 9);
  });

  it('reads "bounce straight up" as no motion along the line', () => {
    expect(inKph(RV2, 'va')).toBe(0);
  });

  /** 50 km/h, opposite to the truck's travel — the published answer. */
  it('answers the question asked', () => {
    const { knowns, target } = work(RV2);
    expect(target).toBe('vrel');
    expect(toUnit(knowns['vrel']!, KILOMETRE_PER_HOUR)).toBeCloseTo(-50, 9);
  });
});

/**
 * The named frame runs first, so the problem word order already handled has to
 * come out unchanged — and this one names no frame, so it should fall straight
 * through to the positional rule.
 */
describe('RV1 still reads positionally', () => {
  it('keeps the motorcycle as body A', () => {
    expect(inKph(RV1, 'va')).toBeCloseTo(120, 9);
    expect(inKph(RV1, 'vb')).toBeCloseTo(90, 9);
  });

  it('still answers 30 km/h', () => {
    expect(inKph(RV1, 'vrel')).toBeCloseTo(30, 9);
  });
});

describe('not overreaching', () => {
  /** A stillness phrase in a one-object story must not pull it across. */
  it('leaves a free-fall story in kinematics', () => {
    expect(
      detectDomain('A ball is released at rest and falls 45 m to the ground'),
    ).toBe('kinematics-1d');
  });

  it('still needs a two-body cue, not just a frame phrase', () => {
    expect(detectDomain('A ball is dropped from a height of 45 m')).toBe(
      'kinematics-1d',
    );
  });

  it('leaves two trains closing head-on on the positional path', () => {
    expect(
      detectDomain('Two trains 600 m apart travel towards each other at 30 m/s and 20 m/s'),
    ).toBe('relative-velocity');
  });
});
