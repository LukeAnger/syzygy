import { describe, expect, it } from 'vitest';
import {
  ACCELERATION,
  LENGTH,
  TIME,
  VELOCITY,
  dimension,
  dimensionsEqual,
} from './dimension.ts';
import {
  DimensionError,
  abs,
  add,
  compatible,
  divide,
  multiply,
  negate,
  pow,
  quantity,
  scalar,
  sqrt,
  subtract,
} from './quantity.ts';

const length = (v: number) => quantity(v, LENGTH);
const time = (v: number) => quantity(v, TIME);
const velocity = (v: number) => quantity(v, VELOCITY);

describe('quantity arithmetic', () => {
  it('adds like dimensions', () => {
    expect(add(length(2), length(3))).toEqual(length(5));
  });

  it('subtracts like dimensions', () => {
    expect(subtract(velocity(-80), velocity(-40))).toEqual(velocity(-40));
  });

  it('rejects adding incompatible dimensions', () => {
    expect(() => add(length(1), time(1))).toThrow(DimensionError);
  });

  it('rejects subtracting incompatible dimensions', () => {
    expect(() => subtract(length(1), velocity(1))).toThrow(DimensionError);
  });

  it('multiplies values and combines dimensions (velocity × time = length)', () => {
    const result = multiply(velocity(3), time(4));
    expect(result.value).toBe(12);
    expect(dimensionsEqual(result.dimension, LENGTH)).toBe(true);
  });

  it('divides values and combines dimensions (velocity ÷ time = acceleration)', () => {
    const result = divide(velocity(-40), time(4.073319755600814));
    expect(dimensionsEqual(result.dimension, ACCELERATION)).toBe(true);
    expect(result.value).toBeCloseTo(-9.82, 2);
  });

  it('throws on division by zero', () => {
    expect(() => divide(length(1), scalar(0))).toThrow(DimensionError);
  });

  it('negates and takes absolute value', () => {
    expect(negate(velocity(5))).toEqual(velocity(-5));
    expect(abs(velocity(-5))).toEqual(velocity(5));
  });

  it('raises to integer powers, scaling the dimension', () => {
    const vSquared = pow(velocity(3), 2);
    expect(vSquared.value).toBe(9);
    expect(vSquared.dimension).toEqual(dimension({ L: 2, T: -2 }));
  });

  it('rejects non-integer powers', () => {
    expect(() => pow(velocity(3), 1.5)).toThrow(DimensionError);
  });

  it('takes the square root of an even-dimensioned quantity (v² → v)', () => {
    const vSquared = quantity(1600, dimension({ L: 2, T: -2 }));
    const v = sqrt(vSquared);
    expect(v.value).toBe(40);
    expect(dimensionsEqual(v.dimension, VELOCITY)).toBe(true);
  });

  it('rejects the square root of an odd-dimensioned quantity', () => {
    expect(() => sqrt(length(4))).toThrow(DimensionError);
  });

  it('rejects the square root of a negative value', () => {
    expect(() => sqrt(quantity(-4, dimension({ L: 2 })))).toThrow(
      DimensionError,
    );
  });

  it('reports dimensional compatibility', () => {
    expect(compatible(length(1), length(9))).toBe(true);
    expect(compatible(length(1), time(9))).toBe(false);
  });
});
