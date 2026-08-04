/**
 * Constraint-propagation solver.
 *
 * Repeatedly finds an equation with exactly one unknown variable, solves it,
 * folds the result into the known set, and continues until nothing new can be
 * solved — which is how "given any 3 knowns, solve the rest" (auto-solve-all)
 * falls out for free.
 *
 * Root selection is deliberate: each round it prefers the *most determined*
 * solve — the one leaving the fewest physically-admissible roots. This is what
 * makes signed results come out right. A velocity found via v² = v₀² + 2aΔx is
 * ±ambiguous, but if time is solved first (its negative root pruned as
 * non-physical), velocity then follows unambiguously from v = v₀ + at.
 */
import type { Quantity } from '../math/index.ts';
import type {
  DiscardedRoot,
  Domain,
  EquationSolution,
  Equation,
  Knowns,
  SolutionStep,
  SolveResult,
  Variable,
  VariableKey,
} from './types.ts';

interface Candidate {
  target: VariableKey;
  equation: Equation;
  solution: EquationSolution;
  effective: Quantity[];
  discarded: DiscardedRoot[];
}

export function solve(domain: Domain, initial: Knowns): SolveResult {
  const variableByKey = new Map<VariableKey, Variable>(
    domain.variables.map((v) => [v.key, v]),
  );

  const knowns: Record<VariableKey, Quantity> = { ...initial };
  const steps: SolutionStep[] = [];
  const solvedOrder: VariableKey[] = [];

  for (;;) {
    const best = findBestCandidate(domain, knowns, variableByKey);
    if (!best) break;

    const chosen = best.effective[0]!;
    knowns[best.target] = chosen;
    solvedOrder.push(best.target);
    steps.push({
      target: best.target,
      equationId: best.equation.id,
      equationLatex: best.equation.latex,
      rearrangedLatex: best.solution.rearrangedLatex,
      inputs: best.solution.inputs.map((key) => ({ key, value: knowns[key]! })),
      result: chosen,
      discarded: best.discarded,
      alternatives: best.effective.slice(1),
    });
  }

  const unsolved = domain.variables
    .map((v) => v.key)
    .filter((key) => !(key in knowns));

  return { knowns, solvedOrder, steps, unsolved };
}

/**
 * Scan every equation for one with a single unknown, returning the candidate
 * with the fewest physically-admissible roots (most determined). Stops early on
 * the first fully-determined (single-root) candidate — nothing beats it.
 */
function findBestCandidate(
  domain: Domain,
  knowns: Knowns,
  variableByKey: Map<VariableKey, Variable>,
): Candidate | null {
  let best: Candidate | null = null;

  for (const equation of domain.equations) {
    const unknowns = equation.variables.filter((key) => !(key in knowns));
    if (unknowns.length !== 1) continue;
    const target = unknowns[0]!;

    let solution: EquationSolution | null;
    try {
      solution = equation.solveFor(target, knowns);
    } catch {
      // A thrown DimensionError (zero divisor, negative sqrt, ...) means this
      // equation cannot solve the target right now; try the next one.
      solution = null;
    }
    if (!solution || solution.roots.length === 0) continue;

    const candidate = classifyRoots(
      target,
      equation,
      solution,
      variableByKey.get(target),
    );

    if (best === null || candidate.effective.length < best.effective.length) {
      best = candidate;
    }
    if (best.effective.length === 1) break;
  }

  return best;
}

/** Split an equation's roots into physically-admissible and discarded sets. */
function classifyRoots(
  target: VariableKey,
  equation: Equation,
  solution: EquationSolution,
  variable: Variable | undefined,
): Candidate {
  const constraint = variable?.physical;
  const physical: Quantity[] = [];
  const discarded: DiscardedRoot[] = [];

  for (const root of solution.roots) {
    if (constraint && !constraint.accepts(root)) {
      discarded.push({ value: root, reason: constraint.reason });
    } else {
      physical.push(root);
    }
  }

  // If no root survives the constraint, keep the raw roots rather than getting
  // stuck — the problem is likely ill-posed, and surfacing a value beats a
  // silent dead end. In that case nothing was truly "discarded".
  if (physical.length === 0) {
    return { target, equation, solution, effective: solution.roots, discarded: [] };
  }
  return { target, equation, solution, effective: physical, discarded };
}
