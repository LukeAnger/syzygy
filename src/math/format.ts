/**
 * Number and Quantity formatting.
 *
 * Sig-fig policy: computed results are shown to a fixed number of significant
 * figures (default 3), matching physics-textbook convention where most inputs
 * carry 2–3 sig figs. Significant figures — not decimal places — is the right
 * unit of precision: it behaves sensibly across magnitudes (0.00417, 4.07,
 * 40700) where a fixed decimal count would not. Trailing zeros that convey
 * precision are kept (40.0, not 40) unless `trimTrailingZeros` is set.
 *
 * Very large/small magnitudes fall back to exponential notation so the output
 * never becomes an unreadable string of zeros.
 */
import { type Quantity } from './quantity.ts';
import { type Unit, toUnit } from './units.ts';

export const DEFAULT_SIG_FIGS = 3;

const FIXED_LOWER = 1e-3;
const FIXED_UPPER = 1e7;

export interface FormatOptions {
  sigFigs?: number;
  trimTrailingZeros?: boolean;
}

/** Round a number to `sigFigs` significant figures. */
export function roundToSigFigs(value: number, sigFigs = DEFAULT_SIG_FIGS): number {
  if (!Number.isFinite(value) || value === 0) return value === 0 ? 0 : value;
  const digits = Math.ceil(Math.log10(Math.abs(value)));
  const power = sigFigs - digits;
  const magnitude = 10 ** power;
  return Math.round(value * magnitude) / magnitude;
}

/** Format a number to `sigFigs` significant figures as a display string. */
export function formatNumber(value: number, options: FormatOptions = {}): string {
  const sigFigs = options.sigFigs ?? DEFAULT_SIG_FIGS;
  const trim = options.trimTrailingZeros ?? false;

  if (!Number.isFinite(value)) return String(value);
  if (value === 0) return '0';

  const rounded = roundToSigFigs(value, sigFigs);
  const magnitude = Math.abs(rounded);

  let out: string;
  if (magnitude >= FIXED_LOWER && magnitude < FIXED_UPPER) {
    const leadingExp = Math.floor(Math.log10(magnitude));
    const decimals = Math.max(0, sigFigs - 1 - leadingExp);
    out = rounded.toFixed(decimals);
  } else {
    out = rounded.toExponential(sigFigs - 1);
  }

  if (trim && out.includes('.') && !out.includes('e')) {
    out = out.replace(/\.?0+$/, '');
  }
  return out;
}

/**
 * Format a Quantity in the given display unit, e.g. `4.07 m/s`. The unit's
 * symbol is appended (omit for dimensionless "1" units by passing a unit whose
 * symbol is empty).
 */
export function formatQuantity(
  q: Quantity,
  unit: Unit,
  options: FormatOptions = {},
): string {
  const magnitude = toUnit(q, unit);
  const number = formatNumber(magnitude, options);
  return unit.symbol ? `${number} ${unit.symbol}` : number;
}
