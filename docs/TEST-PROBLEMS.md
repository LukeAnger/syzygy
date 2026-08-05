# Storymode test problems

Prose word problems for hand-testing the parsers, ordered easy → hard. They're
deliberately harder than the phrasings in `parse.test.ts`: distractor
quantities, subordinate clauses, negated references, and verbs no grammar rule
enumerates.

Each problem sits in its own fenced block on a single line, so it copies cleanly
in one go. GitHub renders a copy button on these; VS Code's built-in markdown
preview doesn't add one in either case, so triple-click the line to select it.

Copy a block, paste it into Storymode, hit **Solve**. With smart parse on, open
the browser console — `[smart parse] raw:` prints the model's actual JSON, which
is the only way to tell a bad extraction from a bad transform.

Problems 1–5 are machine-scored in `src/nlp/corpus.ts`.

---

## 1. Distractor numbers

```text
During a physics demonstration attended by 32 students, a 2.5 kg iron sphere — the third one used that afternoon — was released from rest at the top of a stairwell 18 m above the floor below.
```

**Probes:** irrelevant quantities (32, 2.5, "the third one") must not be claimed
by any slot. "Released from rest" implies v₀ = 0.

| x₁ | x₂ | v₀ | v | a | t | units |
|----|----|----|---|---|---|-------|
| 18 m | 0 m | 0 m/s | — | −9.81 m/s² | — | metric |

---

## 2. Raised landing, stated indirectly

```text
A wrench slips from a scaffold plank 24 m off the ground and, rather than reaching the pavement, comes to rest on the roof of a toolshed that stands 3 m tall.
```

**Probes:** compositional landing height, plus a negated ground reference
("rather than reaching the pavement") that invites x₂ = 0. "Slips" implies rest
without saying so.

| x₁ | x₂ | v₀ | v | a | t | units |
|----|----|----|---|---|---|-------|
| 24 m | 3 m | 0 m/s | — | −9.81 m/s² | — | metric |

---

## 3. Sign convention on final velocity

```text
Standing at ground level, a girl hurls a pebble straight up; it leaves her hand at 20 m/s and, on the way back down, strikes the pavement travelling at 30 m/s.
```

**Probes:** two velocities in one sentence, the second of which must come out
negative because the object is descending. Watch for `v = 30`.

| x₁ | x₂ | v₀ | v | a | t | units |
|----|----|----|---|---|---|-------|
| 0 m *(or unset)* | 0 m | 20 m/s | −30 m/s | −9.81 m/s² | — | metric |

x₁ is ambiguous by design — "standing at ground level" supports 0, but leaving
it unset is equally defensible. Don't score it either way.

---

## 4. Imperial, hedged number, unknown verbs

```text
An acorn breaks loose from a branch some 40 feet above the lawn and tumbles, unimpeded, until it thuds into the grass.
```

**Probes:** imperial detection (and with it imperial gravity), a hedged quantity
("some 40 feet"), and verbs no rule enumerates ("breaks loose", "thuds").

| x₁ | x₂ | v₀ | v | a | t | units |
|----|----|----|---|---|---|-------|
| 40 ft | 0 ft | 0 ft/s | — | −32.17 ft/s² | — | **imperial** |

If this comes back as "40 m" with a = −9.81, unit detection failed and the value
was read in the wrong system.

---

## 5. Stated acceleration overriding gravity

```text
A capsule descending a mineshaft passes a marker 150 m above the shaft floor while already moving downward at 4 m/s, and its braking system then decelerates it at a steady 1.2 m/s² for the next 6 seconds.
```

**Probes:** the hard one. Negative initial velocity from "moving downward", a
stated acceleration that replaces gravity, a duration, and a final position that
must stay **empty** — nothing says the capsule reaches the floor.

| x₁ | x₂ | v₀ | v | a | t | units |
|----|----|----|---|---|---|-------|
| 150 m | *(must stay empty)* | −4 m/s | — | +1.2 m/s² | 6 s | metric |

`a` is positive: braking opposes downward motion. An x₂ of 0 here is a
fabrication — it invents a landing and produces a confident wrong Δx.

---

## 6. Two-phase motion with a same-kind distractor

```text
a ball is dropped off a roof at 150m then falls on another roof thats 30m high. the ball then rolls off and falls to the ground. how fast is the ball traveling when it hits the ground?
```

**Probes:** the hardest class. Two falls with the ball at rest between them, so
the answer depends **only on the second**. The 150 m is a red herring — and one
of the same kind as the real value, which is what makes it nasty: a parser that
grabs the first height gets a plausible, confident, wrong answer.

Also probes question detection: "how fast" ⇒ target `v`.

| Phase | x₁ | x₂ | v₀ | a | result |
|-------|----|----|----|---|--------|
| 1 — roof to roof | 150 m | 30 m | 0 m/s | −9.81 m/s² | lands, comes to rest |
| 2 — roof to ground | 30 m | 0 m | 0 m/s | −9.81 m/s² | **v ≈ −24.3 m/s** |

**Answer: ≈ −24.3 m/s.** A single-phase reading gives −54.2 m/s, which is the
mistake the problem is built to catch.

Deliberately written in loose student prose ("thats", no comma splices tidied)
— parsers shouldn't need well-formed input.

> **Status:** solved end to end. `nlp/segment.ts` splits the height chain into
> phases, `engine/phases.ts` solves the sequence, and the Solution panel renders
> one block per phase with the answer drawn from the last. Pasting this into
> Storymode returns −24.3 m/s.

---

## Reading the results

A **missing** value is far better than an **invented** one. Missing degrades to
"not enough information to solve"; invented produces a confident wrong answer
with a full worked solution behind it. Score those two failures separately.

Known-good baselines to compare against:

- **Grammar alone** (smart parse off) recovers 9 of 20 labeled slots across
  #1–#5 — `v0` on all five, `v` and `x2` on #3, `x2` on #4, `t` on #5. The live
  figure is printed by `corpus.test.ts` on every test run.
- Example values in the smart-parse prompt are deliberately odd — **14, 26, 62,
  3.5**. Any of those appearing for a problem that doesn't contain them means
  the model copied from its examples rather than reading the story.
