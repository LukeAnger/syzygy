import { describe, expect, it } from 'vitest';
import { detectQuestion } from './question.ts';

const target = (text: string) => detectQuestion(text)?.target ?? null;

describe('detectQuestion', () => {
  it('reads the quantity out of a "what is the" question', () => {
    expect(target('what is the speed when it hits the ground?')).toBe('v');
    expect(target('what was the time of flight?')).toBe('t');
    expect(target('what is the acceleration?')).toBe('a');
  });

  it('handles interrogatives that name the quantity outright', () => {
    expect(target('how fast is it going?')).toBe('v');
    expect(target('how long does it fall?')).toBe('t');
    expect(target('how high did it go?')).toBe('dx');
    expect(target('how far does it travel?')).toBe('dx');
  });

  it('handles imperative phrasings', () => {
    expect(target('find the velocity on impact')).toBe('v');
    expect(target('calculate the time taken')).toBe('t');
    expect(target('determine the acceleration')).toBe('a');
    expect(target('solve for time')).toBe('t');
  });

  it('distinguishes the initial velocity from the final one', () => {
    expect(target('what is the initial speed?')).toBe('v0');
    expect(target('find the starting velocity')).toBe('v0');
    expect(target('what is the speed at impact?')).toBe('v');
  });

  it('returns null when the problem only narrates', () => {
    expect(detectQuestion('a ball is dropped from a height of 45 m')).toBeNull();
  });

  it('ignores a quantity named too far from the opener', () => {
    // "speed" here belongs to a later clause, not to "what is the".
    expect(target('what is the answer to the question about the speed')).toBeNull();
  });

  /** Multi-part problems are answered in order; the last clause is current. */
  it('takes the last question when several are asked', () => {
    expect(target('find the time. what is the speed on impact?')).toBe('v');
  });

  it('reports the phrase that asked, for display', () => {
    expect(detectQuestion('what is the speed when it lands?')?.source).toBe(
      'what is the speed',
    );
  });

  it('reads the question out of a full problem', () => {
    expect(
      target(
        'a ball drops off a roof at 150 m to another roof at 30 m, then rolls ' +
          'off the second roof. what is the balls speed when it hits the ground?',
      ),
    ).toBe('v');
  });
});
