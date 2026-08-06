import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT, examplesBlock, userPrompt } from './prompt.ts';
import type { Example } from './retrieve.ts';

const example = (text: string, extraction: Example['extraction']): Example => ({
  text,
  extraction,
});

describe('SYSTEM_PROMPT', () => {
  it('carries the conventions but no worked examples', () => {
    // Examples are retrieved per problem now; a fixed set baked in here would
    // be exactly the generic cases that caused copying in the first place.
    expect(SYSTEM_PROMPT).toContain('Down is negative');
    expect(SYSTEM_PROMPT).not.toContain('Examples:');
    expect(SYSTEM_PROMPT).not.toContain('Problem: "');
  });
});

describe('examplesBlock', () => {
  it('renders each example as problem then target JSON', () => {
    const block = examplesBlock([
      example('A ball is dropped from 45 m', {
        x1: 45,
        x2: 0,
        v0: 0,
        v: null,
        a: -9.81,
        t: null,
        units: 'metric',
      }),
    ]);
    expect(block).toContain('Examples:');
    expect(block).toContain('Problem: "A ball is dropped from 45 m"');
    expect(block).toContain('"x1":45');
    expect(block).toContain('"v":null');
  });

  it('is empty when nothing was retrieved, leaving the prompt valid', () => {
    expect(examplesBlock([])).toBe('');
  });

  it('keeps examples in the order given', () => {
    const block = examplesBlock([
      example('first', { x1: 1, x2: null, v0: null, v: null, a: null, t: null, units: 'metric' }),
      example('second', { x1: 2, x2: null, v0: null, v: null, a: null, t: null, units: 'metric' }),
    ]);
    expect(block.indexOf('first')).toBeLessThan(block.indexOf('second'));
  });
});

describe('userPrompt', () => {
  it('states the unit system and the problem', () => {
    const prompt = userPrompt('  A ball falls 20 m  ', 'imperial');
    expect(prompt).toContain('Unit system: imperial');
    expect(prompt).toContain('Problem: "A ball falls 20 m"');
    expect(prompt.trimEnd().endsWith('JSON:')).toBe(true);
  });
});
