import { describe, expect, it } from 'vitest';
import { CORPUS, scoreCase, summarize } from './corpus.ts';
import { parse } from './parse.ts';
import { LENGTH, TIME, quantity } from '../math/index.ts';

describe('corpus', () => {
  it('labels only slots the story actually supports', () => {
    for (const entry of CORPUS) {
      expect(Object.keys(entry.expected).length).toBeGreaterThan(0);
      // A slot cannot be both required and required-absent.
      for (const variable of entry.absent ?? []) {
        expect(entry.expected).not.toHaveProperty(variable);
      }
    }
  });

  it('has unique ids', () => {
    const ids = CORPUS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('scoreCase', () => {
  const entry = CORPUS.find((c) => c.id === 'capsule-braking')!;

  it('counts a filled required-absent slot as fabricated', () => {
    const score = scoreCase(entry, [
      { variable: 'x2', quantity: quantity(0, LENGTH), ruleId: 'x', source: '' },
    ]);
    expect(score.fabricated).toEqual(['x2']);
  });

  it('separates a wrong value from a missing one', () => {
    const score = scoreCase(entry, [
      { variable: 't', quantity: quantity(99, TIME), ruleId: 'x', source: '' },
    ]);
    expect(score.wrong).toContain('t');
    expect(score.missed).toContain('x1');
    expect(score.recovered).toEqual([]);
  });
});

/**
 * The grammar's standing score on unconstrained prose.
 *
 * This is a ratchet, not a target: the floor records where the parser is today
 * so that work on the grammar cannot silently regress it. Raise the floor when
 * the score improves. It is deliberately low — these problems are much harder
 * than the curated phrasings in `parse.test.ts`, and the gap between the two is
 * the point of keeping this corpus.
 *
 * Read the recall figure with one caveat: `a` is labeled on every case because
 * the story implies it, but the grammar never emits acceleration — the app
 * supplies −9.81 as a default input. So a missed `a` is only user-visible where
 * that default is wrong, which is the imperial case and the braking case. The
 * two "never" assertions below matter more than the recall number: a parser
 * that stays silent is recoverable, one that invents values is not.
 */
describe('rule-parser standing score', () => {
  const scores = CORPUS.map((entry) => scoreCase(entry, parse(entry.text).assignments));
  const totals = summarize(scores);

  it('never fabricates a value the story does not state', () => {
    expect(totals.fabricated).toBe(0);
  });

  it('never fills a labeled slot with the wrong value', () => {
    expect(totals.wrong).toBe(0);
  });

  it('does not regress below its recorded recall', () => {
    const scoreboard = scores
      .map((s) => `  ${s.id}: ${s.recovered.length}/${s.recovered.length + s.missed.length + s.wrong.length} [${s.recovered.join(' ') || '—'}]`)
      .join('\n');
    console.log(
      `rule parser: ${totals.recovered}/${totals.labeled} labeled slots ` +
        `(recall ${(totals.recall * 100).toFixed(0)}%)\n${scoreboard}`,
    );
    expect(totals.recovered).toBeGreaterThanOrEqual(RULE_PARSER_FLOOR);
  });
});

/**
 * Labeled slots the grammar currently recovers: 15 of 20 (75%).
 * 3/20 → 7/20 with rest-implying verbs ("slips", "breaks loose", "topples")
 * and impact-against-a-named-surface velocity phrases; 7/20 → 9/20 once
 * landing at a *named* ground-level surface ("strikes the pavement", "into the
 * grass") also fixed x₂ = 0.
 * Raise this when the grammar genuinely improves; never lower it to make a
 * change pass.
 */
const RULE_PARSER_FLOOR = 15;
