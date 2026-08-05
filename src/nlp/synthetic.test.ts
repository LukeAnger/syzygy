/**
 * Scores the grammar against the generated corpus.
 *
 * The artifact is produced by `tools/corpus-gen` — an authoring tool that
 * nothing under `src/` imports. The dependency runs one way, tool → data →
 * tests, so the generator can change freely without touching the bundle.
 *
 * Reported separately from the hand-written corpus on purpose. Synthetic cases
 * measure *breadth* — which phrasings the grammar can and cannot reach — while
 * the hand-written ones measure reality. Averaging them into one number would
 * let thousands of machine-made sentences drown out the handful that were
 * actually observed, and flatter the parser accordingly.
 */
import { describe, expect, it } from 'vitest';
import { type CorpusCase, scoreCase, summarize } from './corpus.ts';
import { UNITS } from './grammar.ts';
import { parse } from './parse.ts';
import type { VariableKey } from '../engine/index.ts';
// Imported rather than read from disk: this project has no `@types/node`, and
// a missing artifact should break the build loudly rather than skip in silence.
import artifact from '../../corpus/synthetic.json';

interface RawCase {
  id: string;
  text: string;
  expected: Record<string, [number, string]>;
  absent: string[];
  distractors: number[];
  tags: Record<string, unknown>;
}

/** Resolve the artifact's unit *names* into the math core's unit objects. */
function toCorpusCase(raw: RawCase): CorpusCase {
  const expected: CorpusCase['expected'] = {};
  for (const [key, [value, unitName]] of Object.entries(raw.expected)) {
    const unit = UNITS[unitName];
    if (!unit) throw new Error(`unknown unit "${unitName}" in ${raw.id}`);
    expected[key as VariableKey] = [value, unit];
  }
  return {
    id: raw.id,
    text: raw.text,
    expected,
    absent: raw.absent as VariableKey[],
    distractors: raw.distractors,
    probes: JSON.stringify(raw.tags),
  };
}

const cases: CorpusCase[] = (artifact.cases as unknown as RawCase[]).map(toCorpusCase);

describe('synthetic corpus', () => {
  it('is large enough to say anything', () => {
    expect(cases.length).toBeGreaterThan(100);
  });

  it('labels every case with something', () => {
    for (const entry of cases) {
      expect(Object.keys(entry.expected).length).toBeGreaterThan(0);
    }
  });

  describe('rule-parser standing score', () => {
    const scores = cases.map((entry) => scoreCase(entry, parse(entry.text).assignments));
    const totals = summarize(scores);

    /**
     * A wrong value is worse than a missing one, so this is capped rather than
     * floored — and the cap only moves down.
     *
     * The cases behind it are a real finding, not noise. The grammar treats
     * "released" as "from rest", so *"with an initial upward speed of 23 ft/s,
     * a chunk of ice is released"* comes back as v0 = 0 — confidently wrong,
     * where staying silent would have been recoverable. Fixing it means making
     * the rest rule yield when a velocity is stated nearby.
     */
    it('does not exceed its recorded wrong-value count', () => {
      const offenders = scores.filter((s) => s.wrong.length > 0);
      if (offenders.length > 0) {
        console.log(
          `synthetic: ${offenders.length} cases with a wrong value — ` +
            `${offenders.slice(0, 3).map((s) => `${s.id}:${s.wrong.join(',')}`).join(' ')}`,
        );
      }
      expect(offenders.length).toBeLessThanOrEqual(WRONG_VALUE_CEILING);
    });

    it('never adopts a distractor', () => {
      const offenders = scores.filter((s) => s.adoptedDistractors.length > 0).slice(0, 5);
      expect(
        offenders.map((s) => `${s.id}: ${s.adoptedDistractors.join(',')}`),
        'a mass or a headcount is not a kinematic quantity',
      ).toEqual([]);
    });

    it('does not regress below its recorded recall', () => {
      // Per-slot breakdown: the aggregate hides which phrasings are unreachable,
      // and that breakdown is the entire point of generating breadth.
      const perSlot = new Map<string, { got: number; total: number }>();
      for (const s of scores) {
        for (const k of s.recovered) {
          const e = perSlot.get(k) ?? { got: 0, total: 0 };
          perSlot.set(k, { got: e.got + 1, total: e.total + 1 });
        }
        for (const k of [...s.missed, ...s.wrong]) {
          const e = perSlot.get(k) ?? { got: 0, total: 0 };
          perSlot.set(k, { got: e.got, total: e.total + 1 });
        }
      }
      const breakdown = [...perSlot.entries()]
        .sort()
        .map(([k, v]) => `  ${k}: ${v.got}/${v.total} (${Math.round((100 * v.got) / v.total)}%)`)
        .join('\n');

      console.log(
        `synthetic: ${totals.recovered}/${totals.labeled} labeled slots ` +
          `(recall ${(totals.recall * 100).toFixed(0)}%) over ${cases.length} cases\n${breakdown}`,
      );
      expect(totals.recovered / totals.labeled).toBeGreaterThanOrEqual(SYNTHETIC_FLOOR);
    });
  });
});

/**
 * Recall the grammar currently reaches on generated prose. A ratchet, not a
 * target — raise it when the grammar genuinely improves.
 *
 * If this ever approaches 1.0, suspect the phrasing bank before celebrating:
 * it most likely means someone sourced phrasings from `grammar.ts`, and the
 * corpus has quietly become a mirror.
 */
const SYNTHETIC_FLOOR = 0.38;

/**
 * Cases the grammar answers with a wrong value rather than none. Only ever
 * lower this — it is a defect count, not a budget.
 */
const WRONG_VALUE_CEILING = 32;
