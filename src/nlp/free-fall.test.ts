import { describe, expect, it } from 'vitest';
import { CORPUS } from './corpus.ts';
import { describesFreeFall } from './free-fall.ts';

describe('describesFreeFall', () => {
  /**
   * The ratchet that keeps the cue list wide enough.
   *
   * Every hand-written corpus case is a falling-object problem, so every one of
   * them must keep its gravity. Narrow the list too far and this fails loudly,
   * instead of quietly turning solvable problems into "not enough information".
   */
  it.each(CORPUS.map((c) => [c.id, c.text] as const))(
    'recognises corpus case %s',
    (_id, text) => {
      expect(describesFreeFall(text)).toBe(true);
    },
  );

  it('reads a bare drop', () => {
    expect(describesFreeFall('A ball is dropped from a height of 45 m')).toBe(true);
  });

  it('reads a landing surface as implying something was above it', () => {
    expect(describesFreeFall('it hits the pavement at 30 m/s')).toBe(true);
  });

  it('reads a place you fall off, without the word', () => {
    expect(describesFreeFall('a stone leaves the roof at 5 m/s')).toBe(true);
  });
});

/**
 * The cases that motivated the gate. Each one used to be handed `a = −9.81`.
 */
describe('refusing gravity where there is none', () => {
  it('leaves a puck sliding on ice alone', () => {
    expect(
      describesFreeFall(
        'In a skills competition, a hockey player is skating across the ice at ' +
          'a velocity Vh and tries to hit a target with the puck.',
      ),
    ).toBe(false);
  });

  /** "Thrown" is why throwing verbs are not cues: this one is sideways. */
  it('leaves newspapers thrown sideways from a car alone', () => {
    expect(
      describesFreeFall(
        'A car is driving down the road at a velocity Vc and is delivering ' +
          'newspapers to homes. The newspapers are thrown at a velocity of Vp ' +
          'relative to the car.',
      ),
    ).toBe(false);
  });

  it('leaves a car accelerating along a road alone', () => {
    expect(
      describesFreeFall('A car reaches 30 m/s in 5 s. How far does it travel?'),
    ).toBe(false);
  });

  it('leaves two trains on a line alone', () => {
    expect(
      describesFreeFall('Two trains 600 m apart travel towards each other at 30 m/s'),
    ).toBe(false);
  });
});
