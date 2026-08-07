import { describe, expect, it } from 'vitest';
import { detectDomain, isAmbiguousDomain } from './domain.ts';

describe('detectDomain', () => {
  it('reads a two-vehicle problem as relative velocity', () => {
    expect(
      detectDomain(
        'A motorcycle traveling on the highway at a speed of 120 km/h passes a ' +
          'car traveling at a speed of 90 km/h. From the point of view of a ' +
          'passenger on the car, what is the velocity of the motorcycle?',
      ),
    ).toBe('relative-velocity');
  });

  it('reads two trains closing head-on as relative velocity', () => {
    expect(
      detectDomain(
        'Two trains 600 m apart travel towards each other at 30 m/s and 20 m/s. ' +
          'How long before they pass?',
      ),
    ).toBe('relative-velocity');
  });

  it('reads a pursuit as relative velocity', () => {
    expect(
      detectDomain('A car at 30 m/s overtakes a truck moving at 20 m/s'),
    ).toBe('relative-velocity');
  });

  describe('staying in kinematics', () => {
    it('keeps ordinary free fall', () => {
      expect(detectDomain('A ball is dropped from a height of 45 m')).toBe(
        'kinematics-1d',
      );
    });

    /** A passing cue about a *static* marker, and only one speed. */
    it('is not fooled by passing a fixed reference', () => {
      expect(
        detectDomain(
          'A capsule passes a marker 150 m above the shaft floor while already ' +
            'moving downward at 4 m/s, decelerating at 1.2 m/s2 for 6 seconds',
        ),
      ).toBe('kinematics-1d');
    });

    /** Two speeds, but both belong to the same object. */
    it('is not fooled by one object having two speeds', () => {
      expect(
        detectDomain(
          'A pebble leaves her hand at 20 m/s and strikes the pavement ' +
            'travelling at 30 m/s',
        ),
      ).toBe('kinematics-1d');
    });

    it('needs a second speed, not just a cue word', () => {
      expect(detectDomain('Two cars 500 m apart. One travels at 30 m/s.')).toBe(
        'kinematics-1d',
      );
    });
  });
});

describe('isAmbiguousDomain', () => {
  /** A cue without a second speed: worth flagging, not worth acting on. */
  it('flags a two-body hint that did not meet the bar', () => {
    expect(isAmbiguousDomain('Two cars 500 m apart. One travels at 30 m/s.')).toBe(
      true,
    );
  });

  it('does not flag a story with no two-body hint at all', () => {
    expect(isAmbiguousDomain('A ball is dropped from a height of 45 m')).toBe(false);
  });

  it('does not flag a story that was classified as relative velocity', () => {
    expect(
      isAmbiguousDomain('A car at 30 m/s overtakes a truck moving at 20 m/s'),
    ).toBe(false);
  });
});
