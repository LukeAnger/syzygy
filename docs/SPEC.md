# Syzygy — Product & Technical Specification

> Free-fall kinematics solver and tutor, rebuilt as a general 1-D kinematics
> product. This document is the shared blueprint agreed before the rewrite.

---

## 1. Vision

Syzygy is a **physics tutor**, not merely a solver. Anyone can compute
`t = (v − v₀) / a`. The value — and the moat — is the *worked, step-by-step
pedagogy*: pick the right equation, rearrange it for the unknown, substitute
known values with units, and arrive at the answer, all shown the way a good
teacher would show it.

The name means *astronomical alignment*; the product aligns what a student
knows with what they're trying to find.

## 2. Goals & Non-Goals (v1)

**Goals**
- A complete, provably-correct **1-D constant-acceleration (SUVAT)** engine.
  Free fall is a preset (`a = −9.81 m/s²`), not the whole product.
- **Auto-solve-all:** given any 3 of the 5 kinematic variables, solve the rest
  and show a worked tutorial for each.
- **Answer the question that was asked.** Auto-solve-all is the right default
  when nobody said what was wanted, but it is not by itself tutoring. Textbook
  problems ask for one specific quantity, and part of the skill being taught is
  telling which given values serve that question — problems routinely include a
  solvable-but-irrelevant value precisely to test that. So the parser reads the
  question (§4.6), the answer leads the solution, and any given the answer never
  depended on is named as such. A tutor that silently consumes every given has
  done that discrimination *for* the student.
- **Natural-language entry:** type/paste/speak a word problem and have it
  pre-fill the variable form.
- **Real units** (metric/imperial) via an in-house dimensional-math core, and
  **answers in the units the question used**. A student who writes 120 km/h and
  reads back 33.3 m/s has been given a correct answer to a question they did
  not ask. The system decides metric or imperial; the *story* decides km/h over
  m/s, and one kit governs both reading the input and rendering the result.
- A distinctive **Tron / low-poly** student-facing UI.
- Fully **static** deployment (no backend, no API keys, no per-request cost).

**Non-Goals (v1)**
- Accounts, persistence, subscriptions, classroom/teacher features.
- Server-side or LLM-based parsing (revisit only if the NLP grammar proves
  insufficient and the security/cost tradeoff changes).
- Subjects beyond 1-D kinematics (Ohm's law, 2-D motion, chemistry are
  *designed for* but not *built* in v1 — see Roadmap).

## 3. Audience

Students, self-serve. B2C. Design the data model so classroom features *could*
be layered on later, but build none of them now.

---

## 4. Architecture

Four layers, each depending only on the one below. This is the core of the
rewrite.

```
ui/        React + CSS Modules + KaTeX + Chart.js   (presentation)
   │
state/     Zustand store                            (app state)
   │
nlp/       tokenizer + slot-grammar                 (word problem → variables)
   │
domains/   declarative equation packs (kinematics-1d)
   │
engine/    constraint-propagation solver            (auto-solve-all)
   │
math/      quantities + dimensions + units          (in-house, no mathjs)
```

### 4.1 `math/` — in-house quantities & dimensional analysis

The foundation. Physics/chem equations are pure functions; a small dimensional
core is far less code than importing a general CAS.

- A **`Quantity`** is `{ value: number, dimension: Dimension }`.
- A **`Dimension`** is an integer vector over base dimensions
  `[L, T, M, I, Θ, N, J]` (length, time, mass, current, temperature, amount,
  luminous intensity). v1 uses only L and T; the basis is there so chem/EM
  extend without rework.
- A **`Unit`** is `{ factor, dimension }` (e.g. `ft = { factor: 0.3048, [L:1] }`).
- Arithmetic — `add`, `sub`, `mul`, `div`, `pow`, `sqrt` — **propagates
  dimensions**. `m/s ÷ s` yields `m/s²` automatically; adding `m` to `s` is a
  **typed error we surface to the student**, not a silent NaN.
- Conversion, sig-fig-aware formatting, and metric↔imperial live here. This is
  what finally makes "imperial" real instead of a label swap.

Target: ~200–300 lines, exhaustively unit-tested.

### 4.2 `engine/` — constraint-propagation solver

Domain-agnostic. Consumes `math/`, drives `domains/`.

- Input: a set of **known `Quantity`s** keyed by variable.
- Loop: find any equation in the active domain with **exactly one unknown**
  among its variables → solve it via that equation's closed form → add the
  result to the known set → repeat until nothing new can be solved.
- Output: the full solved variable set **plus a dependency-ordered list of
  solution steps** (which equation, in what order, producing what) — exactly
  what the tutor renders. Auto-solve-all falls out of this for free.
- **Multi-root handling:** closed-form functions return `Quantity[]`. Quadratic
  solves (e.g. `t` from `Δx = v₀t + ½at²`) yield two roots; the engine applies a
  **physical-root selector** (e.g. `t ≥ 0`) and records *why* a root was
  discarded so the tutor can explain it.

### 4.3 `domains/` — declarative equation packs

Each domain is **data**, not components. `kinematics-1d` defines the five SUVAT
variables and equations; each equation carries, per solvable target, a pure
closed-form function, a KaTeX template for the rearranged form, and a
substitution renderer. Adding Ohm's law later is a new pack with **zero engine
changes**.

### 4.4 `nlp/` — word-problem parser

Fully client-side, deterministic, testable. Regex was a throwaway prototype;
this replaces it.

- **Tokenizer:** a hand-rolled tokenizer (number/unit extraction) behind a
  `Tokenizer` interface — zero external NLP dependency, fully in-house, and the
  interface keeps it swappable if a richer library is ever wanted.
- **Slot-grammar:** curated intent patterns map matched phrases to variable
  slots (see §7). Numbers + units become `Quantity`s.
- **Graceful degradation:** the manual variable form is the **ground truth**.
  NLP *pre-fills* it; anything unmatched is left blank and visibly editable, and
  the UI highlights what it understood. This is the safety net regex never had.

### 4.5 `ui/` — presentation

- **React 18 + TypeScript**, **CSS Modules** (no Tailwind).
- **KaTeX** as a pure *renderer* for equations and worked steps (not a math
  library — computation stays in `math/`).
- **Chart.js** (via `react-chartjs-2`) for the relationship plots.
- **Zustand** for the small amount of app state.
- **Design tokens** (CSS custom properties) for the Tron theme — see §9.

### 4.6 The asked-for variable & relevance

Two small pieces turn "solve everything" into "answer the question".

**`nlp/question.ts`** reads what the problem wants — "what is the ball's speed
when it hits the ground?" ⇒ target `v`. Deliberately a grammar rather than a
model: the way problems *pose questions* is far more regular than the way they
narrate scenarios ("find the…", "how fast", "what was the…" is a short closed
list), and a deterministic mistake is easier to debug than a stochastic one.
It distinguishes "initial speed" (`v0`) from a bare "speed" (`v`), and takes the
**last** question when several are asked, since multi-part problems are worked
in order. A story that only narrates yields no target, and the app falls back to
solving everything.

**`engine/relevance.ts`** answers "which givens carried this answer?" by walking
the solution backwards: `SolutionStep` already records the inputs each step
consumed, so no new bookkeeping is needed. Givens outside that dependency set
are reported as *given but not needed* — the distractor.

`phaseRelevanceFor` runs the same trace **across segment boundaries**. A value
that arrived over a link continues the trace in the segment that produced it; a
value the story stated ends it. Whole segments never reached are ones the
student did not need. `solvePhases` records that provenance (`inherited`) —
crucially *excluding* the zero velocity a `rest` link injects, since that is
supplied by the boundary rather than carried, which is exactly why coming to
rest severs the dependency on everything before it.

**The reasoning is shown as maths, not prose.** Each boundary renders its own
condition — `x₁ = x₂` with `v₀ = 0` (rest), `v₀ = v` (continuous) or
`v₀ = −e·v` (bounce). That *is* the explanation of why an earlier stage does or
doesn't reach the answer: `v₀ = 0` has no `v` on the right-hand side, so nothing
about the previous stage's speed can cross it, while `v₀ = v` plainly does.

Deliberately not worded. An earlier version carried hand-written sentences per
case, which had two problems: a student has to take prose on trust, whereas an
equation can be checked against the numbers printed beside it; and every new
situation needs another sentence written by hand. Natural-language explanation
is a candidate for a future paid AI tier — where a model is generating language
rather than asserting physics the engine already knows.

An irrelevant segment collapses to a labelled line with its working behind a
disclosure — collapsed, never hidden, so anyone who wants to check it still can.
The chart plots only the segments the answer rests on, for the same reason:
drawing a stage the answer ignores makes it look load-bearing.

This corrects a real regression. Multi-phase initially rendered *every* segment
at equal prominence, which reproduced the exact failure §2 exists to prevent —
solving everything instead of answering what was asked — one level up, and
looked more thorough while teaching less. Two honest limits remain:
- It reflects the derivation actually shown. Where several routes to the target
  exist the solver commits to one, and that route is what the student reads.
- It claims nothing when the target is unsolved; an unfinished derivation is no
  evidence that anything was unnecessary.

Relevance tracing does **not** catch a distractor of the same *kind* as the real
value — a problem giving two heights where only the second matters. There the
parse picks the wrong `x1` before tracing runs, so the trace faithfully reports
that everything used was needed. That case is handled instead by segmenting the
story into phases (§4.7): the answer comes from the final segment, which makes
the earlier height irrelevant structurally rather than by analysis.

### 4.7 Multi-phase motion

`nlp/segment.ts` splits a story into motion segments and `engine/phases.ts`
solves the sequence; see the Roadmap entry for the model, the link kinds, and
what remains uncovered. Segmentation is opt-in on evidence — no staging cue, or
fewer than three distinct heights, and the story is solved as a single segment
exactly as before.

---

## 5. SUVAT model

Variables:

| Symbol | Meaning                    | Base unit |
|--------|----------------------------|-----------|
| `v0`   | initial velocity           | m/s       |
| `v`    | final velocity             | m/s       |
| `a`    | acceleration               | m/s²      |
| `t`    | time                       | s         |
| `x1`   | initial position           | m         |
| `x2`   | final position             | m         |
| `dx`   | displacement (Δx), derived | m         |

Displacement is **derived** from the two positions via `Δx = x₂ − x₁`, not
entered directly. This matches how problems are stated ("dropped from 100 m,
lands on a 4 m truck" ⇒ x₁=100, x₂=4, Δx=−96) and lets the parser extract two
positions instead of guessing that any distance is the displacement. The five
SUVAT equations below operate on `dx`; the solver bridges positions and
displacement through the extra position equation.

The five SUVAT equations, each omitting one variable. Given any **3** of the
core knowns, the engine solves the rest.

| # | Equation                    | Omits |
|---|-----------------------------|-------|
| 1 | `v = v0 + a·t`              | `dx`  |
| 2 | `dx = v0·t + ½·a·t²`        | `v`   |
| 3 | `dx = ½·(v0 + v)·t`        | `a`   |
| 4 | `v² = v0² + 2·a·dx`        | `t`   |
| 5 | `dx = v·t − ½·a·t²`        | `v0`  |

### 5.1 Closed forms (per solvable target)

```
Eq1  v = v0 + a·t
  v0 = v − a·t        a  = (v − v0)/t       t = (v − v0)/a

Eq2  dx = v0·t + ½·a·t²
  v0 = (dx − ½·a·t²)/t          a = 2·(dx − v0·t)/t²
  t  : ½·a·t² + v0·t − dx = 0  → t = (−v0 ± √(v0² + 2·a·dx)) / a
        (a = 0 ⇒ t = dx / v0; select physical root t ≥ 0)

Eq3  dx = ½·(v0 + v)·t
  v0 = 2·dx/t − v     v = 2·dx/t − v0      t = 2·dx/(v0 + v)

Eq4  v² = v0² + 2·a·dx
  v  = ±√(v0² + 2·a·dx)         v0 = ±√(v² − 2·a·dx)      (root selection)
  a  = (v² − v0²)/(2·dx)        dx = (v² − v0²)/(2·a)

Eq5  dx = v·t − ½·a·t²
  v  = (dx + ½·a·t²)/t          a = 2·(v·t − dx)/t²
  t  : −½·a·t² + v·t − dx = 0   (quadratic; select physical root)
```

Free-fall preset: `a = −9.81 m/s²` (metric) / `−32.17 ft/s²` (imperial).

---

## 6. Tutor — phased, architected once

Every solution is a **structured step list**: `equation chosen → rearrangement
→ substitution (with units) → result`, stored as data emitted by the engine.
Both phases consume the same structure.

- **Phase 1 — Worked solutions (v1):** render the step list top-to-bottom,
  KaTeX-typeset. This is today's feature, done properly and generalized.
- **Phase 2 — Interactive / Socratic (designed now, built later):** reveal one
  step at a time; let the student enter an intermediate value or the final
  answer and check it; offer hints ("which equation uses your three knowns plus
  `t`?"). Because it reads the same step data, it is a UI layer, not a rewrite.

---

## 7. NLP grammar (initial slot set)

Intent phrases → variable slots. Extend phrase-by-phrase; each gets a unit test.

| Phrase pattern                          | Slot(s) set              |
|-----------------------------------------|--------------------------|
| "dropped", "from rest"                  | `v0 = 0`                 |
| "thrown/launched upward at N"           | `v0 = +N`                |
| "thrown/launched downward at N"         | `v0 = −N`                |
| "hits the ground at N", "lands at N"    | `v = −N`                 |
| "falls for N seconds", "after N s"      | `t = N`                  |
| "from a height of N", "N tall/high"     | `dx = −N` (x₁=N, x₂=0)   |
| number + unit (`m`, `m/s`, `s`, `ft`)   | typed into matched slot  |

Unmatched input → slots left blank for manual correction. `compromise` handles
tokenization/number extraction; the pattern→slot mapping is ours.

---

## 8. Units & formatting

- Metric and imperial are **real** conversions through `math/`, not labels.
- Sig-fig-aware output formatting: **3 significant figures by default**
  (physics-textbook convention), configurable per call. Significant figures,
  not decimal places, so precision reads sensibly across magnitudes. Trailing
  zeros that convey precision are kept unless explicitly trimmed.
- Dimensional mismatches are surfaced as friendly errors, not NaN.

---

## 9. Design system — Tron / low-poly

CSS Modules + a **design-token layer** (CSS custom properties) so the aesthetic
lives in one themeable place. Reference feel: axogeo.com — dark, glowing,
gridded, angular.

Initial tokens (illustrative):

```css
:root {
  --bg:               #05070a;   /* near-black */
  --panel:            #0a1017;
  --grid-line:        rgba(0, 229, 255, 0.08);
  --accent-primary:   #00e5ff;   /* cyan */
  --accent-secondary: #ff6a00;   /* orange */
  --text:             #cfe8ee;
  --glow:             0 0 12px var(--accent-primary);
  --edge:             1px solid rgba(0, 229, 255, 0.35);
}
```

- Angular / low-poly panels via `clip-path`.
- Glow on active/focused elements.
- Techy monospace for numeric readouts.
- Themeable from day one: a "friendly light" mode is a token swap later.

---

## 10. Tech stack & tooling

- **Vite + React 18 + TypeScript** (single toolchain — retires CRA + the
  competing Webpack config).
- **Vitest** + Testing Library.
- **ESLint** (flat config) + **Prettier** — real rules, unlike the current
  toothless setup.
- **KaTeX**, **react-chartjs-2 / Chart.js**, **Zustand**, **compromise**.
- Deploy: static build to GitHub Pages (retain `gh-pages` flow).

---

## 11. Repository strategy

Preserve the old app **two ways**, build the new product at the root:

1. Tag the pre-rewrite commit **`v1-legacy`**.
2. Move the current CRA app into **`legacy/`** (still in-tree and runnable).
3. Scaffold the new Vite/TS product at the **repo root**.

Proposed new layout:

```
/
├── docs/SPEC.md
├── legacy/                 # old CRA app, preserved & runnable
├── src/
│   ├── math/               # quantities, dimensions, units
│   ├── engine/             # constraint-propagation solver
│   ├── domains/
│   │   └── kinematics-1d/  # SUVAT equation pack
│   ├── nlp/                # tokenizer + slot grammar
│   ├── state/              # Zustand store
│   ├── ui/
│   │   ├── components/
│   │   └── theme/          # design tokens, Tron theme
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
└── package.json
```

---

## 12. Testing strategy & CI

- `math/`: exhaustive unit tests (arithmetic, dimensions, conversions,
  formatting).
- `engine/`: solve-order, auto-solve-all, multi-root selection, unsolvable/
  under-determined cases.
- `domains/kinematics-1d`: every closed form vs. known worked examples
  (including the two from the legacy `TimeSolver.test.js`).
- `nlp/`: one test per grammar phrase + graceful-degradation cases.
- `ui/`: light component/render smoke tests.

**CI pipeline** (`.github/workflows/ci.yml`, runs on every push and PR):
lint → typecheck → **test-approval standard** → coverage → build. `npm run ci`
runs the identical sequence locally.

**Test-approval standards for `math/`, `engine/`, and `domains/`** — the
exact-arithmetic core is gated harder than the rest of the app:

1. **Colocated tests** (`scripts/check-colocated-tests.mjs`): every runtime
   module under `src/math/`, `src/engine/`, and `src/domains/` must ship a
   sibling `*.test.ts`. New equations/domains cannot merge test-less. Barrels
   (`index.ts`), type-only `types.ts`, and `*.d.ts` are exempt.
2. **Coverage thresholds** (Vitest v8, scoped to those same three trees):
   statements 95%, branches 90%, functions 95%, lines 95%.

**NLP is exempt from the above** and still tested (23 NLP tests), but its
correctness is fuzzy-match quality — how well phrasing maps to variables —
which coverage percentages measure poorly. It needs a **separate standards
system** (to be designed): a labeled corpus of problem phrasings with expected
assignments, scored by precision/recall, plus regression tracking as phrases
are added. TODO before the grammar grows much further.

---

## 12a. Local LLM parsing & the prompt flywheel

Two additions turn NLP from "rules only" into a self-improving system, without
a server and without betraying the no-key / no-cost / static constraints.

**Smart parse (opt-in, `src/nlp/smart/`)** — a local LLM via WebLLM (WebGPU),
running entirely in the browser:
- The model *only* extracts variables into the shared `ParseResult`; the
  deterministic engine still does every calculation. The LLM never touches the
  math, so "LLMs are bad at arithmetic" never applies.
- **Never forced.** Off by default; a disclosed toggle states the one-time
  download size and that it runs on-device. Weights (and the ~14 MB WebLLM
  runtime) load only on opt-in — `@mlc-ai/web-llm` is dynamically imported, so
  the base bundle is unchanged (entry stays ~207 KB gzipped; WebLLM is a
  separate ~6 MB lazy chunk).
- **Graceful fallback.** No WebGPU, model still loading, or unusable output ⇒
  the always-available rule parser. The rule parser is the baseline; smart parse
  is an enhancement.
- Smallest usable model by default (`SmolLM2-360M`, ~380 MB, q4f16); one-line
  swap. The pure JSON→assignment mapping is unit-tested; on-device inference
  quality must be validated on real hardware (no GPU in CI).

**Extraction quality — measured, not assumed.** The first hardware run
(SmolLM2-360M, five deliberately hard problems) found the model's language
handling adequate but its slot discipline weak. Positions were right in 4 of 5,
including the compositional obstacle case the rule parser cannot do; everything
else regressed. Two distinct causes, worth keeping separate:
- *Few-shot copying.* The examples in `prompt.ts` are the model's fallback when
  it cannot ground a slot. Any slot holding the same value in every example
  teaches that value as a constant: `t` was `null` throughout and every stated
  duration was dropped, `units` was `"metric"` throughout and imperial was never
  detected, and `v0` was never `null`, so problems stating no initial velocity
  came back with the last example's `20`. The examples now vary every slot and
  show each as `null` at least once, and use deliberately odd numbers so future
  copying is identifiable on sight.
- *A fabricating default.* The "falls to the ground" rule (`x1` known, `x2`
  absent ⇒ `x2 = 0`) predates smart parse and was being applied to its output.
  The rule parser has no way to express "the story never says where it ends
  up"; smart parse does, and a null `x2` is a deliberate statement. The default
  is now rule-parser only (`statePatch`), covered in `store.test.ts`.

The general lesson, which governs this whole path: **a fabricated value is
worse than a missing one.** A missing `v0` yields "not enough information to
solve"; an invented one yields a confident wrong answer with a full worked
solution behind it. Smart parse only earns its download when it beats the rule
parser, and inventing values makes it lose.

**Second run — what rewriting the prompt actually proved.** Varying the example
values did not stop the copying; the model copied the *new* numbers instead
(`t=3.5`, from an example, onto a problem stating no duration), and on two
problems put a velocity into the acceleration slot. Three conclusions, each
turned into a mechanism rather than more prompt wording:
- *A prompt cannot forbid fabrication; code can.* `dropUngrounded`
  (`smart/schema.ts`) discards any value whose magnitude appears neither in the
  problem text nor among the constants a convention supplies (rest, the two
  gravities). Signs are compared by magnitude so `v=-26` still matches "26 m/s".
  If nothing grounded survives, smart parse reports failure and the rule parser
  takes over.
- *Smart parse must augment the grammar, not replace it.* It previously
  discarded the rule result entirely, so enabling it could make a story parse
  *worse*. `mergeParses` now layers the model's assignments over the grammar's,
  filling only empty slots — rule wins every contested one. Measured on the
  braking-capsule problem, the grammar alone recovers `v0=-4` (sign included)
  and `t=6`, the model alone recovers `x1=150` and `a=1.2`; neither solves it
  and the merge does. This makes enabling smart parse monotonic by
  construction, which is what §12a always claimed.
- *A model bump is the last lever, not the first.* Copying and slot confusion
  look like capability failures, and 360M may well be below the floor — but the
  point of the two guards above is to make a weak model *safe*, and that claim
  is only testable with the model held fixed. The default therefore stays at
  SmolLM2-360M until the guards have been measured on it. Candidates when the
  time comes are listed in `smart/engine.ts`; Llama-3.2-1B (879 MB) is both
  larger in parameters and smaller in VRAM than Qwen2.5-0.5B (945 MB), so the
  0.5B tier is strictly dominated and should be skipped.

The rule-parser baseline on the five-problem set is itself worth recording: it
extracts *nothing* from three of them and partial values from the other two.
The grammar is far weaker on unconstrained prose than its curated test corpus
suggests — which is the case for smart parse, and the reason the NLP standards
system below matters.

**Third run — the remaining failures were the grammar's, not the model's.** Two
of five now solve correctly end-to-end, and nothing fabricates. What was left
turned out to be deterministic work the model had been covering for badly:
- *Dimensional guard.* The grammar has always refused a number whose unit
  contradicts the slot it is filling; smart parse had no equivalent, so a model
  could file "30 m/s" under acceleration. `measuredNumbers` (`grammar.ts`)
  exposes each number with the dimension of its unit, and `dropUngrounded` now
  enforces the same rule on the model's output. Both parsers, one standard.
- *Coverage, not intelligence.* "Slips", "topples", "breaks loose" all mean
  "started at rest", and "strikes the pavement" means the same as "hits the
  ground" — prose rarely uses the phrasings the grammar enumerated. Adding
  rest-implying verbs and ground-level surface names took grammar recall on the
  corpus from 3/20 to 9/20, and `v0` is now recovered on all five problems by
  the grammar alone.
- *The story outranks the model on units.* The tokenizer folds "feet" to `ft`,
  so the written system is a deterministic fact; `applyTextUnits` uses it to
  override the model's `units` guess. Gravity has to be *restated* rather than
  relabelled when the system flips — it is convention-supplied rather than read
  off the page, so a metric −9.81 would otherwise be reinterpreted as
  −9.81 ft/s². A stated acceleration is left alone.

**Prompt collection (`src/telemetry/collector.ts`)** — the flywheel that
improves the *free* rule parser:
- Storymode submissions (by default only the ones the rule parser couldn't
  fully place — the highest-signal data) are recorded and POSTed to an ingest
  endpoint, to be stored (e.g. S3) and batch-processed by a model that proposes
  new grammar rules. That downstream pipeline is out of the static app's scope.
- **Privacy: doubly gated and off by default.** Nothing is sent unless BOTH a
  build-time endpoint is configured AND the user gives runtime consent. Records
  are anonymized (problem text + how it parsed; no identifiers).
- Config via env: `VITE_COLLECTOR_ENDPOINT` (unset ⇒ disabled),
  `VITE_COLLECTOR_POLICY` = `failures` (default) | `all` | `off`.

**Business fit:** the app is open-source; smart parse is the natural paid/opt-in
premium capability, while collection makes the free path better for everyone.

## 13. Roadmap / future scope

Enabled by the layered design; **not** built in v1.

- **More domains** (new `domains/` packs, no engine changes): Ohm's law &
  circuits, 2-D / projectile motion, energy & momentum; later chemistry
  (stoichiometry — adds `mol` to the dimensional basis) and calculus.
- **Interactive/Socratic tutor** (Phase 2 above).
- **Accounts & persistence** → saved problems, history (would introduce a
  backend; out of v1's static scope).
- **Classroom / teacher** features: assignments, worked-solution sets, progress
  tracking (B2B2C).
- **Voice input** retained as an optional layer over text entry.

---

## 14. Resolved decisions

- **NLP:** hand-rolled tokenizer behind a `Tokenizer` interface — no external
  NLP dependency, swappable later.
- **Sig figs:** 3 significant figures by default, configurable.
- **Free fall** is the default landing preset (`a = −9.81 m/s²`).

## 15. Status

- ✅ Vite + TypeScript scaffold at root; legacy app preserved under `legacy/`
  and tagged `v1-legacy`.
- ✅ `math/` core built and tested: dimensional `Quantity` arithmetic, real
  metric/imperial units, 3-sig-fig formatting, gravity constant (38 tests).
- ✅ CI pipeline + test-approval standards (colocated tests + coverage gates)
  for `math/`, `engine/`, and `domains/`.
- ✅ `engine/` constraint-propagation solver: auto-solve-all, most-determined
  root selection (physical-root pruning + recorded discards/alternatives),
  ordered solution steps.
- ✅ `domains/kinematics-1d` SUVAT pack: all five equations with closed forms
  for every variable, free-fall preset. Reproduces the legacy worked examples
  and resolves signed roots correctly.
- ✅ `nlp/` word-problem parser: hand-rolled tokenizer (behind a swappable
  `Tokenizer` interface) + curated slot grammar → engine-ready assignments,
  with unit folding, dimension guarding, and graceful degradation (unused
  numbers reported). Exempt from the core gates — needs its own standards
  system (see §12). 92 tests total across the project.
- ✅ `state/` (Zustand) + `ui/` (React, CSS Modules, KaTeX, Chart.js): manual
  variable form with auto-solve, unit toggle (real metric↔imperial conversion),
  Storymode text/voice input → parser, KaTeX worked-solution steps, dual-axis
  motion chart. Tron / low-poly theme via design tokens. Verified end-to-end in
  a browser.
- ✅ Prompt-collection flywheel (consent-gated, endpoint via env).
- ⬜ Local LLM "smart parse" (WebLLM, opt-in, lazy-loaded, rule-parser
  fallback). Shipped and unit-tested at the glue layer, but **not** yet good
  enough to recommend: the first hardware run showed few-shot copying into
  unstated slots and a fabricated ground landing (see §12a). Prompt and
  `statePatch` fixed in response; needs a re-test, and possibly a larger model
  than 360M.
- 🟡 NLP standards system (labeled phrase corpus + precision/recall) — seeded.
  `src/nlp/corpus.ts` holds labeled prose problems with a parser-agnostic
  scorer; `corpus.test.ts` scores the grammar on every run and ratchets a
  no-regression floor. Standing score: **9 of 20 labeled slots (45% recall),
  zero fabrications** — up from 3/20 when the corpus was first written, entirely
  through grammar coverage the corpus made visible. Still needed: many more
  cases, and a scored harness for smart parse (hand-run, since CI has no
  WebGPU). The collected prompts feed this.
- 🟡 **More domains.** `relative-velocity` is the second pack, and adding it
  needed no engine change — the claim in §4.3 held. Which pack solves a story
  is **detected, not chosen**: a picker would ask a student to classify the
  problem before the app helps, and recognising "this is relative velocity" is
  part of what they are learning. Detection is conservative (a two-body cue
  *and* two stated speeds, since "passes a marker" plus one speed is still free
  fall), names its verdict on screen so the classification is visible, and is
  overridable because being stuck with the wrong equations is worse than being
  asked.

  Each domain brings its own rule set. Kinematics works because a phrase names
  a slot — "from a height of" can only be x₁ — but both speeds in a two-body
  problem are introduced identically, and only *order* separates them. So
  `grammar-relative.ts` reads the velocities positionally, first body then
  second, and decides the sign from wording: "towards each other" makes the
  second negative. Question words are domain-specific too — "what is the
  velocity of the motorcycle?" asks for `v` in free fall and `v_rel` when the
  frame is another moving body.

  Phases, segmentation, the ground-landing default, the motion chart and the
  free-fall preset are all one-object ideas and stay switched off elsewhere.
- ⬜ Ingest endpoint + batch rule-suggestion pipeline (out of static-app scope).
- 🟢 **Multi-phase motion.** *"Drops off a roof at 150 m onto another roof 30 m
  high, then rolls off and falls to the ground — how fast is it going when it
  hits?"* is two falls with the ball at rest between them, and the answer uses
  only the 30 m. A single-segment model returns −54.2 m/s instead of −24.3, and
  reports the real value as unplaced: the exact student error the problem is
  built to catch. Four stages, one done:
  - ✅ **Engine** (`engine/phases.ts`). A phase sequence is a list of segments
    joined by links. Position always carries (`x₂(n) = x₁(n+1)`); velocity
    carries by `LinkKind` — `continuous` (passes and keeps going), `rest`
    (lands, later departs from rest), `reversed` (bounces, scaled by
    restitution). Propagation runs both ways, so a sequence stating only its
    final conditions can be worked backwards. `solve` is untouched — this is
    the same constraint propagation one level up, iterated to a fixpoint. A
    one-segment sequence behaves exactly as a bare `solve`, so the old model is
    the degenerate case rather than a special case. Boundaries whose two sides
    are separately stated and disagree are reported once per channel instead of
    being silently reconciled.
  - ✅ **NLP segmentation** (`nlp/segment.ts`). Heights in order of mention form
    a chain and consecutive pairs become phases, which resolves the awkward part
    — `30` is simultaneously phase 1's `x₂` and phase 2's `x₁`, and falls out of
    the chain rather than needing to be decided. The words *between* two heights
    classify the boundary: "rolls off"/"lands on"/"comes to rest" ⇒ `rest`,
    "bounces" ⇒ `reversed`, "passes"/"continues" ⇒ `continuous`. Splitting is
    opt-in on evidence: without a staging cue, or with fewer than three distinct
    heights, it returns null and the story is solved exactly as before. A wrong
    split silently answers a different problem, so ambiguity declines rather
    than guesses.
  - ✅ **Targeting & rendering.** The asked-for variable resolves against the
    final segment, and the Solution panel renders one block per phase. That
    layout *is* the explanation: seeing the answer come from the last segment
    alone is what makes an earlier height visibly irrelevant.
  - ✅ **Editing & the honest fallback** (`ui/components/PhaseEditor.tsx`). The
    phase sequence is held as display strings, not parser quantities, so it is
    editable on the same terms as the variable form — §4.4 makes the manual form
    the ground truth and the parser a pre-fill, and phases were briefly an
    exception, which left a mis-segmented story unfixable. Heights and link
    kinds are editable, segments can be added or removed, and "+ Split into
    phases" works from a *single*-segment story, which is the escape hatch for
    staged problems the parser cannot segment at all. Removing down to one
    segment collapses back to the ordinary path. `describesStages` detects
    staged prose independently of whether it could be split, so a story that
    signposts stages but yields no chain says so instead of answering as if it
    were one segment.

  Not yet covered: chains the parser can't read (unstated intermediate heights,
  horizontal stages, staging without a cue word). Those are warned about and can
  be split by hand, but are not detected automatically.
- 🟡 **Socratic layer.** §1 calls this a tutor rather than a solver, but the
  app only ever *told*. `tutor/grade.ts` plus `WorkItThrough` ask two questions
  before revealing a solution: what the problem wants, and which given values
  the answer needs. Both are graded against machinery that already exists and
  is already tested — `nlp/question.ts` and `engine/relevance.ts` — so the
  tutor introduces no new source of wrongness and needs no model.

  The second question is the point. The app used to *tell* a student that
  150 m never enters the answer; asking first turns a spoiler into an exercise,
  and turns the distractor work into the thing it was built for. Wrong answers
  are marked in amber, not red — a wrong first guess is the mechanism working.
  "Skip to the answer" is always present: a student who wants the answer should
  get it rather than be held hostage.

  Still to come: which equation to use (checkable against the first solution
  step's `equationId`), phase-level questions for staged motion, and any notion
  of progress across problems.
- ⬜ Polish: bundle code-splitting (chart.js/KaTeX are heavy), interactive
  (Socratic) tutor phase, additional domains.
