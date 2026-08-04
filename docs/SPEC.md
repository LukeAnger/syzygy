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
- **Natural-language entry:** type/paste/speak a word problem and have it
  pre-fill the variable form.
- **Real units** (metric/imperial) via an in-house dimensional-math core.
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

---

## 5. SUVAT model

Five variables:

| Symbol | Meaning            | Base unit |
|--------|--------------------|-----------|
| `v0`   | initial velocity   | m/s       |
| `v`    | final velocity     | m/s       |
| `a`    | acceleration       | m/s²      |
| `t`    | time               | s         |
| `dx`   | displacement (Δx)  | m         |

Five equations, each omitting one variable. Given any **3** knowns, the engine
solves the rest.

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
- ⬜ NLP standards system (labeled phrase corpus + precision/recall).
- ⬜ `ui/` (Tron theme), `state/`.
