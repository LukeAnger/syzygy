import { describe, expect, it } from 'vitest';
import { LENGTH, TIME, VELOCITY, dimensionsEqual } from '../math/index.ts';
import { RULES } from './grammar.ts';
import { defaultTokenizer } from './tokenizer.ts';
import type { SlotMatch } from './types.ts';

function matchAll(input: string): SlotMatch[] {
  const tokens = defaultTokenizer.tokenize(input);
  return RULES.flatMap((rule) => rule.match(tokens));
}

function firstFor(input: string, variable: string): SlotMatch | undefined {
  return matchAll(input).find((m) => m.variable === variable);
}

describe('velocity rules', () => {
  it('reads "thrown upward at N" as positive v₀', () => {
    const m = firstFor('thrown upward at 20 m/s', 'v0')!;
    expect(m.quantity.value).toBe(20);
    expect(dimensionsEqual(m.quantity.dimension, VELOCITY)).toBe(true);
  });

  it('reads "thrown downward at N" as negative v₀', () => {
    expect(firstFor('thrown downward at 12 m/s', 'v0')!.quantity.value).toBe(-12);
  });

  it('reads impact phrases as negative final velocity', () => {
    expect(firstFor('hits the ground at 30 m/s', 'v')!.quantity.value).toBe(-30);
    expect(firstFor('lands at 15', 'v')!.quantity.value).toBe(-15);
  });

  it('defaults to m/s when no unit is given', () => {
    const m = firstFor('thrown up at 20', 'v0')!;
    expect(dimensionsEqual(m.quantity.dimension, VELOCITY)).toBe(true);
    expect(m.quantity.value).toBe(20);
  });
});

describe('flag and time rules', () => {
  it('reads "from rest" and "dropped" as v₀ = 0', () => {
    expect(firstFor('released from rest', 'v0')!.quantity.value).toBe(0);
    expect(firstFor('a ball is dropped', 'v0')!.quantity.value).toBe(0);
  });

  it('reads elapsed time', () => {
    const m = firstFor('it falls for 3 s', 't')!;
    expect(m.quantity.value).toBe(3);
    expect(dimensionsEqual(m.quantity.dimension, TIME)).toBe(true);
  });
});

describe('displacement rules', () => {
  it('reads "from a height of N" as negative Δx', () => {
    const m = firstFor('from a height of 45 m', 'dx')!;
    expect(m.quantity.value).toBe(-45);
    expect(dimensionsEqual(m.quantity.dimension, LENGTH)).toBe(true);
  });

  it('reads bare "falls N m" only with an explicit length unit', () => {
    expect(firstFor('falls 100 m', 'dx')!.quantity.value).toBe(-100);
    // No unit ⇒ the ambiguous distance trigger must not fire.
    expect(firstFor('falls 100', 'dx')).toBeUndefined();
  });
});

describe('dimension guarding', () => {
  it('ignores a number whose explicit unit is the wrong dimension', () => {
    // "in 45 m" must not be read as 45 seconds.
    expect(firstFor('in 45 m', 't')).toBeUndefined();
  });
});
