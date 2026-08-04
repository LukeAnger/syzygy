import { describe, expect, it } from 'vitest';
import { ACCELERATION, dimensionsEqual } from './dimension.ts';
import { GRAVITY } from './constants.ts';

describe('constants', () => {
  it('defines standard gravity as a downward acceleration', () => {
    expect(GRAVITY.value).toBe(-9.81);
    expect(dimensionsEqual(GRAVITY.dimension, ACCELERATION)).toBe(true);
  });
});
