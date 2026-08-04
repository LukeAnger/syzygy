/**
 * Physical dimensions as an integer exponent vector over the SI base
 * dimensions. Kinematics only exercises length (L) and time (T); the full
 * basis is present so future domains (electromagnetism, chemistry) extend
 * without reworking this layer.
 *
 * Order: [L, T, M, I, Θ, N, J]
 *   L  length              (metre)
 *   T  time                (second)
 *   M  mass                (kilogram)
 *   I  electric current    (ampere)
 *   Θ  temperature         (kelvin)
 *   N  amount of substance (mole)
 *   J  luminous intensity  (candela)
 */
export type Dimension = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const BASIS_LENGTH = 7;

export function dimension(
  parts: Partial<{
    L: number;
    T: number;
    M: number;
    I: number;
    Th: number;
    N: number;
    J: number;
  }> = {},
): Dimension {
  return [
    parts.L ?? 0,
    parts.T ?? 0,
    parts.M ?? 0,
    parts.I ?? 0,
    parts.Th ?? 0,
    parts.N ?? 0,
    parts.J ?? 0,
  ];
}

export const DIMENSIONLESS: Dimension = dimension();
export const LENGTH: Dimension = dimension({ L: 1 });
export const TIME: Dimension = dimension({ T: 1 });
export const VELOCITY: Dimension = dimension({ L: 1, T: -1 });
export const ACCELERATION: Dimension = dimension({ L: 1, T: -2 });

export function dimensionsEqual(a: Dimension, b: Dimension): boolean {
  for (let i = 0; i < BASIS_LENGTH; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function multiplyDimensions(a: Dimension, b: Dimension): Dimension {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
    a[3] + b[3],
    a[4] + b[4],
    a[5] + b[5],
    a[6] + b[6],
  ];
}

export function divideDimensions(a: Dimension, b: Dimension): Dimension {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
    a[3] - b[3],
    a[4] - b[4],
    a[5] - b[5],
    a[6] - b[6],
  ];
}

export function powDimension(a: Dimension, n: number): Dimension {
  return [
    a[0] * n,
    a[1] * n,
    a[2] * n,
    a[3] * n,
    a[4] * n,
    a[5] * n,
    a[6] * n,
  ];
}

const BASIS_SYMBOLS = ['L', 'T', 'M', 'I', 'Θ', 'N', 'J'] as const;

/** Human-readable form, e.g. VELOCITY -> "L·T⁻¹", DIMENSIONLESS -> "1". */
export function formatDimension(d: Dimension): string {
  const parts: string[] = [];
  for (let i = 0; i < BASIS_LENGTH; i++) {
    const exp = d[i];
    if (exp === 0) continue;
    const symbol = BASIS_SYMBOLS[i]!;
    parts.push(exp === 1 ? symbol : `${symbol}^${exp}`);
  }
  return parts.length === 0 ? '1' : parts.join('·');
}
