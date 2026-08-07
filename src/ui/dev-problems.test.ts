import { describe, expect, it } from 'vitest';
import { detectDomain } from '../nlp/index.ts';
import { DEV_GROUPS } from './dev-problems.ts';

const all = DEV_GROUPS.flatMap((g) => g.problems.map((p) => ({ ...p, group: g })));

describe('the dev panel catalogue', () => {
  /**
   * The point of grouping the buttons. A heading claims a domain, and this is
   * what makes the claim cost something: widen a cue list carelessly and a
   * river problem starts reading as free fall, which is otherwise invisible
   * until someone clicks it and squints at the answer.
   */
  it.each(all)('routes $id where its group says', (problem) => {
    expect(detectDomain(problem.text)).toBe(problem.detects ?? problem.group.domain);
  });

  /** An override without a reason is just a silenced failure. */
  it('explains every gap it records', () => {
    for (const problem of all) {
      if (problem.detects) expect(problem.gap).toBeTruthy();
    }
  });

  /** Unique ids, since they are React keys and the visible button labels. */
  it('names each problem once', () => {
    const ids = all.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
