import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_INPUTS,
  assignmentsToInputs,
  buildKnowns,
  convertInputs,
  solveInputs,
  useKinematicsStore,
} from './store.ts';
import { VELOCITY, quantity } from '../math/index.ts';

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
