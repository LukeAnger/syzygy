/**
 * Marking a student's attempt at the two questions worth asking before a
 * solution is shown.
 *
 * The app already knows what a problem asks for and which given values carry
 * the answer — it has used both to *tell* the student. Grading turns the same
 * facts into questions, which is the difference between informing and teaching:
 * being told that 150 m is irrelevant is a fact, noticing it yourself and being
 * shown why is a skill.
 *
 * Pure and domain-agnostic. Ground truth comes from `nlp/question.ts` and
 * `engine/relevance.ts`, both already tested, so nothing here can invent a
 * right answer of its own.
 */
import type { Relevance, VariableKey } from '../engine/index.ts';

export interface GivensGrade {
  /** Needed, and selected. */
  readonly correct: VariableKey[];
  /** Needed, but not selected — the student would get stuck. */
  readonly missed: VariableKey[];
  /**
   * Selected, but the answer never depends on them. The distractor trap, and
   * the reason this question is worth asking at all.
   */
  readonly extra: VariableKey[];
  readonly perfect: boolean;
}

/**
 * Mark a selection of given values against what the answer actually used.
 *
 * `missed` and `extra` are kept apart because they are different mistakes.
 * Missing a needed value leaves you unable to finish; including an irrelevant
 * one means you'd have solved something, just not the question asked — which is
 * the failure textbook distractors are built to provoke.
 */
export function gradeGivens(
  selected: readonly VariableKey[],
  relevance: Relevance,
): GivensGrade {
  const picked = new Set(selected);
  const needed = new Set(relevance.used);

  const correct = relevance.used.filter((key) => picked.has(key));
  const missed = relevance.used.filter((key) => !picked.has(key));
  const extra = selected.filter((key) => !needed.has(key));

  return {
    correct,
    missed,
    extra,
    perfect: missed.length === 0 && extra.length === 0,
  };
}

/**
 * True when the student named the quantity the problem asks for.
 *
 * Deliberately strict. "Close enough" has no meaning here — a problem asks for
 * one thing, and reading which is the first step of solving it.
 */
export function gradeTarget(
  selected: VariableKey | null,
  asked: VariableKey | undefined,
): boolean {
  return selected !== null && selected === asked;
}

/**
 * Whether a problem can be worked through at all.
 *
 * Needs a question to have been asked, and at least two given values — with one
 * there is nothing to discriminate, and the second question would be a
 * formality rather than a decision.
 */
export function isWorkable(
  asked: VariableKey | undefined,
  given: readonly VariableKey[],
): boolean {
  return asked !== undefined && given.length >= 2;
}
