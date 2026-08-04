/** UI helpers mapping variable keys to their labels, units, and formatting. */
import {
  type FormatOptions,
  type Quantity,
  type UnitSystem,
  formatQuantity,
  unitKit,
} from '../math/index.ts';
import { kinematics1D } from '../domains/kinematics-1d/index.ts';
import type { VariableKey } from '../state/index.ts';

function variable(key: VariableKey) {
  const found = kinematics1D.variables.find((v) => v.key === key);
  if (!found) throw new Error(`unknown variable ${key}`);
  return found;
}

export const VARIABLES: VariableKey[] = ['v0', 'v', 'a', 't', 'dx'];

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
