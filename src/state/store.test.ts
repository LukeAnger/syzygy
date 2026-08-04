import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INPUTS,
  assignmentsToInputs,
  buildKnowns,
  convertInputs,
  solveInputs,
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
    const knowns = buildKnowns({ ...DEFAULT_INPUTS, dx: '10', a: '' }, 'imperial');
    expect(knowns['dx']?.value).toBeCloseTo(3.048, 3);
  });

  it('ignores non-numeric input', () => {
    const knowns = buildKnowns({ ...DEFAULT_INPUTS, v0: 'abc' }, 'metric');
    expect(knowns['v0']).toBeUndefined();
  });
});

describe('solveInputs', () => {
  it('auto-solves the remaining variables', () => {
    const result = solveInputs(
      { v0: '-40', v: '-80', a: '-9.82', t: '', dx: '' },
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
    const converted = convertInputs({ ...DEFAULT_INPUTS, dx: '100' }, 'metric', 'imperial');
    expect(Number(converted.dx)).toBeCloseTo(328.084, 2);
    expect(Number(converted.a)).toBeCloseTo(-32.185, 2);
  });

  it('is a no-op when the system is unchanged', () => {
    const inputs = { ...DEFAULT_INPUTS, v0: '5' };
    expect(convertInputs(inputs, 'metric', 'metric')).toBe(inputs);
  });
});
