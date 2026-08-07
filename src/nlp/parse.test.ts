import { describe, expect, it } from 'vitest';
import { ACCELERATION, VELOCITY, quantity } from '../math/index.ts';
import { solve } from '../engine/index.ts';
import { kinematics1D } from '../domains/kinematics-1d/index.ts';
import { parse, toKnowns } from './parse.ts';
import type { Token, Tokenizer } from './types.ts';

/** Convenience: assignment value for a variable, or undefined. */
function value(result: ReturnType<typeof parse>, variable: string) {
  return result.assignments.find((a) => a.variable === variable)?.quantity.value;
}

describe('parse', () => {
  it('parses "falls from rest and hits the ground at 30 m/s"', () => {
    const result = parse('An apple falls from rest and hits the ground at 30 m/s');
    expect(value(result, 'v0')).toBe(0);
    expect(value(result, 'v')).toBe(-30);
    expect(result.unusedNumbers).toEqual([]);
  });

  it('parses a height + time problem', () => {
    const result = parse('A ball dropped from 100 m falls for 4.5 s');
    expect(value(result, 'v0')).toBe(0);
    expect(value(result, 'x1')).toBe(100);
    expect(value(result, 't')).toBe(4.5);
  });

  it('parses "from a height of N" as the starting position', () => {
    const result = parse('A rock is dropped from a height of 45 m');
    expect(value(result, 'x1')).toBe(45);
  });

  it('separates two positions instead of guessing a displacement', () => {
    // The case that motivated x₁/x₂: fall height minus obstacle height.
    const result = parse(
      'a ball is dropped from a platform 100 m in the air and lands on a truck that is 4 meters tall',
    );
    expect(value(result, 'v0')).toBe(0);
    expect(value(result, 'x1')).toBe(100);
    expect(value(result, 'x2')).toBe(4);
    expect(result.unusedNumbers).toEqual([]);
  });

  it('reads a raised landing surface as the final position', () => {
    const result = parse(
      'a ball is dropped from 100 m on a platform 15 m off the ground',
    );
    expect(value(result, 'x1')).toBe(100);
    expect(value(result, 'x2')).toBe(15);
    expect(result.unusedNumbers).toEqual([]);
  });

  it('converts explicit imperial units through the math core', () => {
    const result = parse('dropped from a height of 60 ft');
    expect(value(result, 'x1')).toBeCloseTo(18.288, 3);
  });

  it('reports numbers it could not place, assigning nothing', () => {
    const result = parse('A purple dinosaur eats 5 cookies');
    expect(result.assignments).toEqual([]);
    expect(result.unusedNumbers).toEqual([5]);
  });

  it('feeds straight into the solver (parse → knowns → solve)', () => {
    const result = parse('An object is thrown upward at 40 m/s and lands at 40 m/s');
    const knowns = { ...toKnowns(result.assignments), a: quantity(-9.82, ACCELERATION) };
    const solved = solve(kinematics1D, knowns);
    // Symmetric throw: up at 40, back down at 40 ⇒ ~8.15 s aloft.
    expect(solved.knowns['t']?.value).toBeCloseTo(8.15, 1);
  });

  it('honours an injected custom tokenizer (interface is swappable)', () => {
    const fixed: Token[] = [
      { kind: 'word', text: 'dropped', index: 0 },
    ];
    const stub: Tokenizer = { tokenize: () => fixed };
    const result = parse('anything at all', 'kinematics-1d', stub);
    expect(value(result, 'v0')).toBe(0);
  });
});

describe('toKnowns', () => {
  it('folds assignments into a keyed map', () => {
    const knowns = toKnowns([
      { variable: 'v0', quantity: quantity(0, VELOCITY), ruleId: 'rest', source: 'from rest' },
    ]);
    expect(knowns['v0']?.value).toBe(0);
  });
});
