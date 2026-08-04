import { describe, expect, it } from 'vitest';
import { VELOCITY } from './dimension.ts';
import { quantity } from './quantity.ts';
import { SECOND, METRE_PER_SECOND } from './units.ts';
import { formatNumber, formatQuantity, roundToSigFigs } from './format.ts';

describe('roundToSigFigs', () => {
  it('rounds to three significant figures by default', () => {
    expect(roundToSigFigs(4.073319)).toBe(4.07);
    expect(roundToSigFigs(11.6414)).toBe(11.6);
    expect(roundToSigFigs(0.0041732)).toBe(0.00417);
    expect(roundToSigFigs(40733.19)).toBe(40700);
  });

  it('leaves zero and non-finite values alone', () => {
    expect(roundToSigFigs(0)).toBe(0);
    expect(roundToSigFigs(Infinity)).toBe(Infinity);
  });
});

describe('formatNumber', () => {
  it('keeps trailing zeros that convey precision', () => {
    expect(formatNumber(40)).toBe('40.0');
    expect(formatNumber(9.81)).toBe('9.81');
    expect(formatNumber(4.073319)).toBe('4.07');
  });

  it('can trim trailing zeros when asked', () => {
    expect(formatNumber(40, { trimTrailingZeros: true })).toBe('40');
    expect(formatNumber(4.1, { trimTrailingZeros: true })).toBe('4.1');
  });

  it('honours a custom significant-figure count', () => {
    expect(formatNumber(4.073319, { sigFigs: 2 })).toBe('4.1');
    expect(formatNumber(4.073319, { sigFigs: 4 })).toBe('4.073');
  });

  it('falls back to exponential for extreme magnitudes', () => {
    expect(formatNumber(1.23e9)).toBe('1.23e+9');
    expect(formatNumber(1.23e-9)).toBe('1.23e-9');
  });

  it('formats zero and negatives cleanly', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-4.073319)).toBe('-4.07');
  });
});

describe('formatQuantity', () => {
  it('renders a quantity with its unit symbol', () => {
    const t = quantity(4.073319, SECOND.dimension);
    expect(formatQuantity(t, SECOND)).toBe('4.07 s');
  });

  it('re-expresses in the requested display unit', () => {
    const v = quantity(-40, VELOCITY);
    expect(formatQuantity(v, METRE_PER_SECOND)).toBe('-40.0 m/s');
  });
});
