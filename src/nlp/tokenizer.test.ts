import { describe, expect, it } from 'vitest';
import { DefaultTokenizer, defaultTokenizer } from './tokenizer.ts';

const tok = new DefaultTokenizer();
const texts = (input: string) => tok.tokenize(input).map((t) => t.text);

describe('DefaultTokenizer.normalize', () => {
  it('folds spelled-out and symbolic units to canonical tokens', () => {
    expect(tok.normalize('40 meters per second')).toBe('40 m/s');
    expect(tok.normalize('9.8 m/s^2')).toBe('9.8 m/s2');
    expect(tok.normalize('9.8 m/s²')).toBe('9.8 m/s2');
    expect(tok.normalize('12 feet per second')).toBe('12 ft/s');
    expect(tok.normalize('200 metres')).toBe('200 m');
    expect(tok.normalize('3 seconds')).toBe('3 s');
  });

  it('lowercases and strips sentence punctuation', () => {
    expect(tok.normalize('It falls for 3 seconds.')).toBe('it falls for 3 s');
  });
});

describe('DefaultTokenizer.tokenize', () => {
  it('classifies numbers and words with running indices', () => {
    const tokens = tok.tokenize('thrown up at 20 m/s');
    expect(tokens.map((t) => t.kind)).toEqual([
      'word',
      'word',
      'word',
      'number',
      'word',
    ]);
    expect(tokens[3]).toMatchObject({ kind: 'number', value: 20, index: 3 });
    expect(tokens[4]!.text).toBe('m/s');
  });

  it('parses decimals and negative numbers', () => {
    expect(tok.tokenize('-4.5 m/s')[0]).toMatchObject({ value: -4.5 });
  });

  it('keeps compound unit tokens intact', () => {
    expect(texts('9.8 m/s2')).toEqual(['9.8', 'm/s2']);
  });

  it('exposes a shared default instance', () => {
    expect(defaultTokenizer.tokenize('3 s')).toHaveLength(2);
  });
});
