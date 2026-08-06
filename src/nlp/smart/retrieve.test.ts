import { describe, expect, it } from 'vitest';
import { type Example, buildIdf, selectExamples, terms } from './retrieve.ts';

const ex = (text: string): Example => ({
  text,
  extraction: { x1: null, x2: null, v0: null, v: null, a: null, t: null, units: 'metric' },
});

const BANK: Example[] = [
  ex('A ball is allowed to fall from 45 m and it lands on the grass'),
  ex('A stone is allowed to fall from 120 m and it lands on the pavement'),
  ex('A brick is thrown straight up at 14 m/s and it lands on the street'),
  ex('An acorn breaks loose 62 ft above the lawn and it thuds into the grass'),
  ex('A capsule is already falling at 4 m/s as it passes a marker 150 m up'),
  ex('A coin is dropped from 30 m and it settles on a shed 4 m tall'),
];

describe('terms', () => {
  it('collapses every number to a single placeholder', () => {
    // Retrieval should match phrasing, not magnitude.
    expect(terms('dropped from 45 m')).toEqual(terms('dropped from 120 m'));
  });

  it('keeps units, since metric and imperial want different examples', () => {
    expect(terms('from 45 m')).not.toEqual(terms('from 45 ft'));
  });

  it('includes bigrams, which is where phrasing lives', () => {
    expect(terms('allowed to fall')).toContain('allowed to');
    expect(terms('allowed to fall')).toContain('to fall');
  });
});

describe('selectExamples', () => {
  it('puts a same-phrasing example in the selection', () => {
    const picked = selectExamples('A wrench is allowed to fall from 80 m', BANK, 2);
    expect(picked.map((p) => p.text).join(' ')).toContain('allowed to fall');
  });

  it('is unswayed by a shared magnitude', () => {
    // 150 appears only in the capsule case; phrasing should still decide.
    const picked = selectExamples('A bolt is allowed to fall from 150 m', BANK, 1);
    expect(picked[0]!.text).toContain('allowed to fall');
  });

  it('prefers the matching unit system', () => {
    const picked = selectExamples('A nut breaks loose 30 ft above the lawn', BANK, 1);
    expect(picked[0]!.text).toContain('ft');
  });

  it('takes both matching examples when the bank has two', () => {
    // Deliberately not traded away for variety: examples resembling the problem
    // are the point, and the bank is already deduplicated by phrasing.
    const picked = selectExamples('A ball is allowed to fall from 45 m', BANK, 2);
    expect(picked.every((p) => p.text.includes('allowed to fall'))).toBe(true);
  });

  it('ranks by relevance, so a weaker match only appears deeper', () => {
    const two = selectExamples('A wrench is allowed to fall from 80 m', BANK, 2);
    const four = selectExamples('A wrench is allowed to fall from 80 m', BANK, 4);
    // Reversed order puts the best last, so the tail must be stable as K grows.
    expect(four.slice(-2)).toEqual(two);
  });

  it('orders the most relevant example last, nearest the problem', () => {
    const picked = selectExamples('A wrench is allowed to fall from 80 m', BANK, 3);
    expect(picked[picked.length - 1]!.text).toContain('allowed to fall');
  });

  it('never returns more than asked for, or more than it has', () => {
    expect(selectExamples('anything', BANK, 3)).toHaveLength(3);
    expect(selectExamples('anything', BANK, 99)).toHaveLength(BANK.length);
    expect(selectExamples('anything', BANK, 0)).toEqual([]);
    expect(selectExamples('anything', [], 3)).toEqual([]);
  });

  it('accepts a prebuilt idf, so the bank is scanned once per session', () => {
    const idf = buildIdf(BANK);
    const withIdf = selectExamples('A wrench is allowed to fall from 80 m', BANK, 2, idf);
    const without = selectExamples('A wrench is allowed to fall from 80 m', BANK, 2);
    expect(withIdf.map((p) => p.text)).toEqual(without.map((p) => p.text));
  });

  it('degrades to something rather than nothing on unrelated text', () => {
    const picked = selectExamples('a dinosaur eats cookies', BANK, 2);
    expect(picked).toHaveLength(2);
  });
});
