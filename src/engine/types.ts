/**
 * Domain-agnostic solver types.
 *
 * A `Domain` is a set of `Variable`s related by `Equation`s. The `solve`
 * function (see `solver.ts`) takes the knowns and propagates them through the
 * equations, emitting an ordered list of `SolutionStep`s that the tutor renders.
 *
 * Equations own the math (closed forms over dimensioned Quantities) and the
 * symbolic display templates; numeric substitution/formatting is a UI concern,
 * so steps carry the raw inputs and result rather than pre-rendered strings.
 */
import type { Dimension, Quantity, Unit, UnitKit } from '../math/index.ts';

export type VariableKey = string;

/** Restricts which computed roots are physically admissible for a variable. */
export interface PhysicalConstraint {
  accepts(value: Quantity): boolean;
  /** Why a rejected root is discarded, e.g. "time cannot be negative". */
  reason: string;
}

export interface Variable {
  readonly key: VariableKey;
  /** Plain-text symbol, e.g. "v₀". */
  readonly symbol: string;
  /** KaTeX source, e.g. "v_0". */
  readonly latex: string;
  readonly dimension: Dimension;
  /** Preferred display unit for a given unit system. */
  displayUnit(kit: UnitKit): Unit;
  readonly physical?: PhysicalConstraint;
  /**
   * A result rather than an input — computed from others and never typed in.
   * Kept out of the variable form; still shown in the summary.
   */
  readonly derived?: boolean;
}

export type Knowns = Readonly<Record<VariableKey, Quantity>>;

export interface EquationSolution {
  /** Candidate values (more than one for quadratic / ± roots). */
  readonly roots: Quantity[];
  /** KaTeX of the equation rearranged for the solved target. */
  readonly rearrangedLatex: string;
  /** Variable keys whose values were used in the computation. */
  readonly inputs: VariableKey[];
}

export interface Equation {
  readonly id: string;
  /** KaTeX of the equation in its natural form. */
  readonly latex: string;
  readonly variables: VariableKey[];
  /**
   * Solve for `target` given `knowns` (which contain every related variable
   * except `target`). Returns `null` when this equation cannot produce a real
   * value in the current state (e.g. a zero divisor or negative discriminant),
   * so the solver can try another equation.
   */
  solveFor(target: VariableKey, knowns: Knowns): EquationSolution | null;
}

export interface Domain {
  readonly id: string;
  readonly name: string;
  readonly variables: Variable[];
  readonly equations: Equation[];
}

export interface DiscardedRoot {
  readonly value: Quantity;
  readonly reason: string;
}

export interface SolutionStep {
  readonly target: VariableKey;
  readonly equationId: string;
  readonly equationLatex: string;
  readonly rearrangedLatex: string;
  readonly inputs: { key: VariableKey; value: Quantity }[];
  readonly result: Quantity;
  /** Non-physical roots that were rejected (with the reason). */
  readonly discarded: DiscardedRoot[];
  /** Additional physically-valid roots not chosen (genuine ambiguity). */
  readonly alternatives: Quantity[];
}

export interface SolveResult {
  /** Original knowns plus every solved variable. */
  readonly knowns: Knowns;
  /** Variables solved, in the order the solver derived them. */
  readonly solvedOrder: VariableKey[];
  readonly steps: SolutionStep[];
  /** Variables still unknown (an under-determined problem). */
  readonly unsolved: VariableKey[];
}
