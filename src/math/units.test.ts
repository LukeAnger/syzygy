import { describe, expect, it } from 'vitest';
import { ACCELERATION, LENGTH, dimensionsEqual } from './dimension.ts';
import { DimensionError, quantity } from './quantity.ts';
import {
  FOOT,
  FOOT_PER_SECOND,
  IMPERIAL,
  KILOMETRE,
  KILOMETRE_PER_HOUR,
  METRE,
  METRE_PER_SECOND,
  METRIC,
  MILE,
  MILE_PER_HOUR,
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

describe('road units', () => {
  it('converts km/h to SI', () => {
    // 120 km/h is 33.33 m/s.
    expect(fromUnit(120, KILOMETRE_PER_HOUR).value).toBeCloseTo(33.333, 3);
    expect(fromUnit(3.6, KILOMETRE_PER_HOUR).value).toBeCloseTo(1, 9);
  });

  it('converts mph to SI', () => {
    // 60 mph is 26.82 m/s.
    expect(fromUnit(60, MILE_PER_HOUR).value).toBeCloseTo(26.8224, 4);
  });

  it('converts road distances to SI', () => {
    expect(fromUnit(1, KILOMETRE).value).toBe(1000);
    expect(fromUnit(1, MILE).value).toBeCloseTo(1609.344, 6);
  });

  it('round-trips through toUnit', () => {
    expect(toUnit(fromUnit(120, KILOMETRE_PER_HOUR), KILOMETRE_PER_HOUR)).toBeCloseTo(120, 9);
    expect(toUnit(fromUnit(70, MILE_PER_HOUR), MILE_PER_HOUR)).toBeCloseTo(70, 9);
  });

  /** Input units, not display units — a solved speed still comes back in m/s. */
  it('is absent from the display kits', () => {
    expect(unitKit('metric').velocity).toBe(METRE_PER_SECOND);
    expect(unitKit('imperial').velocity).toBe(FOOT_PER_SECOND);
  });
});
