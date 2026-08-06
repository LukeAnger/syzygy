# corpus-gen

Authoring tool for the synthetic problem corpus. **Not part of the app.**

Nothing under `src/` imports this. It writes `corpus/synthetic.json`, which the
test suite reads — so the dependency runs one way:

```
tools/corpus-gen  →  corpus/synthetic.json  →  src/nlp/synthetic.test.ts
```

The generator can be rewritten freely without touching the shipped bundle. It is
plain `.mjs`, outside `tsconfig` (which includes only `src`) and outside eslint's
scope, so it carries none of the app's build or lint constraints.

## Usage

```bash
npm run corpus:generate -- --count 1200 --seed 1   # the corpus
npm run corpus:examples                            # the retrieval bank
npm run corpus:report                              # corpus/report.md
```

`corpus:examples` distils the corpus into `src/nlp/smart/examples.json`, the
bank smart parse retrieves few-shot examples from. That file *is* shipped, but
only in the lazy smart-parse chunk (165 KB, 20 KB gzipped) — a user who never
enables smart parse never downloads it. Regenerate it whenever the corpus
changes.

Deterministic: same seed, same corpus, so scores are comparable across runs.
The artifact is committed, so CI does not depend on regenerating it.

## Why the labels are trustworthy

Values are chosen **first** and the prose is rendered to describe them, so labels
are correct by construction. Nobody solves a thousand problems by hand — what
needs human review is the phrasing bank in `phrasings.mjs`, a few dozen strings,
not the instances.

Derived quantities (`v`, `t`) are computed with real kinematics, rounded, and the
rounded value is what both the prose and the label carry, so each problem is
internally consistent and solvable the way a textbook's would be. Combinations
that aren't physically realisable are discarded rather than clamped.

## The rule that makes this worth anything

**The phrasing bank must never be sourced from `src/nlp/grammar.ts`.**

Write phrasings because a textbook says them, not because you just saw them in
the grammar. A corpus drawn from the parser's own vocabulary is a mirror: it
reports ~100% and teaches nothing. That is not hypothetical — `parse.test.ts`
passes at essentially 100% because its cases were written alongside the rules,
while the same grammar scored 3/20 on five problems written without consulting
it.

If synthetic recall ever approaches 1.0, suspect the bank before celebrating.

## Reading the scores

`synthetic.test.ts` prints a per-slot breakdown, which is the point of generating
breadth — the aggregate hides *which* phrasings are unreachable. At the time of
writing:

```
synthetic: 2439/5048 labeled slots (recall 48%) over 1200 cases
  a:  0/1200   (0%)    grammar never emits acceleration; the app supplies it
  t:  323/488  (66%)
  v:  190/245  (78%)
  v0: 861/1200 (72%)
  x1: 586/967  (61%)
  x2: 479/948  (51%)
```

The first run scored 39%, with `v` at 0/245 and 32 cases answered with a wrong
value. Both were real defects the corpus surfaced, and both are now fixed — see
the git history for what changed. `x1` and `x2` are the standing gaps.

Three assertions guard quality, and two of them only move in one direction:

- **recall floor** — a ratchet; raise it when the grammar genuinely improves.
- **wrong-value ceiling** — a defect count, not a budget; only ever lower it.
  A wrong value is worse than a missing one.
- **distractor adoption** — must stay zero. A mass or a headcount is not a
  kinematic quantity, and claiming one is fabrication.

## Known limitations

- **Single-phase only.** `CorpusCase` has a flat set of expected values, so
  staged motion isn't represented. Multi-phase cases would need the case type to
  carry a phase sequence.
- **Synthetic ≠ real.** These measure breadth of phrasing, not the distribution
  of real problems. They are scored separately from the hand-written corpus in
  `src/nlp/corpus.ts` for that reason, and the two numbers should never be
  averaged — thousands of machine-made sentences would drown out the handful
  that were actually observed.
