/**
 * Hand-rolled tokenizer — no external NLP dependency.
 *
 * It lowercases, folds the many ways people write units into canonical single
 * tokens (`m/s2`, `m/s`, `ft`, `s`, ...), then splits into `number` and `word`
 * tokens. Unit folding happens here so the grammar can treat "meters per
 * second", "m/s", and "mps" identically.
 *
 * Exposed behind the `Tokenizer` interface so it can be swapped for a richer
 * implementation without touching the grammar or parser.
 */
import type { Token, Tokenizer } from './types.ts';

/** Ordered so more specific unit spellings fold before more general ones. */
const UNIT_FOLDING: ReadonlyArray<readonly [RegExp, string]> = [
  [/(?:m|meters?|metres?)\s*\/\s*s\s*\^?2/g, ' m/s2 '],
  [/(?:meters?|metres?)\s+per\s+second\s+squared/g, ' m/s2 '],
  [/(?:ft|feet|foot)\s*\/\s*s\s*\^?2/g, ' ft/s2 '],
  [/(?:feet|foot)\s+per\s+second\s+squared/g, ' ft/s2 '],
  [/(?:meters?|metres?)\s+per\s+second/g, ' m/s '],
  [/m\s*\/\s*s(?!2)/g, ' m/s '],
  [/(?:feet|foot|ft)\s+per\s+second/g, ' ft/s '],
  [/ft\s*\/\s*s(?!2)/g, ' ft/s '],
  [/\b(?:meters?|metres?)\b/g, ' m '],
  [/\b(?:feet|foot)\b/g, ' ft '],
  [/\b(?:seconds?|secs?)\b/g, ' s '],
];

const TOKEN_PATTERN = /-?\d+(?:\.\d+)?|[a-z]+(?:\/[a-z]+\d*)?/g;

export class DefaultTokenizer implements Tokenizer {
  normalize(input: string): string {
    let text = input.toLowerCase();
    text = text.replace(/²/g, '2').replace(/³/g, '3');
    text = text.replace(/[,;:!?()"']/g, ' ');
    // Drop sentence periods but keep decimal points (a period between digits).
    text = text.replace(/\.(?!\d)/g, ' ');
    for (const [pattern, replacement] of UNIT_FOLDING) {
      text = text.replace(pattern, replacement);
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  tokenize(input: string): Token[] {
    const text = this.normalize(input);
    const tokens: Token[] = [];
    for (const match of text.matchAll(TOKEN_PATTERN)) {
      const raw = match[0];
      const isNumber = /^-?\d/.test(raw);
      tokens.push({
        kind: isNumber ? 'number' : 'word',
        text: raw,
        value: isNumber ? Number(raw) : undefined,
        index: tokens.length,
      });
    }
    return tokens;
  }
}

export const defaultTokenizer = new DefaultTokenizer();
