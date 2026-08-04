import { describe, expect, it } from 'vitest';
import {
  ACCELERATION,
  DIMENSIONLESS,
  LENGTH,
  TIME,
  VELOCITY,
  dimension,
  dimensionsEqual,
  divideDimensions,
  formatDimension,
  multiplyDimensions,
  powDimension,
} from './dimension.ts';

describe('dimension', () => {
  it('builds named dimensions from partial exponents', () => {
    expect(dimension({ L: 1, T: -2 })).toEqual(ACCELERATION);
    expect(dimension()).toEqual(DIMENSIONLESS);
  });

  it('compares dimensions structurally', () => {
    expect(dimensionsEqual(VELOCITY, dimension({ L: 1, T: -1 }))).toBe(true);
    expect(dimensionsEqual(VELOCITY, ACCELERATION)).toBe(false);
  });

  it('multiplies by adding exponents (velocity × time = length)', () => {
    expect(dimensionsEqual(multiplyDimensions(VELOCITY, TIME), LENGTH)).toBe(
      true,
    );
  });

  it('divides by subtracting exponents (length ÷ time = velocity)', () => {
    expect(dimensionsEqual(divideDimensions(LENGTH, TIME), VELOCITY)).toBe(true);
  });

  it('divides velocity by time to get acceleration', () => {
    expect(
      dimensionsEqual(divideDimensions(VELOCITY, TIME), ACCELERATION),
    ).toBe(true);
  });

  it('raises to a power by scaling exponents (velocity² = L²T⁻²)', () => {
    expect(powDimension(VELOCITY, 2)).toEqual(dimension({ L: 2, T: -2 }));
  });

  it('formats dimensions readably', () => {
    expect(formatDimension(DIMENSIONLESS)).toBe('1');
    expect(formatDimension(LENGTH)).toBe('L');
    expect(formatDimension(VELOCITY)).toBe('L·T^-1');
    expect(formatDimension(ACCELERATION)).toBe('L·T^-2');
  });
});
