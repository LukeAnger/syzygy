/**
 * Application state: the five kinematics inputs (as raw strings the user
 * types), the unit system, and the actions that mutate them. The solve itself
 * is derived, not stored — components compute it from `solveInputs`.
 *
 * The conversion logic (strings ⇄ dimensioned quantities) lives in exported
 * pure functions so it can be tested without React.
 */
import { create } from 'zustand';
import {
  type Quantity,
  type UnitSystem,
  fromUnit,
  toUnit,
  unitKit,
} from '../math/index.ts';
import {
  type Knowns,
  type LinkKind,
  type PhaseLink,
  type PhaseSolveResult,
  type SolveResult,
  solve,
  solvePhases,
} from '../engine/index.ts';
import {
  type DomainId,
  domainOf,
  findVariable,
  inputKeysOf,
} from '../domains/index.ts';
import { kinematics1D } from './../domains/kinematics-1d/index.ts';
import {
  type Assignment,
  type ParseResult,
  type Segmentation,
  describesStages,
  detectDomain,
  detectSystem,
  isAmbiguousDomain,
  parse,
  segmentPhases,
} from '../nlp/index.ts';
import {
  SMART_MODEL,
  isSmartParseSupported,
  smartParse,
  warmUp,
} from '../nlp/smart/index.ts';
import {
  type CollectorSink,
  buildRecord,
  collectorConfigured,
  httpSink,
  noopSink,
  resolveConfig,
  shouldCollect,
} from '../telemetry/collector.ts';

/** Every solver variable across every domain. */
export type VariableKey =
  // 1-D kinematics
  | 'v0'
  | 'v'
  | 'a'
  | 't'
  | 'x1'
  | 'x2'
  | 'dx'
  // relative velocity
  | 'xa'
  | 'xb'
  | 'va'
  | 'vb'
  | 'vrel'
  | 'd'
  | 'xm';

/** The variables a user actually enters — results are derived, not typed. */
export type InputKey = Exclude<VariableKey, 'dx' | 'xm'>;

/**
 * Form values, keyed loosely.
 *
 * Which fields exist depends on the active domain, so this cannot be a closed
 * record over one domain's keys. Reads use `?? ''` rather than assuming a key
 * is present.
 */
export type Inputs = Record<string, string>;

/** Display / form order. */
export const INPUT_KEYS: InputKey[] = ['x1', 'x2', 'v0', 'v', 'a', 't'];

/** Form fields for whichever domain is active. */
export function inputKeys(domain: DomainId): InputKey[] {
  return inputKeysOf(domain) as InputKey[];
}

/** Blank inputs shaped for a domain, so switching never leaves stale fields. */
export function blankInputs(domain: DomainId): Inputs {
  return Object.fromEntries(inputKeys(domain).map((k) => [k, ''])) as Inputs;
}

/** Free fall is the default landing preset: gravity in, everything else blank. */
export const DEFAULT_INPUTS: Inputs = {
  x1: '',
  x2: '',
  v0: '',
  v: '',
  a: '-9.81',
  t: '',
};

function variable(key: VariableKey) {
  return findVariable(key);
}

/** Parse the non-empty inputs into a `Knowns` map of SI-based quantities. */
export function buildKnowns(
  inputs: Inputs,
  system: UnitSystem,
  domain: DomainId = 'kinematics-1d',
): Knowns {
  const kit = unitKit(system);
  const knowns: Record<string, Quantity> = {};
  for (const key of inputKeys(domain)) {
    if (inputs[key] === undefined) continue;
    const raw = (inputs[key] ?? '').trim();
    if (raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    knowns[key] = fromUnit(value, variable(key).displayUnit(kit));
  }
  return knowns;
}

/** Run the solver over the current inputs. */
export function solveInputs(
  inputs: Inputs,
  system: UnitSystem,
  domain: DomainId = 'kinematics-1d',
): SolveResult {
  return solve(domainOf(domain), buildKnowns(inputs, system, domain));
}

/** One motion segment's start and end height, as the strings a user edits. */
export interface PhaseInputs {
  x1: string;
  x2: string;
}

/**
 * The editable phase sequence. `links[i]` joins phase i to phase i + 1, so
 * there is always one fewer link than phase.
 *
 * Held as display strings rather than the parser's quantities so the sequence
 * is editable on the same terms as the variable form. §4.4 makes the manual
 * form the ground truth and the parser a pre-fill; phases were briefly an
 * exception to that, which made a mis-segmented story unfixable.
 */
export interface PhaseState {
  phases: PhaseInputs[];
  links: PhaseLink[];
}

/** Length unit the phase heights are typed in. */
function lengthUnit(system: UnitSystem) {
  return variable('x1').displayUnit(unitKit(system));
}

/** Re-express every phase height from one unit system in another. */
export function convertPhaseHeights(
  state: PhaseState,
  from: UnitSystem,
  to: UnitSystem,
): PhaseState {
  if (from === to) return state;
  const fromUnitOf = lengthUnit(from);
  const toUnitOf = lengthUnit(to);
  const convert = (raw: string): string => {
    const value = Number(raw.trim());
    if (raw.trim() === '' || !Number.isFinite(value)) return raw;
    const si = fromUnit(value, fromUnitOf);
    return String(Number(toUnit(si, toUnitOf).toFixed(6)));
  };
  return {
    ...state,
    phases: state.phases.map((phase) => ({
      x1: convert(phase.x1),
      x2: convert(phase.x2),
    })),
  };
}

/** Turn a parsed segmentation into the editable form. */
function toPhaseState(segmentation: Segmentation, system: UnitSystem): PhaseState {
  return {
    phases: segmentation.phases.map((phase) => ({
      x1: quantityToInput('x1', phase.x1, system),
      x2: quantityToInput('x2', phase.x2, system),
    })),
    links: [...segmentation.links],
  };
}

/**
 * Solve a story that describes motion in more than one segment.
 *
 * Each segment supplies its own start and end height; everything else comes
 * from the shared inputs. Only the *first* segment inherits the story's stated
 * initial velocity — later segments get theirs from the link, which is the
 * whole point of the link (a ball that lands and rolls off departs from rest
 * regardless of how fast it arrived).
 */
export function solvePhaseSequence(
  state: PhaseState,
  inputs: Inputs,
  system: UnitSystem,
): PhaseSolveResult {
  const shared = buildKnowns(inputs, system);
  const unit = lengthUnit(system);
  const height = (raw: string): Quantity | undefined => {
    const value = Number(raw.trim());
    return raw.trim() === '' || !Number.isFinite(value)
      ? undefined
      : fromUnit(value, unit);
  };

  const phases = state.phases.map((phase, i) => {
    const knowns: Record<string, Quantity> = {};
    const x1 = height(phase.x1);
    const x2 = height(phase.x2);
    if (x1) knowns['x1'] = x1;
    if (x2) knowns['x2'] = x2;
    if (shared['a']) knowns['a'] = shared['a'];
    if (i === 0 && shared['v0']) knowns['v0'] = shared['v0'];
    return { knowns };
  });
  return solvePhases(kinematics1D, phases, state.links);
}

/** Format an SI quantity as a plain input string in the given system's unit. */
function quantityToInput(
  key: InputKey,
  quantity: Quantity,
  system: UnitSystem,
): string {
  const magnitude = toUnit(quantity, variable(key).displayUnit(unitKit(system)));
  // Trim floating-point fuzz without imposing sig-figs on user-facing inputs.
  return String(Number(magnitude.toFixed(6)));
}

/** Turn parser assignments into input strings (for Storymode). */
export function assignmentsToInputs(
  assignments: Assignment[],
  system: UnitSystem,
): Partial<Inputs> {
  const inputs: Partial<Inputs> = {};
  for (const assignment of assignments) {
    if ((INPUT_KEYS as string[]).includes(assignment.variable)) {
      const key = assignment.variable as InputKey;
      inputs[key] = quantityToInput(key, assignment.quantity, system);
    }
  }
  return inputs;
}

/** Re-express every non-empty input from one unit system in another. */
export function convertInputs(
  inputs: Inputs,
  from: UnitSystem,
  to: UnitSystem,
): Inputs {
  if (from === to) return inputs;
  const fromKit = unitKit(from);
  const toKit = unitKit(to);
  const next: Inputs = { ...inputs };
  for (const key of INPUT_KEYS) {
    const raw = (inputs[key] ?? '').trim();
    if (raw === '') continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const si = fromUnit(value, variable(key).displayUnit(fromKit));
    next[key] = String(Number(toUnit(si, variable(key).displayUnit(toKit)).toFixed(6)));
  }
  return next;
}

export type Mode = 'story' | 'manual';

/** Input keys the current story actually supplied (excludes solver output). */
export type GivenKeys = InputKey[];

export type SmartStatus = 'unsupported' | 'idle' | 'loading' | 'ready' | 'error';

// Prompt-collection config resolved once at load; disabled unless an endpoint
// is configured at build time (see docs/SPEC.md).
const COLLECTOR = resolveConfig(import.meta.env);
const SINK: CollectorSink = collectorConfigured(COLLECTOR)
  ? httpSink(COLLECTOR.endpoint!)
  : noopSink;
export const COLLECTOR_CONFIGURED = collectorConfigured(COLLECTOR);

/**
 * Layer smart-parse assignments over the rule parser's, filling only the slots
 * the grammar left empty.
 *
 * Rule wins every contested slot, which is what makes smart parse safe to
 * enable: it can add information but never contradict the deterministic
 * baseline, so turning it on cannot make a story parse worse. The two are
 * genuinely complementary — on a braking-capsule problem the grammar recovers
 * `v0=-4` and `t=6` (including the sign) while the model recovers `x1` and the
 * stated acceleration; neither solves it alone and together they do.
 */
export function mergeParses(rule: ParseResult, smart: ParseResult): ParseResult {
  const claimed = new Set(rule.assignments.map((a) => a.variable));
  const filled = smart.assignments.filter((a) => !claimed.has(a.variable));
  return {
    text: rule.text,
    assignments: [...rule.assignments, ...filled],
    // Unplaced only if neither parser accounted for it.
    unusedNumbers: rule.unusedNumbers.filter((n) =>
      smart.unusedNumbers.includes(n),
    ),
    // The question is read by the grammar alone; the model is never asked.
    target: rule.target,
  };
}

/**
 * What the last parse actually did, split by which engine did it.
 *
 * The merge deliberately gives the grammar priority, so as the grammar improves
 * the model's contribution shrinks — and a story can parse perfectly while
 * smart parse contributes nothing at all. Without separating the two, "it
 * works" says nothing about whether the model earned its download.
 */
export interface ParseDiagnostics {
  readonly engine: 'rule' | 'smart';
  /** Variables the grammar supplied on its own. */
  readonly fromRule: VariableKey[];
  /** Variables only the model supplied — its entire marginal value. */
  readonly fromSmart: VariableKey[];
  readonly unusedNumbers: number[];
  readonly asked?: VariableKey;
  readonly phaseCount: number;
}

function diagnose(
  engine: 'rule' | 'smart',
  rule: ParseResult,
  merged: ParseResult,
): ParseDiagnostics {
  const fromRule = rule.assignments.map((a) => a.variable as VariableKey);
  const claimed = new Set<VariableKey>(fromRule);
  return {
    engine,
    fromRule,
    fromSmart: merged.assignments
      .map((a) => a.variable as VariableKey)
      .filter((key) => !claimed.has(key)),
    unusedNumbers: merged.unusedNumbers,
    asked: merged.target as VariableKey | undefined,
    phaseCount: segmentPhases(merged.text)?.phases.length ?? 1,
  };
}

/** Free-fall acceleration as an input string, in each system's own unit. */
const FREE_FALL: Record<UnitSystem, string> = {
  metric: '-9.81',
  imperial: '-32.17',
};

/** Build the input/given/story state patch from a parse result. */
function statePatch(system: UnitSystem, text: string, result: ParseResult) {
  const parsed = assignmentsToInputs(result.assignments, system);
  const segmentation = segmentPhases(text);
  // "Falls to the ground": start position given but no final one ⇒ x₂ = 0.
  //
  // Only when no duration is known. A stated time means the story defines its
  // own endpoint — the object is wherever the motion carries it — so assuming
  // it landed invents a landing the story never described. A braking capsule
  // given 6 s of deceleration is the case that exposed this: defaulting x₂ to
  // the shaft floor produced a spurious Δx and a confident wrong answer, where
  // leaving it blank correctly reports "not enough information".
  if (
    parsed.x1 !== undefined &&
    parsed.x2 === undefined &&
    parsed.t === undefined
  ) {
    parsed.x2 = '0';
  }
  const phaseState = segmentation ? toPhaseState(segmentation, system) : undefined;
  // A height the phase split consumed is placed, whatever the flat parse
  // thought. Without this the panel reports "couldn't place 30" beside a phase
  // editor visibly using 30 twice.
  const inPhases = new Set(
    (phaseState?.phases ?? []).flatMap((phase) => [
      Number(phase.x1),
      Number(phase.x2),
    ]),
  );

  return {
    story: text,
    given: Object.keys(parsed) as GivenKeys,
    unusedNumbers: result.unusedNumbers.filter((n) => !inPhases.has(n)),
    // The engine's VariableKey is a loose string; the store's is the closed
    // union, and the parser only ever targets a member of it.
    asked: result.target as VariableKey | undefined,
    // Read from the story, not chosen. Naming the classification is itself
    // instructive; assuming it silently is what a picker would do.
    domain: detectDomain(text),
    domainAmbiguous: isAmbiguousDomain(text),
    // Undefined for the overwhelming majority of stories, which are one
    // segment; the app then solves exactly as it always has.
    phases: phaseState,
    // Staged prose we could not turn into a chain. The single-segment path
    // will still answer it, so the UI has to say the answer may be partial.
    unsegmentedStages: describesStages(text) && !segmentation,
    // Acceleration resets to free fall for this story's system unless the story
    // states one. It used to carry over from whatever was in the form, which
    // let one story's gravity leak into the next: solving an imperial problem
    // left a = −32.17 ft/s² behind, and the next metric story inherited it as
    // −9.805416 m/s² — close enough to −9.81 to pass a glance, and wrong.
    inputs: { ...DEFAULT_INPUTS, a: FREE_FALL[system], ...parsed },
  };
}

/** Send an anonymized record to the collector, if consented and in-policy. */
function maybeCollect(
  text: string,
  result: ParseResult,
  engine: 'rule' | 'smart',
  consent: boolean,
) {
  if (!consent || !COLLECTOR_CONFIGURED) return;
  const record = buildRecord({
    prompt: text,
    engine,
    variables: result.assignments.map((a) => a.variable),
    unusedNumbers: result.unusedNumbers,
    ts: Date.now(),
  });
  if (shouldCollect(record, COLLECTOR.policy)) SINK.send(record);
}

export interface KinematicsState {
  mode: Mode;
  inputs: Inputs;
  unitSystem: UnitSystem;
  /** Last Storymode text, for display/highlighting. */
  story: string;
  /** Variables the story provided (what the parser understood). */
  given: GivenKeys;
  /** Numbers the parser could not place, surfaced from the last parse. */
  unusedNumbers: number[];
  /**
   * The variable the story asked for, when it asked for one. Undefined for a
   * story that only narrates — the solver then reports everything it can.
   */
  asked?: VariableKey;
  /**
   * Motion segments, when the story describes more than one. Undefined for a
   * single-segment story, which is solved exactly as before.
   */
  phases?: PhaseState;
  /** Story signposts stages the parser could not turn into a phase chain. */
  unsegmentedStages: boolean;
  /** What the last parse did, per engine. Drives the dev panel. */
  diagnostics?: ParseDiagnostics;
  /**
   * Which equation pack is solving. Detected from the story rather than
   * chosen: classifying a problem is part of what a student is learning, and a
   * picker would ask them to do it before the app helps. Overridable, because
   * detection can be wrong and being stuck with the wrong solver is worse.
   */
  domain: DomainId;
  /** Story hints at two bodies but did not meet the bar for switching. */
  domainAmbiguous: boolean;
  /**
   * The text in the Storymode box, before it is submitted.
   *
   * Held here rather than in the component so anything can load a problem into
   * it — the dev panel's one-click buttons, the worked examples, dictation.
   */
  draft: string;
  /**
   * A parse is in flight. Smart parse runs a local model and takes seconds, so
   * without this the app looks frozen and invites a second click.
   */
  solving: boolean;
  /**
   * Ask the student to read the problem before showing the answer.
   *
   * Kept in the store, not the component, so the choice survives moving
   * between problems the way the smart-parse toggle does.
   */
  tutorEnabled: boolean;
  /** Opt-in local-LLM parsing. */
  smartEnabled: boolean;
  smartStatus: SmartStatus;
  smartProgress: number;
  smartModelLabel: string;
  smartModelMB: number;
  /** Consent to share problem text to improve the parser. */
  shareConsent: boolean;
  collectorConfigured: boolean;
  setMode(mode: Mode): void;
  setInput(key: InputKey, value: string): void;
  setUnitSystem(system: UnitSystem): void;
  /** Parse with whichever engine is active (rule, or smart when ready). */
  submitStory(text: string): Promise<void>;
  setDraft(draft: string): void;
  /** Override the detected domain; blanks the form, whose fields change. */
  setDomain(domain: DomainId): void;
  loadStory(text: string): void;
  enableSmart(): Promise<void>;
  disableSmart(): void;
  /** Edit one segment's start or end height. */
  setPhaseHeight(index: number, key: keyof PhaseInputs, value: string): void;
  /** Change what carries across a boundary. */
  setPhaseLink(index: number, kind: LinkKind): void;
  /** Append a segment continuing from where the last one ended. */
  addPhase(): void;
  /** Drop a segment, collapsing back to a single-segment story at one left. */
  removePhase(index: number): void;
  /** Abandon the phase split and solve as one segment. */
  clearPhases(): void;
  setTutorEnabled(on: boolean): void;
  setShareConsent(consent: boolean): void;
  loadFreeFall(): void;
  reset(): void;
}

export const useKinematicsStore = create<KinematicsState>((set, get) => ({
  mode: 'story',
  inputs: DEFAULT_INPUTS,
  unitSystem: 'metric',
  story: '',
  draft: '',
  solving: false,
  domain: 'kinematics-1d',
  domainAmbiguous: false,
  given: [],
  unusedNumbers: [],
  asked: undefined,
  phases: undefined,
  unsegmentedStages: false,
  tutorEnabled: false,
  smartEnabled: false,
  smartStatus: isSmartParseSupported() ? 'idle' : 'unsupported',
  smartProgress: 0,
  smartModelLabel: SMART_MODEL.label,
  smartModelMB: SMART_MODEL.approxMB,
  shareConsent: false,
  collectorConfigured: COLLECTOR_CONFIGURED,

  setMode: (mode) => set({ mode }),

  setDraft: (draft) => set({ draft }),

  setDomain: (domain) =>
    set((state) =>
      state.domain === domain
        ? {}
        : {
            domain,
            // Field sets differ between domains, so carrying values across
            // would leave a stale x1 in a problem that has no x1.
            inputs: { ...blankInputs(domain), a: state.inputs['a'] ?? '' },
            given: [],
            diagnostics: undefined,
            domainAmbiguous: false,
          },
    ),

  setInput: (key, value) =>
    set((state) => ({ inputs: { ...state.inputs, [key]: value } })),

  setUnitSystem: (system) =>
    set((state) => ({
      unitSystem: system,
      inputs: convertInputs(state.inputs, state.unitSystem, system),
      // Phase heights are display strings too, so they convert with everything
      // else — otherwise switching to feet would reinterpret 30 m as 30 ft.
      phases: state.phases
        ? convertPhaseHeights(state.phases, state.unitSystem, system)
        : undefined,
    })),

  loadStory: (text) => {
    const state = get();
    const result = parse(text);
    // A story written in feet is an imperial problem: solve *and* display it
    // that way, rather than silently converting the answer to metres.
    const system = detectSystem(text) ?? state.unitSystem;
    set({
      ...statePatch(system, text, result),
      unitSystem: system,
      diagnostics: diagnose('rule', result, result),
    });
    maybeCollect(text, result, 'rule', state.shareConsent);
  },

  submitStory: async (text) => {
    const state = get();
    set({ draft: text, solving: true });
    try {
      if (state.smartEnabled && state.smartStatus === 'ready') {
        try {
          const smart = await smartParse(text, state.unitSystem);
          if (smart) {
            // The grammar is the floor, not the alternative — smart parse only
            // fills what it left empty.
            const rule = parse(text);
            const result = mergeParses(rule, smart);
            const system = detectSystem(text) ?? state.unitSystem;
            set({
              ...statePatch(system, text, result),
              unitSystem: system,
              diagnostics: diagnose('smart', rule, result),
            });
            maybeCollect(text, result, 'smart', get().shareConsent);
            return;
          }
        } catch {
          /* fall through to the always-available rule parser */
        }
      }
      get().loadStory(text);
    } finally {
      // Always clears, so a failed parse cannot leave the button spinning.
      set({ solving: false });
    }
  },

  enableSmart: async () => {
    if (!isSmartParseSupported()) {
      set({ smartStatus: 'unsupported' });
      return;
    }
    set({ smartEnabled: true, smartStatus: 'loading', smartProgress: 0 });
    try {
      await warmUp((fraction) => set({ smartProgress: fraction }));
      set({ smartStatus: 'ready', smartProgress: 1 });
    } catch {
      set({ smartStatus: 'error', smartEnabled: false });
    }
  },

  disableSmart: () =>
    set({
      smartEnabled: false,
      smartStatus: isSmartParseSupported() ? 'idle' : 'unsupported',
    }),

  setPhaseHeight: (index, key, value) =>
    set((state) => {
      if (!state.phases) return {};
      const phases = state.phases.phases.map((phase, i) =>
        i === index ? { ...phase, [key]: value } : phase,
      );
      return { phases: { ...state.phases, phases } };
    }),

  setPhaseLink: (index, kind) =>
    set((state) => {
      if (!state.phases) return {};
      const links = state.phases.links.map((link, i) =>
        i === index ? { ...link, kind } : link,
      );
      return { phases: { ...state.phases, links } };
    }),

  addPhase: () =>
    set((state) => {
      // Splitting a single-segment story: the existing motion becomes phase 1
      // and the new segment continues from where it ended.
      if (!state.phases) {
        return {
          phases: {
            phases: [
              { x1: state.inputs['x1'] ?? '', x2: state.inputs['x2'] ?? '' },
              { x1: state.inputs['x2'] ?? '', x2: '' },
            ],
            links: [{ kind: 'rest' as LinkKind }],
          },
        };
      }
      const last = state.phases.phases[state.phases.phases.length - 1];
      return {
        phases: {
          phases: [...state.phases.phases, { x1: last?.x2 ?? '', x2: '' }],
          links: [...state.phases.links, { kind: 'rest' as LinkKind }],
        },
      };
    }),

  removePhase: (index) =>
    set((state) => {
      if (!state.phases) return {};
      const phases = state.phases.phases.filter((_, i) => i !== index);
      // One segment is not a sequence — fall back to the ordinary path.
      if (phases.length < 2) return { phases: undefined };
      // Drop the link that joined the removed segment to its predecessor,
      // or the leading link when the first segment goes.
      const dropped = index === 0 ? 0 : index - 1;
      return {
        phases: { phases, links: state.phases.links.filter((_, i) => i !== dropped) },
      };
    }),

  clearPhases: () => set({ phases: undefined, unsegmentedStages: false }),

  setTutorEnabled: (on) => set({ tutorEnabled: on }),

  setShareConsent: (consent) => set({ shareConsent: consent }),

  loadFreeFall: () =>
    set((state) => ({ inputs: { ...state.inputs, a: DEFAULT_INPUTS['a'] ?? '' } })),

  reset: () =>
    set({
      inputs: DEFAULT_INPUTS,
      story: '',
      draft: '',
      solving: false,
      given: [],
      unusedNumbers: [],
      asked: undefined,
      phases: undefined,
      unsegmentedStages: false,
      diagnostics: undefined,
    }),
}));
