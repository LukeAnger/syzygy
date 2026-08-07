import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_INPUTS,
  type InputKey,
  assignmentsToInputs,
  buildKnowns,
  convertInputs,
  mergeParses,
  solveInputs,
  solvePhaseSequence,
  useKinematicsStore,
} from './store.ts';
import { LENGTH, TIME, VELOCITY, quantity, toUnit } from '../math/index.ts';
import { relevanceFor } from '../engine/index.ts';
import { smartParse } from '../nlp/smart/index.ts';

// The real module pulls in WebLLM and needs a GPU; the store only cares that it
// returns a ParseResult or null.
vi.mock('../nlp/smart/index.ts', () => ({
  SMART_MODEL: { id: 'test-model', label: 'Test', approxMB: 1 },
  isSmartParseSupported: () => true,
  warmUp: async () => {},
  smartParse: vi.fn(),
}));

describe('buildKnowns', () => {
  it('parses non-empty inputs into SI quantities and skips blanks', () => {
    const knowns = buildKnowns({ ...DEFAULT_INPUTS, v0: '40' }, 'metric');
    expect(knowns['v0']?.value).toBe(40);
    expect(knowns['a']?.value).toBe(-9.81);
    expect(knowns['t']).toBeUndefined();
  });

  it('converts imperial inputs to SI', () => {
    const knowns = buildKnowns({ ...DEFAULT_INPUTS, x1: '10', a: '' }, 'imperial');
    expect(knowns['x1']?.value).toBeCloseTo(3.048, 3);
  });

  it('ignores non-numeric input', () => {
    const knowns = buildKnowns({ ...DEFAULT_INPUTS, v0: 'abc' }, 'metric');
    expect(knowns['v0']).toBeUndefined();
  });
});

describe('solveInputs', () => {
  it('auto-solves the remaining variables', () => {
    const result = solveInputs(
      { x1: '', x2: '', v0: '-40', v: '-80', a: '-9.82', t: '' },
      'metric',
    );
    expect(result.knowns['t']?.value).toBeCloseTo(4.0733, 3);
    expect(result.knowns['dx']?.value).toBeCloseTo(-244.35, 1);
  });
});

describe('assignmentsToInputs', () => {
  it('renders assignment quantities back into input strings', () => {
    const inputs = assignmentsToInputs(
      [{ variable: 'v0', quantity: quantity(40, VELOCITY), ruleId: 'x', source: '' }],
      'metric',
    );
    expect(inputs.v0).toBe('40');
  });

  it('expresses SI quantities in imperial when that system is active', () => {
    const inputs = assignmentsToInputs(
      [{ variable: 'v', quantity: quantity(30, VELOCITY), ruleId: 'x', source: '' }],
      'imperial',
    );
    expect(Number(inputs.v)).toBeCloseTo(98.425, 2);
  });
});

describe('convertInputs', () => {
  it('re-expresses inputs when the unit system changes', () => {
    const converted = convertInputs({ ...DEFAULT_INPUTS, x1: '100' }, 'metric', 'imperial');
    expect(Number(converted.x1)).toBeCloseTo(328.084, 2);
    expect(Number(converted.a)).toBeCloseTo(-32.185, 2);
  });

  it('is a no-op when the system is unchanged', () => {
    const inputs = { ...DEFAULT_INPUTS, v0: '5' };
    expect(convertInputs(inputs, 'metric', 'metric')).toBe(inputs);
  });
});

describe('store: Storymode is self-contained', () => {
  beforeEach(() => useKinematicsStore.getState().reset());

  it('defaults to story mode', () => {
    expect(useKinematicsStore.getState().mode).toBe('story');
  });

  it('loadStory fills inputs and records what was understood', () => {
    useKinematicsStore.getState().loadStory('dropped from a height of 45 m');
    const state = useKinematicsStore.getState();

    expect(state.story).toBe('dropped from a height of 45 m');
    expect(state.inputs.v0).toBe('0');
    expect(state.inputs.x1).toBe('45');
    // No final position stated ⇒ "falls to the ground" default x₂ = 0.
    expect(state.inputs.x2).toBe('0');
    expect(state.given.sort()).toEqual(['v0', 'x1', 'x2']);
    // The story alone is enough to solve — no manual entry needed.
    const result = solveInputs(state.inputs, state.unitSystem);
    expect(result.unsolved).toEqual([]);
  });

  it('separates two positions for an obstacle problem', () => {
    useKinematicsStore
      .getState()
      .loadStory(
        'a ball is dropped from a platform 100 m and lands on a truck that is 4 m tall',
      );
    const state = useKinematicsStore.getState();
    expect(state.inputs.x1).toBe('100');
    expect(state.inputs.x2).toBe('4');
    const result = solveInputs(state.inputs, state.unitSystem);
    // Falls 96 m, not 100 — speed ≈ 43.4 m/s.
    expect(result.knowns['dx']?.value).toBeCloseTo(-96, 6);
    expect(result.knowns['v']?.value).toBeCloseTo(-43.4, 1);
  });

  it('reports numbers it could not place', () => {
    useKinematicsStore.getState().loadStory('a dinosaur eats 5 cookies');
    expect(useKinematicsStore.getState().unusedNumbers).toEqual([5]);
    expect(useKinematicsStore.getState().given).toEqual([]);
  });

  it('reset clears the story back to defaults', () => {
    useKinematicsStore.getState().loadStory('dropped from 45 m');
    useKinematicsStore.getState().reset();
    const state = useKinematicsStore.getState();
    expect(state.story).toBe('');
    expect(state.given).toEqual([]);
    expect(state.inputs).toEqual(DEFAULT_INPUTS);
  });
});

describe('store: the question the story asks', () => {
  beforeEach(() => useKinematicsStore.getState().reset());

  it('records the variable the story asked for', () => {
    useKinematicsStore
      .getState()
      .loadStory('a ball is dropped from a height of 45 m. how fast is it going when it lands?');
    expect(useKinematicsStore.getState().asked).toBe('v');
  });

  it('leaves it unset when the story only narrates', () => {
    useKinematicsStore.getState().loadStory('a ball is dropped from a height of 45 m');
    expect(useKinematicsStore.getState().asked).toBeUndefined();
  });

  it('clears it on reset', () => {
    useKinematicsStore.getState().loadStory('find the time. a ball drops from 45 m');
    useKinematicsStore.getState().reset();
    expect(useKinematicsStore.getState().asked).toBeUndefined();
  });

  /** The point of the feature: naming the values the answer never touched. */
  it('identifies givens the answer does not depend on', () => {
    useKinematicsStore
      .getState()
      .loadStory('a ball is dropped from a height of 45 m. how fast is it going when it lands?');
    const state = useKinematicsStore.getState();
    const result = solveInputs(state.inputs, state.unitSystem);
    const relevance = relevanceFor(state.asked!, state.given, result);

    expect(relevance.solved).toBe(true);
    expect(relevance.used).toContain('v0');
    // Every given here genuinely feeds v, so nothing is flagged.
    expect(relevance.unnecessary).toEqual([]);
  });
});

describe('store: draft and solving state', () => {
  beforeEach(() => {
    useKinematicsStore.getState().reset();
    vi.mocked(smartParse).mockReset();
  });

  it('loads a problem into the box without submitting it', () => {
    useKinematicsStore.getState().setDraft('a ball is dropped from 45 m');
    expect(useKinematicsStore.getState().draft).toBe('a ball is dropped from 45 m');
    expect(useKinematicsStore.getState().story).toBe('');
  });

  it('puts submitted text in the box, so it stays visible and editable', async () => {
    await useKinematicsStore.getState().submitStory('dropped from 45 m');
    expect(useKinematicsStore.getState().draft).toBe('dropped from 45 m');
  });

  it('is not solving once a parse settles', async () => {
    await useKinematicsStore.getState().submitStory('dropped from 45 m');
    expect(useKinematicsStore.getState().solving).toBe(false);
  });

  /** A stuck spinner would be worse than none — the button never re-enables. */
  it('stops solving even when smart parse throws', async () => {
    vi.mocked(smartParse).mockRejectedValue(new Error('gpu exploded'));
    await useKinematicsStore.getState().enableSmart();
    await useKinematicsStore.getState().submitStory('dropped from 45 m');

    expect(useKinematicsStore.getState().solving).toBe(false);
    // And it still fell through to the grammar rather than giving up.
    expect(useKinematicsStore.getState().inputs.x1).toBe('45');
  });

  it('clears both on reset', async () => {
    await useKinematicsStore.getState().submitStory('dropped from 45 m');
    useKinematicsStore.getState().reset();
    expect(useKinematicsStore.getState().draft).toBe('');
    expect(useKinematicsStore.getState().solving).toBe(false);
  });
});

describe('store: staged motion', () => {
  beforeEach(() => useKinematicsStore.getState().reset());

  const ROOF =
    'a ball is dropped off a roof at 150m then falls on another roof thats 30m ' +
    'high. the ball then rolls off and falls to the ground. how fast is the ' +
    'ball traveling when it hits the ground?';

  /** End to end: the case that motivated the whole phase model. */
  it('answers a two-phase fall from the final segment', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    const state = useKinematicsStore.getState();

    expect(state.phases?.phases).toHaveLength(2);
    expect(state.asked).toBe('v');

    const solved = solvePhaseSequence(state.phases!, state.inputs, state.unitSystem);
    expect(solved.conflicts).toEqual([]);
    // Only the 30 m fall counts: −√(2·9.81·30) ≈ −24.26, not the −54.2 a
    // single 150 m fall gives.
    expect(solved.phases[1]!.knowns['v']?.value).toBeCloseTo(-24.26, 2);
  });

  it('carries the story\'s initial velocity into the first segment only', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    const state = useKinematicsStore.getState();
    const solved = solvePhaseSequence(state.phases!, state.inputs, state.unitSystem);

    expect(solved.phases[0]!.knowns['v0']?.value).toBe(0); // "dropped"
    // The second segment's start comes from the link, not from the story.
    expect(solved.phases[1]!.knowns['v0']?.value).toBe(0);
    expect(solved.phases[1]!.knowns['x1']?.value).toBe(30);
  });

  /** The panel must not claim a number is unplaced that the phases used. */
  it('does not report a height the phase split consumed as unplaced', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    const state = useKinematicsStore.getState();
    expect(state.phases).toBeDefined();
    expect(state.unusedNumbers).not.toContain(30);
  });

  it('warns when a story stages itself but cannot be segmented', () => {
    // Staged prose, but no chain of heights to split on.
    useKinematicsStore
      .getState()
      .loadStory('a ball falls 40 m and then rolls off and hits the ground');
    const state = useKinematicsStore.getState();
    expect(state.phases).toBeUndefined();
    expect(state.unsegmentedStages).toBe(true);
  });

  it('does not warn about an ordinary single-stage story', () => {
    useKinematicsStore.getState().loadStory('a ball is dropped from a height of 45 m');
    expect(useKinematicsStore.getState().unsegmentedStages).toBe(false);
  });

  it('leaves a single-segment story unsegmented', () => {
    useKinematicsStore.getState().loadStory('a ball is dropped from a height of 45 m');
    expect(useKinematicsStore.getState().phases).toBeUndefined();
  });

  it('clears segmentation on reset', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    useKinematicsStore.getState().reset();
    expect(useKinematicsStore.getState().phases).toBeUndefined();
  });
});

describe('store: editing phases', () => {
  beforeEach(() => useKinematicsStore.getState().reset());

  const ROOF =
    'a ball is dropped off a roof at 150m then falls on another roof thats 30m ' +
    'high. the ball then rolls off and falls to the ground.';

  it('corrects a mis-parsed height and changes the answer', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    useKinematicsStore.getState().setPhaseHeight(1, 'x1', '45');

    const state = useKinematicsStore.getState();
    const solved = solvePhaseSequence(state.phases!, state.inputs, state.unitSystem);
    // −√(2·9.81·45) ≈ −29.71, not the −24.26 the parsed 30 m gave.
    expect(solved.phases[1]!.knowns['v']?.value).toBeCloseTo(-29.71, 2);
  });

  it('changes what carries across a boundary', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    useKinematicsStore.getState().setPhaseLink(0, 'continuous');

    const state = useKinematicsStore.getState();
    const solved = solvePhaseSequence(state.phases!, state.inputs, state.unitSystem);
    // Uninterrupted, the whole 150 m fall counts again.
    expect(solved.phases[1]!.knowns['v']?.value).toBeCloseTo(-54.25, 1);
  });

  it('splits a single-segment story into two, continuing from its end', () => {
    useKinematicsStore.getState().loadStory('a ball is dropped from a height of 45 m');
    expect(useKinematicsStore.getState().phases).toBeUndefined();

    useKinematicsStore.getState().addPhase();
    const phases = useKinematicsStore.getState().phases!;
    expect(phases.phases).toHaveLength(2);
    expect(phases.phases[0]).toEqual({ x1: '45', x2: '0' });
    expect(phases.phases[1]!.x1).toBe('0'); // continues where phase 1 ended
    expect(phases.links).toHaveLength(1);
  });

  it('appends a segment from the last one\'s end', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    useKinematicsStore.getState().addPhase();
    const phases = useKinematicsStore.getState().phases!;
    expect(phases.phases).toHaveLength(3);
    expect(phases.phases[2]!.x1).toBe('0');
    expect(phases.links).toHaveLength(2);
  });

  it('keeps links one shorter than phases when removing', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    useKinematicsStore.getState().addPhase(); // 3 phases, 2 links
    useKinematicsStore.getState().removePhase(1);

    const phases = useKinematicsStore.getState().phases!;
    expect(phases.phases).toHaveLength(2);
    expect(phases.links).toHaveLength(1);
  });

  it('collapses to a single-segment story when only one phase is left', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    useKinematicsStore.getState().removePhase(0);
    expect(useKinematicsStore.getState().phases).toBeUndefined();
  });

  it('abandons the split on demand', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    useKinematicsStore.getState().clearPhases();
    expect(useKinematicsStore.getState().phases).toBeUndefined();
    expect(useKinematicsStore.getState().unsegmentedStages).toBe(false);
  });

  it('converts phase heights with the unit system', () => {
    useKinematicsStore.getState().loadStory(ROOF);
    useKinematicsStore.getState().setUnitSystem('imperial');

    const phases = useKinematicsStore.getState().phases!;
    // 150 m ≈ 492.126 ft — reinterpreting 150 as feet would be a silent error.
    expect(Number(phases.phases[0]!.x1)).toBeCloseTo(492.126, 2);
    expect(Number(phases.phases[0]!.x2)).toBeCloseTo(98.425, 2);
  });
});

describe('mergeParses', () => {
  const assign = (variable: InputKey, value: number, dim = LENGTH) => ({
    variable,
    quantity: quantity(value, dim),
    ruleId: 'x',
    source: '',
  });

  it('fills only the slots the grammar left empty', () => {
    const merged = mergeParses(
      { text: 's', assignments: [assign('v0', -4, VELOCITY)], unusedNumbers: [150] },
      {
        text: 's',
        assignments: [assign('v0', 99, VELOCITY), assign('x1', 150)],
        unusedNumbers: [],
      },
    );
    const byVar = Object.fromEntries(
      merged.assignments.map((a) => [a.variable, a.quantity.value]),
    );
    // Rule wins the contested slot; smart contributes only the missing one.
    expect(byVar['v0']).toBe(-4);
    expect(byVar['x1']).toBe(150);
    expect(merged.assignments).toHaveLength(2);
  });

  it('reports a number unplaced only when neither parser placed it', () => {
    const merged = mergeParses(
      { text: 's', assignments: [], unusedNumbers: [150, 32] },
      { text: 's', assignments: [], unusedNumbers: [32] },
    );
    expect(merged.unusedNumbers).toEqual([32]);
  });
});

describe('store: the ground-landing default', () => {
  beforeEach(() => {
    useKinematicsStore.getState().reset();
    vi.mocked(smartParse).mockReset();
  });

  it('applies when a start position is known and no duration is', () => {
    useKinematicsStore.getState().loadStory('dropped from a height of 45 m');
    expect(useKinematicsStore.getState().inputs.x2).toBe('0');
  });

  /** A stated duration means the story defines its own endpoint. */
  it('is withheld when the story states a duration', async () => {
    vi.mocked(smartParse).mockResolvedValue({
      text: 'story',
      assignments: [
        { variable: 'x1', quantity: quantity(150, LENGTH), ruleId: 'smart', source: '' },
        { variable: 't', quantity: quantity(6, TIME), ruleId: 'smart', source: '' },
      ],
      unusedNumbers: [],
    });

    await useKinematicsStore.getState().enableSmart();
    await useKinematicsStore.getState().submitStory('story');
    const state = useKinematicsStore.getState();

    expect(state.inputs.x1).toBe('150');
    expect(state.inputs.t).toBe('6');
    // NOT '0' — the capsule is still moving when the problem stops.
    expect(state.inputs.x2).toBe('');
  });

  it('merges grammar and model results rather than replacing', async () => {
    // The model finds the height the grammar missed; the grammar keeps the
    // signed initial velocity and duration the model missed.
    vi.mocked(smartParse).mockResolvedValue({
      text: 'story',
      assignments: [
        { variable: 'x1', quantity: quantity(150, LENGTH), ruleId: 'smart', source: '' },
      ],
      unusedNumbers: [],
    });

    await useKinematicsStore.getState().enableSmart();
    await useKinematicsStore
      .getState()
      .submitStory(
        'a capsule passes a marker while already moving downward at 4 m/s for 6 s',
      );
    const state = useKinematicsStore.getState();

    expect(state.inputs.x1).toBe('150'); // from the model
    expect(state.inputs.v0).toBe('-4'); // from the grammar
    expect(state.inputs.t).toBe('6'); // from the grammar
  });

  it('adopts the system the story is written in, and displays in it', () => {
    vi.mocked(smartParse).mockReset();
    useKinematicsStore.getState().loadStory('a brick is dropped from a height of 62 ft');
    const state = useKinematicsStore.getState();

    expect(state.unitSystem).toBe('imperial');
    // Displayed in feet, not silently converted to 18.9 m.
    expect(state.inputs.x1).toBe('62');
    expect(state.inputs.a).toBe('-32.17');
  });

  /**
   * Acceleration used to carry over from the form, so an imperial story left
   * −32.17 ft/s² behind and the next metric story inherited it as −9.805416.
   */
  it('does not leak one story\'s gravity into the next', () => {
    useKinematicsStore.getState().loadStory('a brick is dropped from a height of 62 ft');
    expect(useKinematicsStore.getState().inputs.a).toBe('-32.17');

    useKinematicsStore.getState().loadStory('a ball is dropped from a height of 45 m');
    const state = useKinematicsStore.getState();
    expect(state.unitSystem).toBe('metric');
    expect(state.inputs.a).toBe('-9.81');
  });

  it('keeps the active system when the story states no units', () => {
    useKinematicsStore.getState().setUnitSystem('imperial');
    useKinematicsStore.getState().loadStory('a ball is dropped');
    expect(useKinematicsStore.getState().unitSystem).toBe('imperial');
  });

  it('falls back to the rule parser when smart parse returns null', async () => {
    vi.mocked(smartParse).mockResolvedValue(null);

    await useKinematicsStore.getState().enableSmart();
    await useKinematicsStore.getState().submitStory('dropped from a height of 45 m');

    expect(useKinematicsStore.getState().inputs.x1).toBe('45');
    expect(useKinematicsStore.getState().inputs.x2).toBe('0');
  });
});

describe('store: domain detection', () => {
  beforeEach(() => useKinematicsStore.getState().reset());

  it('switches domain for a two-vehicle problem', () => {
    useKinematicsStore
      .getState()
      .loadStory(
        'A motorcycle at 120 km/h passes a car at 90 km/h. From the point of ' +
          'view of a passenger on the car, what is the velocity of the motorcycle?',
      );
    expect(useKinematicsStore.getState().domain).toBe('relative-velocity');
  });

  it('stays in kinematics for a free-fall story', () => {
    useKinematicsStore.getState().loadStory('a ball is dropped from a height of 45 m');
    expect(useKinematicsStore.getState().domain).toBe('kinematics-1d');
    expect(useKinematicsStore.getState().domainAmbiguous).toBe(false);
  });

  it('flags a two-body hint that did not meet the bar', () => {
    useKinematicsStore.getState().loadStory('Two cars 500 m apart. One travels at 30 m/s.');
    expect(useKinematicsStore.getState().domain).toBe('kinematics-1d');
    expect(useKinematicsStore.getState().domainAmbiguous).toBe(true);
  });

  /** Field sets differ, so carrying values over would leave stale inputs. */
  it('blanks the form when the domain is overridden', () => {
    useKinematicsStore.getState().loadStory('a ball is dropped from a height of 45 m');
    expect(useKinematicsStore.getState().inputs['x1']).toBe('45');

    useKinematicsStore.getState().setDomain('relative-velocity');
    const state = useKinematicsStore.getState();
    expect(state.domain).toBe('relative-velocity');
    expect(state.inputs['x1'] ?? '').toBe('');
    expect(state.given).toEqual([]);
  });

  it('is a no-op when the chosen domain is already active', () => {
    useKinematicsStore.getState().loadStory('a ball is dropped from a height of 45 m');
    useKinematicsStore.getState().setDomain('kinematics-1d');
    expect(useKinematicsStore.getState().inputs['x1']).toBe('45');
  });

  it('solves a relative-velocity problem once the domain is active', () => {
    const state = useKinematicsStore.getState();
    state.setDomain('relative-velocity');
    for (const [key, value] of [['xa', '0'], ['xb', '600'], ['va', '30'], ['vb', '-20']] as const) {
      useKinematicsStore.getState().setInput(key, value);
    }
    const current = useKinematicsStore.getState();
    const solved = solveInputs(current.inputs, current.unitSystem, current.domain);
    expect(solved.knowns['vrel']?.value).toBeCloseTo(50, 9);
    expect(solved.knowns['t']?.value).toBeCloseTo(12, 9);
  });
});

describe('store: reading a two-body story', () => {
  beforeEach(() => useKinematicsStore.getState().reset());

  /** The problem that motivated the whole domain. */
  it('reads the motorcycle problem end to end', () => {
    useKinematicsStore
      .getState()
      .loadStory(
        'A motorcycle traveling on the highway at a speed of 120 km/h passes a ' +
          'car traveling at a speed of 90 km/h. From the point of view of a ' +
          'passenger on the car, what is the velocity of the motorcycle?',
      );
    const state = useKinematicsStore.getState();

    expect(state.domain).toBe('relative-velocity');
    // Held in the units the problem used, not converted to SI behind the
    // student's back — the field reads back what they wrote.
    expect(Number(state.inputs['va'])).toBeCloseTo(120, 6);
    expect(Number(state.inputs['vb'])).toBeCloseTo(90, 6);
    expect(state.displayUnits.velocity?.symbol).toBe('km/h');
    expect(state.asked).toBe('vrel');

    const solved = solveInputs(
      state.inputs,
      state.unitSystem,
      state.domain,
      state.displayUnits,
    );
    // SI internally: 30 km/h is 8.33 m/s.
    expect(solved.knowns['vrel']?.value).toBeCloseTo(8.333, 2);
    // And 30 km/h once rendered, which is the answer the problem asked for.
    expect(
      toUnit(solved.knowns['vrel']!, state.displayUnits.velocity!),
    ).toBeCloseTo(30, 6);
  });

  it('negates the second body when they close head-on', () => {
    useKinematicsStore
      .getState()
      .loadStory(
        'Two trains 600 m apart travel towards each other at 30 m/s and 20 m/s. ' +
          'How long before they meet?',
      );
    const state = useKinematicsStore.getState();

    expect(Number(state.inputs['va'])).toBeCloseTo(30, 6);
    expect(Number(state.inputs['vb'])).toBeCloseTo(-20, 6);
    expect(Number(state.inputs['d'])).toBeCloseTo(600, 6);
    expect(state.asked).toBe('t');

    const solved = solveInputs(state.inputs, state.unitSystem, state.domain);
    expect(solved.knowns['t']?.value).toBeCloseTo(12, 6);
  });

  it('keeps both positive for a pursuit', () => {
    useKinematicsStore
      .getState()
      .loadStory('A car at 30 m/s overtakes a truck moving at 20 m/s, 100 m ahead');
    const state = useKinematicsStore.getState();

    expect(Number(state.inputs['vb'])).toBeCloseTo(20, 6);
    const solved = solveInputs(state.inputs, state.unitSystem, state.domain);
    expect(solved.knowns['vrel']?.value).toBeCloseTo(10, 6);
    expect(solved.knowns['t']?.value).toBeCloseTo(10, 6);
  });

  /** Kinematics-only machinery must not fire here. */
  it('applies no ground-landing default and no phases', () => {
    useKinematicsStore
      .getState()
      .loadStory('Two trains 600 m apart travel towards each other at 30 m/s and 20 m/s');
    const state = useKinematicsStore.getState();
    expect(state.inputs['x2']).toBeUndefined();
    expect(state.phases).toBeUndefined();
    expect(state.unsegmentedStages).toBe(false);
  });
});
