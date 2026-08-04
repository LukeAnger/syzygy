import { describe, expect, it } from 'vitest';
import { ACCELERATION, LENGTH, dimensionsEqual } from './dimension.ts';
import { DimensionError, quantity } from './quantity.ts';
import {
  FOOT,
  IMPERIAL,
  METRE,
  METRIC,
  METRE_PER_SECOND,
  fromUnit,
  toUnit,
  unitKit,
} from './units.ts';

describe('units', () => {
  it('builds SI-based quantities from metric input', () => {
    const q = fromUnit(100, METRE);
    expect(q.value).toBe(100);
    expect(dimensionsEqual(q.dimension, LENGTH)).toBe(true);
  });

  it('converts imperial input into SI base units', () => {
    const q = fromUnit(1, FOOT);
    expect(q.value).toBeCloseTo(0.3048, 6);
    expect(dimensionsEqual(q.dimension, LENGTH)).toBe(true);
  });

  it('round-trips a value through a unit', () => {
    const q = fromUnit(12.5, FOOT);
    expect(toUnit(q, FOOT)).toBeCloseTo(12.5, 9);
  });

  it('re-expresses a metric quantity in imperial', () => {
    const oneMetre = fromUnit(1, METRE);
    expect(toUnit(oneMetre, FOOT)).toBeCloseTo(3.28084, 4);
  });

  it('rejects expressing a quantity in a mismatched unit', () => {
    const accel = quantity(-9.81, ACCELERATION);
    expect(() => toUnit(accel, METRE_PER_SECOND)).toThrow(DimensionError);
  });

  it('exposes coherent metric and imperial kits', () => {
    expect(unitKit('metric')).toBe(METRIC);
    expect(unitKit('imperial')).toBe(IMPERIAL);
    expect(METRIC.length).toBe(METRE);
    expect(IMPERIAL.length).toBe(FOOT);
  });
});
