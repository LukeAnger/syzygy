# Manual test checklist

Companion to [TEST-PROBLEMS.md](TEST-PROBLEMS.md), which is the problem bank.
This is the procedure.

Run on **http://localhost:5173/syzygy/** — the dev panel does not exist in a
production build. Open it with the orange **DEV TOOLS** bar, bottom-left.

> **Scope.** Most grammar behaviour below is already pinned by `corpus.test.ts`
> and `synthetic.test.ts`, so hand-testing it is confirmation, not discovery.
> What genuinely needs eyes is anything crossing into the UI (display units,
> phase rendering, the pending state) and **anything involving the model**,
> which CI cannot reach at all. Part B is the part that will teach you
> something new.

---

## Part A — grammar only (smart parse **off**)

Verifying this session's parser work end to end. Tick the behaviour, not just
the number.

### A1. A stated speed beats an implied one

```text
With an initial upward speed of 23 ft/s, a chunk of ice is released and it comes to rest on the sand.
```

- [ ] `v₀ = 23 ft/s` — **not 0**
- [ ] Displayed in **feet**, `a = −32.17 ft/s²`

The defect was `"released"` firing the from-rest rule and beating the stated
speed. It produced `v₀ = 0`, which is confidently wrong rather than merely
missing. Also exercises imperial detection in one shot.

### A2. Impact speed is readable

```text
A stone is dropped from 60 m and it arrives at 34.3 m/s
```

- [ ] `v = −34.3 m/s` (negative — it is descending)

This phrasing family scored **0 of 245** before the fix. Any impact wording that
doesn't name a surface was simply unreachable.

### A3. Rest verbs and named surfaces

```text
A wrench slips from a scaffold plank 24 m off the ground and, rather than reaching the pavement, comes to rest on the roof of a toolshed that stands 3 m tall.
```

- [ ] `x₁ = 24 m`, `x₂ = 3 m`, `v₀ = 0`
- [ ] `x₂` is **3, not 0** — "rather than reaching the pavement" is a trap

### A4. Imperial end to end

```text
An acorn breaks loose from a branch some 40 feet above the lawn and tumbles, unimpeded, until it thuds into the grass.
```

- [ ] Everything in **ft**, not silently converted to metres
- [ ] `a = −32.17 ft/s²`, `v ≈ −50.7 ft/s`, `t ≈ 1.58 s`

### A5. Gravity does not leak between problems

**Run A4 first, then immediately paste:**

```text
A ball is dropped from a height of 45 m
```

- [ ] `a = −9.81 m/s²` — **not** `−9.805416`

The only cross-problem test here. An imperial story used to leave −32.17 ft/s²
in the form, and the next metric story inherited it as −9.805416 — close enough
to −9.81 to survive a glance, and wrong. No single-problem test catches this.

### A6. The question, and what the answer didn't need

```text
A ball is dropped from a height of 45 m. How fast is it going when it lands?
```

- [ ] An **ASKED FOR v** block leads the solution
- [ ] The worked steps sit below under **Working**

### A7. Staged motion

```text
a ball is dropped off a roof at 150m then falls on another roof thats 30m high. the ball then rolls off and falls to the ground. how fast is the ball traveling when it hits the ground?
```

- [ ] Answer is **≈ −24.3 m/s**, not −54.2
- [ ] **Phase 1 is collapsed and marked NOT NEEDED**
- [ ] A boundary line shows `x₁ = x₂` and `v₀ = 0`
- [ ] The chart plots only phase 2 (~2.5 s, not ~7.4 s)
- [ ] Phase heights are editable, and changing one changes the answer

### A8. No fabricated landing

```text
A capsule descending a mineshaft passes a marker 150 m above the shaft floor while already moving downward at 4 m/s, and its braking system then decelerates it at a steady 1.2 m/s² for the next 6 seconds.
```

- [ ] `v₀ = −4 m/s` (negative), `a = +1.2 m/s²`, `t = 6 s`
- [ ] Solves to `v = 3.20 m/s`, `x₂ = 148 m`
- [ ] `x₂` was **derived**, never assumed to be 0

### A9. Distractors stay unplaced

```text
During a physics demonstration attended by 32 students, a 2.5 kg iron sphere — the third one used that afternoon — was released from rest at the top of a stairwell 18 m above the floor below.
```

- [ ] `Couldn't place: 32, 2.5`
- [ ] Neither number appears in any slot

### A10. Staged but unsplittable

```text
a ball falls 40 m and then rolls off and hits the ground
```

- [ ] A warning says more than one stage is described but only one is modelled

---

## Part B — smart parse (**on**)

Enable the toggle and wait for the model to download (~380 MB, first time only).

**This is the measurement that decides a direction.** The grammar has improved
enough that a problem can parse perfectly while the model contributes nothing —
so "it works" tells you nothing. The dev panel's **`from model`** row is the
model's entire marginal value.

For each problem in Part A, open **DEV TOOLS** and record:

| # | `from model` | raw output sane? | examples resemble it? | ms |
|---|---|---|---|---|
| A1 | | | | |
| A2 | | | | |
| A3 | | | | |
| A4 | | | | |
| A7 | | | | |
| A8 | | | | |

### Reading the result

**`from model` populated on the harder cases** → retrieval is working and the
LLM path is worth investing in. Next step is the 1B model bump, measured the
same way.

**`from model` empty everywhere** → the grammar has overtaken the model. Smart
parse is costing a 380 MB download, a prompt, two guards and a test suite for
nothing. Park it and say so in the spec.

**`from model` populated but wrong** → the guards are doing the work.
`dropUngrounded` and the dimensional check are the only reason bad values aren't
reaching the solver. Worth knowing before trusting the model anywhere else.

### Also check

- [ ] **Examples resemble the problem.** If they look unrelated, the bug is in
      retrieval, not the model — a different fix entirely.
- [ ] **Raw output is valid JSON** with all seven keys.
- [ ] **Solve shows "Solving…"** and pulses while the model runs, then recovers.
      Only visible on this path; grammar-only parses finish too fast to see.
- [ ] **No answer gets worse than grammar-only.** `mergeParses` gives the
      grammar priority, so enabling smart parse must never degrade a result. If
      it does, that is a bug in the merge, not the model.

---

## If something fails

Say which item, and paste the **DEV TOOLS** readout plus the `[smart parse] raw:`
console line. The engine split and the retrieved examples usually localise the
fault immediately — grammar, retrieval, model, or transform.
