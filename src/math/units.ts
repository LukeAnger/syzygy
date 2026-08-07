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

/**
 * Road speeds. Input units, not display units.
 *
 * Vehicle problems are written in km/h and mph almost without exception, and
 * until now neither could be read at all — "120 km/h" simply failed to parse,
 * in every domain. These convert to SI on the way in like any other unit.
 *
 * Deliberately absent from `METRIC`/`IMPERIAL` below, so results still display
 * in m/s and ft/s. Whether an answer should come back in the unit the question
 * was asked in is a real question, but it is a display concern and a bigger
 * one than parsing — see the note on `UnitKit`.
 */
export const KILOMETRE_PER_HOUR = defineUnit('km/h', 1000 / 3600, VELOCITY);
export const MILE_PER_HOUR = defineUnit('mph', 1609.344 / 3600, VELOCITY);

// Length, road scale
export const KILOMETRE = defineUnit('km', 1000, LENGTH);
export const MILE = defineUnit('mi', 1609.344, LENGTH);

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
/**
 * The units results are *displayed* in, per system.
 *
 * Distinct from the units a problem may be *written* in. km/h, mph, km and
 * miles all parse, but a solved velocity still comes back in m/s or ft/s.
 * Answering in the unit the question used would arguably be friendlier, but it
 * means tracking a per-problem display preference rather than a per-system one,
 * and that is a larger change than reading the unit in the first place.
 */
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
