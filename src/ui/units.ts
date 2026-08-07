/** UI helpers mapping variable keys to their labels, units, and formatting. */
import {
  type FormatOptions,
  type Quantity,
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

export function symbolLatex(key: VariableKey): string {
  return variable(key).latex;
}

export function unitSymbol(key: VariableKey, system: UnitSystem): string {
  return variable(key).displayUnit(unitKit(system)).symbol;
}

/** SI-per-display-unit factor, for converting raw quantities to chart values. */
export function unitFactor(key: VariableKey, system: UnitSystem): number {
  return variable(key).displayUnit(unitKit(system)).factor;
}

export function formatVar(
  key: VariableKey,
  quantity: Quantity,
  system: UnitSystem,
  options?: FormatOptions,
): string {
  return formatQuantity(quantity, variable(key).displayUnit(unitKit(system)), options);
}
