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

describe('road units', () => {
  const words = (input: string) =>
    defaultTokenizer.tokenize(input).map((t) => t.text);

  it('folds every common spelling of km/h', () => {
    for (const spelling of ['120 km/h', '120 kph', '120 kilometres per hour', '120 km per hour']) {
      expect(words(spelling), spelling).toEqual(['120', 'km/h']);
    }
  });

  it('folds every common spelling of mph', () => {
    for (const spelling of ['70 mph', '70 miles per hour', '70 m.p.h.']) {
      expect(words(spelling), spelling).toEqual(['70', 'mph']);
    }
  });

  /** "km/h" contains an m and an h; "miles per hour" contains "miles". */
  it('is not fooled by the shorter units hiding inside the longer ones', () => {
    expect(words('120 km/h')).not.toContain('m');
    expect(words('70 miles per hour')).not.toContain('mi');
  });

  it('still folds road distances on their own', () => {
    expect(words('5 km')).toEqual(['5', 'km']);
    expect(words('3 miles')).toEqual(['3', 'mi']);
  });

  it('leaves the existing units alone', () => {
    expect(words('45 m in 3 s at 20 m/s')).toEqual(['45', 'm', 'in', '3', 's', 'at', '20', 'm/s']);
  });
});
