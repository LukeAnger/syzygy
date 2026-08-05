import { describe, expect, it } from 'vitest';
import { describesStages, segmentPhases } from './segment.ts';

const ROOF =
  'a ball is dropped off a roof at 150m then falls on another roof thats 30m ' +
  'high. the ball then rolls off and falls to the ground. how fast is the ball ' +
  'traveling when it hits the ground?';

describe('segmentPhases', () => {
  it('splits a chain of heights into consecutive falls', () => {
    const segmentation = segmentPhases(ROOF)!;
    expect(segmentation.phases).toHaveLength(2);
    expect(segmentation.phases[0]!.x1.value).toBe(150);
    expect(segmentation.phases[0]!.x2.value).toBe(30);
    expect(segmentation.phases[1]!.x1.value).toBe(30);
    expect(segmentation.phases[1]!.x2.value).toBe(0);
  });

  it('always emits one fewer link than phase', () => {
    const segmentation = segmentPhases(ROOF)!;
    expect(segmentation.links).toHaveLength(segmentation.phases.length - 1);
  });

  it('reads "rolls off" as departing from rest', () => {
    expect(segmentPhases(ROOF)!.links[0]!.kind).toBe('rest');
  });

  it('collapses the ground being named twice', () => {
    // "falls to the ground" and "hits the ground" are one position, not two.
    expect(segmentPhases(ROOF)!.phases).toHaveLength(2);
  });

  it('reads a bounce as a reversal', () => {
    const segmentation = segmentPhases(
      'dropped from 20 m onto a ledge 5 m high, it then bounces and rises to 8 m',
    )!;
    expect(segmentation.links[0]!.kind).toBe('reversed');
  });

  it('reads passing a marker as continuous', () => {
    const segmentation = segmentPhases(
      'falls from 90 m past a window at 40 m, then passes a balcony at 10 m',
    )!;
    expect(segmentation.links[0]!.kind).toBe('continuous');
  });

  describe('declining to split', () => {
    it('returns null without a staging cue', () => {
      expect(
        segmentPhases('a ball is dropped from 150 m onto a roof 30 m high above the ground'),
      ).toBeNull();
    });

    it('returns null for a single fall, however it is phrased', () => {
      expect(segmentPhases('dropped from 45 m, it then hits the ground')).toBeNull();
    });

    it('returns null when no heights are given', () => {
      expect(segmentPhases('it falls and then rolls off and hits the ground')).toBeNull();
    });

    it('leaves ordinary single-phase stories alone', () => {
      expect(segmentPhases('a ball is dropped from a height of 45 m')).toBeNull();
      expect(
        segmentPhases('dropped from a platform 100 m up and lands on a truck 4 m tall'),
      ).toBeNull();
    });
  });

  it('handles a three-fall chain', () => {
    const segmentation = segmentPhases(
      'dropped from 100 m it lands on a roof 60 m high, then rolls off onto a ' +
        'ledge 20 m high, then rolls off again and falls to the ground',
    )!;
    expect(segmentation.phases).toHaveLength(3);
    expect(segmentation.phases.map((p) => p.x2.value)).toEqual([60, 20, 0]);
    expect(segmentation.links.map((l) => l.kind)).toEqual(['rest', 'rest']);
  });

  it('reads imperial heights through the tokenizer', () => {
    const segmentation = segmentPhases(
      'dropped from 60 ft onto a shed 10 ft high, then rolls off to the ground',
    )!;
    expect(segmentation.phases[0]!.x1.value).toBeCloseTo(18.288, 3); // 60 ft in SI
    expect(segmentation.phases[1]!.x2.value).toBe(0);
  });
});

describe('describesStages', () => {
  it('is true when the story signposts a second stage', () => {
    expect(describesStages('it falls 40 m and then rolls off')).toBe(true);
    expect(describesStages('it lands, and after that bounces')).toBe(true);
  });

  it('is false for a story with a single stage', () => {
    expect(describesStages('a ball is dropped from a height of 45 m')).toBe(false);
  });

  /** The case worth warning about: staged, but no chain to split on. */
  it('is true even when segmentation declines', () => {
    const text = 'a ball falls 40 m and then rolls off and hits the ground';
    expect(describesStages(text)).toBe(true);
    expect(segmentPhases(text)).toBeNull();
  });
});
