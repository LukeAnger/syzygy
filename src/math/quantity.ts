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
/**
 * Trigonometry, for resolving a vector into components and back.
 *
 * Angles are dimensionless and held in radians, the way the maths works;
 * degrees are a display unit like any other (see `DEGREE`). Taking the sine of
 * a length is a modelling error rather than a rounding one, so it throws
 * instead of coercing.
 */
function requireAngle(q: Quantity, op: string): number {
  if (!isDimensionless(q)) {
    throw new DimensionError(`${op} needs an angle`, q.dimension, DIMENSIONLESS);
  }
  return q.value;
}

export function sin(angle: Quantity): Quantity {
  return scalar(Math.sin(requireAngle(angle, 'sin')));
}

export function cos(angle: Quantity): Quantity {
  return scalar(Math.cos(requireAngle(angle, 'cos')));
}

/**
 * The angle of the vector (x, y), as a dimensionless quantity in radians.
 *
 * `atan2` rather than `atan(y/x)` so all four quadrants are distinguished — a
 * velocity pointing south-west must not report the same heading as one pointing
 * north-east.
 */
export function atan2(y: Quantity, x: Quantity): Quantity {
  if (!compatible(y, x)) {
    throw new DimensionError('atan2 needs matching dimensions', y.dimension, x.dimension);
  }
  return scalar(Math.atan2(y.value, x.value));
}

/** Length of the vector (x, y), in the components' own dimension. */
export function hypot(x: Quantity, y: Quantity): Quantity {
  if (!compatible(x, y)) {
    throw new DimensionError('hypot needs matching dimensions', x.dimension, y.dimension);
  }
  return quantity(Math.hypot(x.value, y.value), x.dimension);
}

export function compatible(a: Quantity, b: Quantity): boolean {
  return dimensionsEqual(a.dimension, b.dimension);
}
