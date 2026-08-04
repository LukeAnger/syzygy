/**
 * Units bridge between raw numbers a student types and dimensioned Quantities
 * stored in SI base units. A Unit records the factor that converts its value
 * into SI base units, plus the dimension it measures.
 *
 * Conversion is real here — imperial is a genuine change of `factor`, not a
 * relabelling — which is what the legacy app lacked.
 */
import {
  type Dimension,
  ACCELERATION,
  LENGTH,
  TIME,
  VELOCITY,
  dimensionsEqual,
  formatDimension,
} from './dimension.ts';
import { type Quantity, DimensionError, quantity } from './quantity.ts';

export interface Unit {
  /** Display symbol, e.g. "m/s". */
  readonly symbol: string;
  /** Multiply a value in this unit by `factor` to get SI base units. */
  readonly factor: number;
  readonly dimension: Dimension;
}

function defineUnit(
  symbol: string,
  factor: number,
  dimension: Dimension,
): Unit {
  return { symbol, factor, dimension };
}

// Length
export const METRE = defineUnit('m', 1, LENGTH);
export const FOOT = defineUnit('ft', 0.3048, LENGTH);

// Time
export const SECOND = defineUnit('s', 1, TIME);

// Velocity
export const METRE_PER_SECOND = defineUnit('m/s', 1, VELOCITY);
export const FOOT_PER_SECOND = defineUnit('ft/s', 0.3048, VELOCITY);

// Acceleration
export const METRE_PER_SECOND_SQUARED = defineUnit('m/s²', 1, ACCELERATION);
export const FOOT_PER_SECOND_SQUARED = defineUnit('ft/s²', 0.3048, ACCELERATION);

/** Build a Quantity from a value expressed in `unit`. */
export function fromUnit(value: number, unit: Unit): Quantity {
  return quantity(value * unit.factor, unit.dimension);
}

/**
 * Express a Quantity's magnitude in `unit`, returning the plain number. Throws
 * if the quantity's dimension does not match the unit's.
 */
export function toUnit(q: Quantity, unit: Unit): number {
  if (!dimensionsEqual(q.dimension, unit.dimension)) {
    throw new DimensionError(
      `Cannot express ${formatDimension(q.dimension)} in ${unit.symbol} (${formatDimension(
        unit.dimension,
      )})`,
      q.dimension,
      unit.dimension,
    );
  }
  return q.value / unit.factor;
}

export type UnitSystem = 'metric' | 'imperial';

/** The preferred display units for each measured dimension, per system. */
export interface UnitKit {
  length: Unit;
  time: Unit;
  velocity: Unit;
  acceleration: Unit;
}

export const METRIC: UnitKit = {
  length: METRE,
  time: SECOND,
  velocity: METRE_PER_SECOND,
  acceleration: METRE_PER_SECOND_SQUARED,
};

export const IMPERIAL: UnitKit = {
  length: FOOT,
  time: SECOND,
  velocity: FOOT_PER_SECOND,
  acceleration: FOOT_PER_SECOND_SQUARED,
};

export function unitKit(system: UnitSystem): UnitKit {
  return system === 'imperial' ? IMPERIAL : METRIC;
}
