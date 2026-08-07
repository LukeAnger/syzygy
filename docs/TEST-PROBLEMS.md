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

Problems 1–5 are machine-scored in `src/nlp/corpus.ts`. For a step-by-step
procedure — including how to measure whether smart parse contributes anything —
see [TEST-CHECKLIST.md](TEST-CHECKLIST.md).

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

## Relative velocity

From a standard problem set, which turned out to be a useful scope check. When
it was first run, **one of the seven was solvable and five needed capabilities
the app did not have** — relative velocity as taught is largely a 2-D vector
topic, and the `relative-velocity` pack is 1-D.

Three are solvable now: RV1 and RV2 below, and RV3 in the 2-D section. Of the
remaining four, two state every quantity as a letter, one is conceptual with no
quantities at all, and one is rotational kinematics.

### RV1. Two vehicles, one overtaking

```text
A motorcycle traveling on the highway at a speed of 120 km/h passes a car traveling at a speed of 90 km/h. From the point of view of a passenger on the car, what is the velocity of the motorcycle?
```

**Answer: 30 km/h.** Works end to end — domain detected, both speeds read
positionally, `asked` resolved to `v_rel`, answer rendered in km/h.

### RV2. Inferring a zero velocity

```text
A ball is kicked off the back of a pickup truck traveling at 50 km/h. A pedestrian on the ground sees the ball hit the pavement and then bounce straight up. What was the velocity of the ball relative to the truck?
```

**Answer: 50 km/h, opposite to the truck's travel.** Works end to end now. It
needed the two things this page previously listed as gaps:

- **The question naming which body is which.** "Velocity of the ball relative
  to the truck" makes the truck the reference frame, so it is body B — even
  though the truck is mentioned *first* and word order would make it body A and
  invert the answer. `namedFrame` reads the roles out of the phrase and outranks
  position; a story that names no frame falls through to word order unchanged,
  which is how RV1 still gives 30 km/h.
- **A velocity stated in words, not numbers.** "Bounce straight up" means the
  ball has no horizontal velocity relative to the ground, so `v_a = 0`. The only
  number in the problem belongs to the other body.

That second one also had to reach *detection*, which required two stated speeds
and this problem only has one. The bar now counts velocity **facts**: a body
described as having no motion along the line has been given a velocity as
surely as one given a number. Only counted inside a named frame, since loose
stillness phrases ("released at rest") are ordinary free-fall wording and
letting them count anywhere would drag one-object problems across the line.

### Out of scope

| Problem | Needs |
|---|---|
| "Why take off into the wind?" | conceptual — no quantities at all |
| Scotch yoke sliding velocity | rotational kinematics, ω and linkage geometry |

The four 2-D problems that used to sit in this table are now in scope — see
below.

---

## 2-D relative velocity

Detected from a **crossing** cue plus a **moving medium** cue plus at least one
stated speed. All three are required: "ignore wind resistance" and "walks
across the room" each trip one bar on their own, and neither is planar.

The parser chooses the axes, and the choice is part of the reading:

- **+x is downstream** — the way the current or wind pushes
- **+y is across** — the way the body is trying to go

### RV2D1. Drift crossing

```text
A duck swims at a constant speed from one side of a river to the other side in a time of 4 seconds. The river is 6 meters wide and it is flowing at a speed of 2 m/s. What is the velocity of the duck and what is its direction of travel, with respect to ground?
```

Expected: `s_y` 6 m, `t` 4 s, `v_2x` 2 m/s, and two inferred zeros — `v_1x` 0
(aimed straight across) and `v_2y` 0 (the current runs along the bank, not
across it). The across-speed is **not stated anywhere**: 1.5 m/s has to come out
of 6 m ÷ 4 s, which is why the domain needed displacement and time at all.

Answer: **2.5 m/s at 36.87°** from downstream — 53.13° off straight across.

### RV2D2. Compensation crossing

```text
A swimmer who can swim at 1.2 m/s must head upstream to land directly opposite across a river 30 m wide flowing at 0.5 m/s. At what angle must she head?
```

Expected: `v_1` 1.2 m/s as a **magnitude only** — her heading is the unknown, so
filing it as `v_1y` would assert the answer — plus `v_Rx` 0, because landing
directly opposite means nothing carried her downstream.

Answer: **114.62°**, which is 24.62° upstream of straight across. The crossing
takes 27.5 s.

### The pair is the test

Run these two together every time. They are written in nearly the same words
and need opposite models: the drifting swimmer has no downstream speed *of her
own*, the compensating one has no downstream drift *in the result*. Read either
as the other and the app returns a plausible, fully worked, wrong answer — the
failure this codebase cares most about.

The cues that separate them are deliberately narrow: they name aiming upstream
or landing directly opposite, and nothing vaguer. **"At what angle" is not one
of them**, because it asks the drift question exactly as often as the other one.

### Still out of scope in 2-D

- Angles given as **input** ("heading 30° north of east"). These problems ask
  for headings far more than they state them, and teaching the unit table the
  word "degrees" would hand every other detector a dimensionless number to trip
  over for almost no gain.
- Compass directions, and "north of east" phrasing generally.
- Wind problems that are not crossings — a plane with a quartering tailwind is
  the same math, but no cue here recognises it.

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
