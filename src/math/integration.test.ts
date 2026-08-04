/**
 * End-to-end sanity checks: compute kinematics results directly with the math
 * core and confirm they match the worked examples the legacy TimeSolver tests
 * asserted, proving the dimensional layer is a faithful drop-in for the old
 * hand-rolled arithmetic.
 */
import { describe, expect, it } from 'vitest';
import { ACCELERATION, VELOCITY } from './dimension.ts';
import { divide, quantity, subtract } from './quantity.ts';
import { SECOND } from './units.ts';
import { formatQuantity } from './format.ts';

describe('kinematics integration', () => {
  it('solves t = (v - v₀) / a and matches the legacy example', () => {
    const v0 = quantity(-40, VELOCITY);
    const v = quantity(-80, VELOCITY);
    const a = quantity(-9.82, ACCELERATION);

    const t = divide(subtract(v, v0), a);

    // Result is dimensionally a time, and formats to the legacy "4.07 s".
    expect(t.dimension).toEqual(SECOND.dimension);
    expect(formatQuantity(t, SECOND)).toBe('4.07 s');
  });
});
