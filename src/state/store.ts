/**
 * Application state: the five kinematics inputs (as raw strings the user
 * types), the unit system, and the actions that mutate them. The solve itself
 * is derived, not stored — components compute it from `solveInputs`.
 *
 * The conversion logic (strings ⇄ dimensioned quantities) lives in exported
 * pure functions so it can be tested without React.
 */
import { create } from 'zustand';
import {
  type Quantity,
  type UnitSystem,
  fromUnit,
  toUnit,
  unitKit,
} from '../math/index.ts';
import { type Knowns, type SolveResult, solve } from '../engine/index.ts';
import { kinematics1D } from '../domains/kinematics-1d/index.ts';
import { type Assignment, parse } from '../nlp/index.ts';

export type VariableKey = 'v0' | 'v' | 'a' | 't' | 'dx';
export type Inputs = Record<VariableKey, string>;

const VARIABLE_KEYS: VariableKey[] = ['v0', 'v', 'a', 't', 'dx'];

/** Free fall is the default landing preset: gravity in, everything else blank. */
export const DEFAULT_INPUTS: Inputs = {
  v0: '',
  v: '',
  a: '-9.81',
  t: '',
  dx: '',
};

function variable(key: VariableKey) {
  const found = kinematics1D.variables.find((v) => v.key === key);
  if (!found) throw new Error(`unknown variable ${key}`);
  return found;
}

/** Parse the non-empty inputs into a `Knowns` map of SI-based quantities. */
export function buildKnowns(inputs: Inputs, system: UnitSystem): Knowns {
  const kit = unitKit(system);
  const knowns: Record<VariableKey, Quantity> = {} as Record<VariableKey, Quantity>;
  for (const key of VARIABLE_KEYS) {
    const raw = inputs[key].trim();
    if (raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    knowns[key] = fromUnit(value, variable(key).displayUnit(kit));
  }
  return knowns;
}

/** Run the solver over the current inputs. */
export function solveInputs(inputs: Inputs, system: UnitSystem): SolveResult {
  return solve(kinematics1D, buildKnowns(inputs, system));
}

/** Format an SI quantity as a plain input string in the given system's unit. */
function quantityToInput(
  key: VariableKey,
  quantity: Quantity,
  system: UnitSystem,
): string {
  const magnitude = toUnit(quantity, variable(key).displayUnit(unitKit(system)));
  // Trim floating-point fuzz without imposing sig-figs on user-facing inputs.
  return String(Number(magnitude.toFixed(6)));
}

/** Turn parser assignments into input strings (for Storymode). */
export function assignmentsToInputs(
  assignments: Assignment[],
  system: UnitSystem,
): Partial<Inputs> {
  const inputs: Partial<Inputs> = {};
  for (const assignment of assignments) {
    if ((VARIABLE_KEYS as string[]).includes(assignment.variable)) {
      const key = assignment.variable as VariableKey;
      inputs[key] = quantityToInput(key, assignment.quantity, system);
    }
  }
  return inputs;
}

/** Re-express every non-empty input from one unit system in another. */
export function convertInputs(
  inputs: Inputs,
  from: UnitSystem,
  to: UnitSystem,
): Inputs {
  if (from === to) return inputs;
  const fromKit = unitKit(from);
  const toKit = unitKit(to);
  const next: Inputs = { ...inputs };
  for (const key of VARIABLE_KEYS) {
    const raw = inputs[key].trim();
    if (raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const si = fromUnit(value, variable(key).displayUnit(fromKit));
    next[key] = String(Number(toUnit(si, variable(key).displayUnit(toKit)).toFixed(6)));
  }
  return next;
}

export interface KinematicsState {
  inputs: Inputs;
  unitSystem: UnitSystem;
  /** Last Storymode text, for display/highlighting. */
  story: string;
  /** Numbers the parser could not place, surfaced from the last parse. */
  unusedNumbers: number[];
  setInput(key: VariableKey, value: string): void;
  setUnitSystem(system: UnitSystem): void;
  loadStory(text: string): void;
  loadFreeFall(): void;
  reset(): void;
}

export const useKinematicsStore = create<KinematicsState>((set, get) => ({
  inputs: DEFAULT_INPUTS,
  unitSystem: 'metric',
  story: '',
  unusedNumbers: [],

  setInput: (key, value) =>
    set((state) => ({ inputs: { ...state.inputs, [key]: value } })),

  setUnitSystem: (system) =>
    set((state) => ({
      unitSystem: system,
      inputs: convertInputs(state.inputs, state.unitSystem, system),
    })),

  loadStory: (text) => {
    const result = parse(text);
    const parsed = assignmentsToInputs(result.assignments, get().unitSystem);
    set((state) => ({
      story: text,
      unusedNumbers: result.unusedNumbers,
      // Keep the current acceleration (free-fall default) unless the story set it.
      inputs: { ...DEFAULT_INPUTS, a: state.inputs.a, ...parsed },
    }));
  },

  loadFreeFall: () =>
    set((state) => ({ inputs: { ...state.inputs, a: DEFAULT_INPUTS.a } })),

  reset: () => set({ inputs: DEFAULT_INPUTS, story: '', unusedNumbers: [] }),
}));
