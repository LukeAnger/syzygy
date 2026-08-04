/**
 * A Quantity is a numeric value paired with a physical dimension. The value is
 * always stored in SI base units (metres, seconds, ...); display units are a
 * presentation concern handled in `units.ts` / `format.ts`.
 *
 * Arithmetic propagates dimensions so that, e.g., dividing a length by a time
 * yields a velocity automatically, and adding a length to a time is a typed
 * error rather than a silent NaN.
 */
import {
  type Dimension,
  DIMENSIONLESS,
  dimensionsEqual,
  divideDimensions,
  formatDimension,
  multiplyDimensions,
  powDimension,
} from './dimension.ts';

export interface Quantity {
  readonly value: number;
  readonly dimension: Dimension;
}

/** Raised when an operation combines incompatible dimensions. */
export class DimensionError extends Error {
  constructor(
    message: string,
    readonly left: Dimension,
    readonly right?: Dimension,
  ) {
    super(message);
    this.name = 'DimensionError';
  }
}

export function quantity(value: number, dimension: Dimension): Quantity {
  return { value, dimension };
}

/** A dimensionless scalar. */
export function scalar(value: number): Quantity {
  return { value, dimension: DIMENSIONLESS };
}

export function isDimensionless(q: Quantity): boolean {
  return dimensionsEqual(q.dimension, DIMENSIONLESS);
}

export function add(a: Quantity, b: Quantity): Quantity {
  if (!dimensionsEqual(a.dimension, b.dimension)) {
    throw new DimensionError(
      `Cannot add ${formatDimension(a.dimension)} to ${formatDimension(
        b.dimension,
      )}`,
      a.dimension,
      b.dimension,
    );
  }
  return { value: a.value + b.value, dimension: a.dimension };
}

export function subtract(a: Quantity, b: Quantity): Quantity {
  if (!dimensionsEqual(a.dimension, b.dimension)) {
    throw new DimensionError(
      `Cannot subtract ${formatDimension(b.dimension)} from ${formatDimension(
        a.dimension,
      )}`,
      a.dimension,
      b.dimension,
    );
  }
  return { value: a.value - b.value, dimension: a.dimension };
}

export function multiply(a: Quantity, b: Quantity): Quantity {
  return {
    value: a.value * b.value,
    dimension: multiplyDimensions(a.dimension, b.dimension),
  };
}

export function divide(a: Quantity, b: Quantity): Quantity {
  if (b.value === 0) {
    throw new DimensionError('Division by zero', a.dimension, b.dimension);
  }
  return {
    value: a.value / b.value,
    dimension: divideDimensions(a.dimension, b.dimension),
  };
}

export function negate(a: Quantity): Quantity {
  return { value: -a.value, dimension: a.dimension };
}

export function abs(a: Quantity): Quantity {
  return { value: Math.abs(a.value), dimension: a.dimension };
}

/**
 * Raise to an integer power. The dimension exponents are scaled by `n`; a
 * non-integer `n` is rejected because it would produce fractional dimensions
 * (use `sqrt` for the one rooted case kinematics needs).
 */
export function pow(a: Quantity, n: number): Quantity {
  if (!Number.isInteger(n)) {
    throw new DimensionError(
      `Non-integer power ${n} would produce a fractional dimension; use sqrt`,
      a.dimension,
    );
  }
  return { value: a.value ** n, dimension: powDimension(a.dimension, n) };
}

/**
 * Square root. Valid only when every dimension exponent is even (so the result
 * stays integer-dimensioned), which is exactly the case for quantities like
 * v² (L²·T⁻²) → v (L·T⁻¹).
 */
export function sqrt(a: Quantity): Quantity {
  if (a.value < 0) {
    throw new DimensionError(
      `Cannot take the square root of a negative value (${a.value})`,
      a.dimension,
    );
  }
  for (const exp of a.dimension) {
    if (exp % 2 !== 0) {
      throw new DimensionError(
        `Cannot take the square root of dimension ${formatDimension(
          a.dimension,
        )}`,
        a.dimension,
      );
    }
  }
  return { value: Math.sqrt(a.value), dimension: powDimension(a.dimension, 0.5) };
}

/** True when both quantities share a dimension. */
export function compatible(a: Quantity, b: Quantity): boolean {
  return dimensionsEqual(a.dimension, b.dimension);
}
