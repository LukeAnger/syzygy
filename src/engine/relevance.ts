/**
 * Which values a particular answer actually depends on.
 *
 * The solver computes every reachable unknown, which is the right default when
 * nobody said what was wanted. Once a problem *does* ask for something, the
 * more useful fact is narrower: of everything the story supplied, which values
 * carried the answer, and which were along for the ride.
 *
 * That second group is the point. Textbook problems routinely include a
 * quantity that is solvable but irrelevant, precisely to test whether a student
 * can tell the difference — and a tutor that silently consumes every given
 * teaches them not to look.
 *
 * No new bookkeeping is needed: `SolutionStep` already records the inputs each
 * step consumed, so the dependency graph is walked backwards from the target.
 */
import type { SolutionStep, SolveResult, VariableKey } from './types.ts';
import type { LinkKind, PhaseLink, PhaseSolveResult } from './phases.ts';

/**
 * Every variable the target's value was derived from, including the target.
 *
 * Walks the steps backwards: the step that produced the target names its
 * inputs, each input that was itself computed names its own, and so on. A
 * variable that no step produced is a given, and reaching it ends that branch.
 *
 * Reflects the solution actually shown, not every possible derivation. When
 * several routes to the target exist the solver commits to one, and that route
 * is what the student is reading.
 */
export function dependenciesOf(
  target: VariableKey,
  steps: readonly SolutionStep[],
): Set<VariableKey> {
  const producedBy = new Map<VariableKey, SolutionStep>();
  for (const step of steps) producedBy.set(step.target, step);

  const seen = new Set<VariableKey>();
  const pending: VariableKey[] = [target];
  while (pending.length > 0) {
    const key = pending.pop()!;
    if (seen.has(key)) continue;
    seen.add(key);
    const step = producedBy.get(key);
    if (!step) continue; // a given: nothing produced it
    for (const input of step.inputs) pending.push(input.key);
  }
  return seen;
}

/**
 * Why an earlier segment turns out not to matter.
 *
 * Structured rather than prose: the *fact* is domain knowledge and belongs
 * here, the wording belongs to the UI. Both halves are needed — naming a
 * distractor without explaining it teaches a student to distrust the numbers
 * rather than to reason about them.
 */
export interface PhaseIrrelevance {
  /** Index of the segment the answer does not depend on. */
  readonly phase: number;
  /** What happened at the boundary leaving that segment. */
  readonly link: LinkKind;
  /**
   * True when the next segment's starting position was stated by the story
   * rather than inherited. If it had been inherited, this segment would be
   * needed after all — irrelevance is computed, never assumed from the link.
   */
  readonly startWasStated: boolean;
}

export interface PhaseRelevance {
  /** Segment the answer is read from — the last one, where the motion ends. */
  readonly answerPhase: number;
  /** Segments the answer genuinely depends on, in order. */
  readonly needed: number[];
  /** Segments nothing in the answer depends on. */
  readonly unnecessary: PhaseIrrelevance[];
}

/**
 * Work out which segments an answer actually rests on.
 *
 * Walks the derivation backwards from the target and *keeps going across
 * boundaries*: a value that arrived over a link continues the trace in the
 * segment it came from, while a value the story stated ends it. Anything never
 * reached is a segment the student did not need.
 *
 * The roof problem is the case in point. The ball comes to rest on the lower
 * roof, so no velocity crosses that boundary, and the story states the roof's
 * height, so no position needs to cross either. The trace stops at the start of
 * the final fall and the first 120 m never enters the answer — which is exactly
 * what the problem was written to test.
 */
export function phaseRelevanceFor(
  target: VariableKey,
  result: PhaseSolveResult,
  links: readonly PhaseLink[],
): PhaseRelevance {
  const answerPhase = result.phases.length - 1;
  const needed = new Set<number>();

  // Trace (phase, variable) pairs, hopping to the source phase whenever a
  // value turns out to have been inherited rather than stated.
  const pending: Array<{ phase: number; key: VariableKey }> = [
    { phase: answerPhase, key: target },
  ];
  const seen = new Set<string>();

  while (pending.length > 0) {
    const { phase, key } = pending.pop()!;
    const id = `${phase}:${key}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const solve = result.phases[phase];
    if (!solve) continue;
    needed.add(phase);

    const from = result.inherited[phase]?.[key];
    if (from) {
      // Came over a boundary: continue in the segment that produced it.
      const mirrored: VariableKey =
        from.channel === 'position'
          ? from.phase < phase
            ? 'x2'
            : 'x1'
          : from.phase < phase
            ? 'v'
            : 'v0';
      pending.push({ phase: from.phase, key: mirrored });
      continue;
    }

    for (const step of solve.steps) {
      if (step.target !== key) continue;
      for (const input of step.inputs) pending.push({ phase, key: input.key });
    }
  }

  const unnecessary: PhaseIrrelevance[] = [];
  for (let i = 0; i < result.phases.length; i++) {
    if (needed.has(i)) continue;
    unnecessary.push({
      phase: i,
      link: links[i]?.kind ?? 'rest',
      startWasStated: result.inherited[i + 1]?.['x1'] === undefined,
    });
  }

  return {
    answerPhase,
    needed: [...needed].sort((a, b) => a - b),
    unnecessary,
  };
}

export interface Relevance {
  /** The variable the problem asked for. */
  readonly target: VariableKey;
  /** True once the target has a value. */
  readonly solved: boolean;
  /** Supplied values the answer was derived from. */
  readonly used: VariableKey[];
  /**
   * Supplied values the answer never touched — solvable, but not part of this
   * question. Empty when the target could not be solved, since an unfinished
   * derivation is no evidence that anything was unnecessary.
   */
  readonly unnecessary: VariableKey[];
}

/**
 * Split the supplied values into those the answer used and those it did not.
 *
 * `given` is what the story provided, in the order it should be reported.
 */
export function relevanceFor(
  target: VariableKey,
  given: readonly VariableKey[],
  result: SolveResult,
): Relevance {
  const solved = target in result.knowns;
  const needed = solved
    ? dependenciesOf(target, result.steps)
    : new Set<VariableKey>();
  return {
    target,
    solved,
    used: given.filter((key) => needed.has(key)),
    unnecessary: solved ? given.filter((key) => !needed.has(key)) : [],
  };
}
