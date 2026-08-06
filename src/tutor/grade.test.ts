import { describe, expect, it } from 'vitest';
import type { Relevance } from '../engine/index.ts';
import { gradeGivens, gradeTarget, isWorkable } from './grade.ts';

const relevance = (used: string[], unnecessary: string[]): Relevance => ({
  target: 'v',
  solved: true,
  used,
  unnecessary,
});

describe('gradeGivens', () => {
  it('marks a perfect selection', () => {
    const grade = gradeGivens(['x1', 'v0'], relevance(['x1', 'v0'], ['t']));
    expect(grade.perfect).toBe(true);
    expect(grade.correct).toEqual(['x1', 'v0']);
    expect(grade.missed).toEqual([]);
    expect(grade.extra).toEqual([]);
  });

  it('is order-insensitive — a set was asked for, not a sequence', () => {
    const grade = gradeGivens(['v0', 'x1'], relevance(['x1', 'v0'], []));
    expect(grade.perfect).toBe(true);
  });

  /** The distractor trap: solvable, but not part of this question. */
  it('separates taking an irrelevant value from omitting a needed one', () => {
    const grade = gradeGivens(['x1', 't'], relevance(['x1', 'v0'], ['t']));
    expect(grade.extra).toEqual(['t']);
    expect(grade.missed).toEqual(['v0']);
    expect(grade.correct).toEqual(['x1']);
    expect(grade.perfect).toBe(false);
  });

  it('treats an empty selection as everything missed, nothing extra', () => {
    const grade = gradeGivens([], relevance(['x1', 'v0'], []));
    expect(grade.missed).toEqual(['x1', 'v0']);
    expect(grade.extra).toEqual([]);
    expect(grade.perfect).toBe(false);
  });

  it('counts every irrelevant pick, not just the first', () => {
    const grade = gradeGivens(['t', 'x2'], relevance(['x1'], ['t', 'x2']));
    expect(grade.extra).toEqual(['t', 'x2']);
  });
});

describe('gradeTarget', () => {
  it('accepts the asked-for variable and nothing else', () => {
    expect(gradeTarget('v', 'v')).toBe(true);
    expect(gradeTarget('t', 'v')).toBe(false);
  });

  it('is false when nothing was chosen', () => {
    expect(gradeTarget(null, 'v')).toBe(false);
  });

  /** No question means no right answer — never mark an absence correct. */
  it('is false when the problem asks for nothing', () => {
    expect(gradeTarget('v', undefined)).toBe(false);
    expect(gradeTarget(null, undefined)).toBe(false);
  });
});

describe('isWorkable', () => {
  it('needs a question and something to choose between', () => {
    expect(isWorkable('v', ['x1', 'v0'])).toBe(true);
  });

  it('declines a story that asks nothing', () => {
    expect(isWorkable(undefined, ['x1', 'v0'])).toBe(false);
  });

  it('declines when there is no discrimination to make', () => {
    // One given is a formality, not a decision.
    expect(isWorkable('v', ['x1'])).toBe(false);
    expect(isWorkable('v', [])).toBe(false);
  });
});
