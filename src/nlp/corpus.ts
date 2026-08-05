/**
 * Labeled word-problem corpus — the seed of the NLP standards system.
 *
 * These are hand-written prose problems, not phrasings lifted from the
 * grammar's own trigger list, so they measure what the parsers do with
 * language they were not built around. Each entry records what a competent
 * reader would extract, which makes it a shared yardstick: the rule parser and
 * smart parse are scored against the same labels for the same problems.
 *
 * Deliberately harder than the curated cases in `parse.test.ts`. Those check
 * that a known phrase maps to a known slot; these check whether anything
 * survives contact with distractor quantities, subordinate clauses, negated
 * references, and verbs no rule enumerates.
 *
 * Living in `nlp/` rather than `nlp/smart/` on purpose — it belongs to neither
 * parser. `corpus.test.ts` scores the grammar against it on every run (no GPU
 * needed); smart parse is scored by hand on real hardware, since CI has no
 * WebGPU.
 *
 * Values are `[magnitude, unit]` pairs rather than raw numbers so an imperial
 * problem can be labeled in feet and compared through the math core.
 */
import {
  FOOT,
  FOOT_PER_SECOND,
  FOOT_PER_SECOND_SQUARED,
  METRE,
  METRE_PER_SECOND,
  METRE_PER_SECOND_SQUARED,
  SECOND,
  type Unit,
  fromUnit,
} from '../math/index.ts';
import type { VariableKey } from '../engine/index.ts';
import type { Assignment } from './types.ts';

export interface CorpusCase {
  id: string;
  text: string;
  /** What the story states or implies, as `[magnitude, unit]`. */
  expected: Partial<Record<VariableKey, [number, Unit]>>;
  /**
   * Slots that must stay empty. A parser filling one has fabricated it, which
   * is worse than missing a value: it turns "not enough information" into a
   * confident wrong answer.
   */
  absent?: VariableKey[];
  /** What this case is designed to probe. */
  probes: string;
}

export const CORPUS: CorpusCase[] = [
  {
    id: 'stairwell-distractors',
    text:
      'During a physics demonstration attended by 32 students, a 2.5 kg iron ' +
      'sphere — the third one used that afternoon — was released from rest at ' +
      'the top of a stairwell 18 m above the floor below.',
    expected: {
      x1: [18, METRE],
      x2: [0, METRE],
      v0: [0, METRE_PER_SECOND],
      a: [-9.81, METRE_PER_SECOND_SQUARED],
    },
    probes:
      'Irrelevant quantities (32 students, 2.5 kg, "the third one") must not ' +
      'be claimed by any slot. "Released from rest" implies v0=0.',
  },
  {
    id: 'wrench-raised-landing',
    text:
      'A wrench slips from a scaffold plank 24 m off the ground and, rather ' +
      'than reaching the pavement, comes to rest on the roof of a toolshed ' +
      'that stands 3 m tall.',
    expected: {
      x1: [24, METRE],
      x2: [3, METRE],
      v0: [0, METRE_PER_SECOND],
      a: [-9.81, METRE_PER_SECOND_SQUARED],
    },
    probes:
      'Compositional landing height, plus a negated ground reference ' +
      '("rather than reaching the pavement") that invites x2=0. "Slips" ' +
      'implies rest without saying so.',
  },
  {
    id: 'pebble-signed-final-velocity',
    text:
      'Standing at ground level, a girl hurls a pebble straight up; it leaves ' +
      'her hand at 20 m/s and, on the way back down, strikes the pavement ' +
      'travelling at 30 m/s.',
    // x1 is intentionally unlabeled: "standing at ground level" supports x1=0,
    // but leaving it unstated is equally defensible, so scoring it would
    // penalize a correct reading.
    expected: {
      x2: [0, METRE],
      v0: [20, METRE_PER_SECOND],
      v: [-30, METRE_PER_SECOND],
      a: [-9.81, METRE_PER_SECOND_SQUARED],
    },
    probes:
      'Two velocities in one sentence, the second of which must come out ' +
      'negative because the object is descending.',
  },
  {
    id: 'acorn-imperial',
    text:
      'An acorn breaks loose from a branch some 40 feet above the lawn and ' +
      'tumbles, unimpeded, until it thuds into the grass.',
    expected: {
      x1: [40, FOOT],
      x2: [0, FOOT],
      v0: [0, FOOT_PER_SECOND],
      a: [-32.17, FOOT_PER_SECOND_SQUARED],
    },
    probes:
      'Imperial detection (and with it imperial gravity), a hedged quantity ' +
      '("some 40 feet"), and verbs no rule enumerates ("breaks loose", "thuds").',
  },
  {
    id: 'capsule-braking',
    text:
      'A capsule descending a mineshaft passes a marker 150 m above the shaft ' +
      'floor while already moving downward at 4 m/s, and its braking system ' +
      'then decelerates it at a steady 1.2 m/s² for the next 6 seconds.',
    expected: {
      x1: [150, METRE],
      v0: [-4, METRE_PER_SECOND],
      a: [1.2, METRE_PER_SECOND_SQUARED],
      t: [6, SECOND],
    },
    // The capsule is still moving when the problem stops; nothing says it
    // reaches the floor.
    absent: ['x2'],
    probes:
      'Negative initial velocity from "moving downward", a stated ' +
      'acceleration that replaces gravity, a duration, and a final position ' +
      'that must be left empty rather than assumed to be the ground.',
  },
];

/** How one parser did on one case. */
export interface CaseScore {
  id: string;
  /** Labeled slots recovered with the right value. */
  recovered: VariableKey[];
  /** Labeled slots the parser did not fill at all. */
  missed: VariableKey[];
  /** Labeled slots filled with the wrong value. */
  wrong: VariableKey[];
  /** Slots required to stay empty that the parser filled anyway. */
  fabricated: VariableKey[];
}

/** Values agree if they match to within floating-point noise. */
function agrees(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) <= 1e-6 * Math.max(1, Math.abs(expected));
}

/**
 * Score a parser's assignments for one case.
 *
 * Parser-agnostic by design: it takes assignments, so the grammar, smart
 * parse, and any merge of the two are all measured the same way.
 */
export function scoreCase(
  entry: CorpusCase,
  assignments: Assignment[],
): CaseScore {
  const actual = new Map(
    assignments.map((a) => [a.variable as VariableKey, a.quantity.value]),
  );
  const score: CaseScore = {
    id: entry.id,
    recovered: [],
    missed: [],
    wrong: [],
    fabricated: [],
  };

  for (const [key, label] of Object.entries(entry.expected)) {
    if (!label) continue;
    const variable = key as VariableKey;
    const got = actual.get(variable);
    if (got === undefined) score.missed.push(variable);
    else if (agrees(got, fromUnit(label[0], label[1]).value))
      score.recovered.push(variable);
    else score.wrong.push(variable);
  }

  for (const variable of entry.absent ?? []) {
    if (actual.has(variable)) score.fabricated.push(variable);
  }
  return score;
}

/** Corpus-wide totals. Recall is over labeled slots only. */
export function summarize(scores: CaseScore[]) {
  const total = (pick: (s: CaseScore) => VariableKey[]) =>
    scores.reduce((n, s) => n + pick(s).length, 0);
  const recovered = total((s) => s.recovered);
  const labeled = recovered + total((s) => s.missed) + total((s) => s.wrong);
  return {
    recovered,
    labeled,
    wrong: total((s) => s.wrong),
    fabricated: total((s) => s.fabricated),
    recall: labeled === 0 ? 0 : recovered / labeled,
  };
}
