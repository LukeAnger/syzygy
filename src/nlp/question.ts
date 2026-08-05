/**
 * What the problem is *asking for*.
 *
 * The solver is happy to compute every unknown from any three knowns, but a
 * textbook problem asks for one specific thing — "what is the ball's speed when
 * it hits the ground?" — and part of the skill being taught is working out
 * which given values serve that question and which are there to mislead. A
 * solver that answers everything has quietly done that work for the student,
 * and cannot flag a distractor because it treats every result as equally
 * wanted.
 *
 * Deliberately a grammar, not a model: the way problems pose questions is far
 * more regular than the way they narrate scenarios. "Find the...", "how fast",
 * "what was the..." is a short, closed list, and getting it deterministically
 * wrong is easier to debug than getting it stochastically wrong.
 */
import type { VariableKey } from '../engine/index.ts';
import { defaultTokenizer } from './tokenizer.ts';
import type { Token } from './types.ts';

export interface Question {
  /** The variable the problem wants. */
  readonly target: VariableKey;
  /** The phrase that asked for it, for display back to the student. */
  readonly source: string;
}

/** Interrogatives that name the quantity outright. */
const DIRECT: ReadonlyArray<readonly [string[], VariableKey]> = [
  [['how', 'fast'], 'v'],
  [['how', 'quickly'], 'v'],
  [['how', 'long'], 't'],
  [['how', 'much', 'time'], 't'],
  [['how', 'high'], 'dx'],
  [['how', 'far'], 'dx'],
  [['how', 'deep'], 'dx'],
];

/** Openers after which the wanted quantity is named within a few words. */
const OPENERS: ReadonlyArray<string[]> = [
  ['what', 'is', 'the'],
  ['what', 'was', 'the'],
  ['what', 'will', 'the'],
  ['what', 'would', 'the'],
  ['at', 'what'],
  ['with', 'what'],
  ['find', 'the'],
  ['find'],
  ['calculate', 'the'],
  ['calculate'],
  ['determine', 'the'],
  ['determine'],
  ['compute', 'the'],
  ['solve', 'for'],
];

/** Nouns naming a quantity, and the variable each maps to. */
const NOUNS: ReadonlyArray<readonly [string, VariableKey]> = [
  ['speed', 'v'],
  ['velocity', 'v'],
  ['time', 't'],
  ['duration', 't'],
  ['acceleration', 'a'],
  ['height', 'dx'],
  ['distance', 'dx'],
  ['displacement', 'dx'],
  ['depth', 'dx'],
  ['drop', 'dx'],
];

/** Words that turn a velocity noun into the *initial* one. */
const INITIAL = ['initial', 'starting', 'launch', 'release', 'original'];

/** How far past an opener to look for the quantity being named. */
const WINDOW = 4;

function phraseAt(tokens: Token[], at: number, words: readonly string[]): boolean {
  return words.every((word, j) => {
    const token = tokens[at + j];
    return token?.kind === 'word' && token.text === word;
  });
}

function textOf(tokens: Token[], from: number, to: number): string {
  return tokens
    .slice(from, to + 1)
    .map((t) => t.text)
    .join(' ');
}

/**
 * The quantity a problem asks for, or null when it only narrates.
 *
 * Later questions win. Multi-part problems ("...find the time. What is the
 * speed on impact?") are conventionally answered in order, and the last clause
 * is the one a student is working on.
 */
export function detectQuestion(text: string): Question | null {
  const tokens = defaultTokenizer.tokenize(text);
  let found: Question | null = null;

  for (let i = 0; i < tokens.length; i++) {
    for (const [phrase, target] of DIRECT) {
      if (phraseAt(tokens, i, phrase)) {
        found = { target, source: textOf(tokens, i, i + phrase.length - 1) };
      }
    }

    for (const opener of OPENERS) {
      if (!phraseAt(tokens, i, opener)) continue;
      const from = i + opener.length;
      for (let j = from; j < Math.min(from + WINDOW, tokens.length); j++) {
        const noun = NOUNS.find(([word]) => tokens[j]?.text === word);
        if (!noun) continue;
        // "initial speed" asks for v₀; a bare "speed" asks for the final one.
        const qualified =
          noun[1] === 'v' &&
          tokens.slice(from, j).some((t) => INITIAL.includes(t.text));
        found = {
          target: qualified ? 'v0' : noun[1],
          source: textOf(tokens, i, j),
        };
        break;
      }
    }
  }

  return found;
}
