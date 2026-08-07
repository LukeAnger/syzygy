/** UI helpers mapping variable keys to their labels, units, and formatting. */
import {
  type FormatOptions,
  type Quantity,
  type UnitKit,
  type UnitSystem,
  formatQuantity,
  unitKit,
} from '../math/index.ts';
import { type DomainId, findVariable, inputKeysOf, summaryKeysOf } from '../domains/index.ts';
import type { VariableKey } from '../state/index.ts';

/**
 * Looked up across every domain rather than one.
 *
 * Keys are near-disjoint — only `t` is shared, and identically defined — so
 * formatting a value never needs to know which domain produced it.
 */
function variable(key: VariableKey) {
  return findVariable(key);
}

/** Form fields for a domain: everything it declares except its results. */
export function variablesFor(domain: DomainId): VariableKey[] {
  return inputKeysOf(domain) as VariableKey[];
}

/** Everything to list in the solution summary, results included. */
export function summaryFor(domain: DomainId): VariableKey[] {
  return summaryKeysOf(domain) as VariableKey[];
}

/**
 * A bare system, or a kit that already carries per-problem overrides.
 *
 * Accepting both keeps every existing call site valid while letting display
 * paths pass a kit built from the units the problem was written in.
 */
export type Units = UnitSystem | UnitKit;

const kitOf = (units: Units): UnitKit =>
  typeof units === 'string' ? unitKit(units) : units;

export function symbolLatex(key: VariableKey): string {
  return variable(key).latex;
}

export function unitSymbol(key: VariableKey, units: Units): string {
  return variable(key).displayUnit(kitOf(units)).symbol;
}

/** SI-per-display-unit factor, for converting raw quantities to chart values. */
export function unitFactor(key: VariableKey, units: Units): number {
  return variable(key).displayUnit(kitOf(units)).factor;
}

export function formatVar(
  key: VariableKey,
  quantity: Quantity,
  units: Units,
  options?: FormatOptions,
): string {
  return formatQuantity(quantity, variable(key).displayUnit(kitOf(units)), options);
}
