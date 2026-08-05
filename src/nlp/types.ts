/**
 * Types for the word-problem parser.
 *
 * The pipeline is: raw text → `Tokenizer` → tokens → slot `Rule`s →
 * `SlotMatch`es → resolved `ParseResult`. The parser only *pre-fills* the
 * variable form; the form remains the ground truth, so unmatched input is
 * reported rather than guessed at.
 */
import type { Quantity } from '../math/index.ts';
import type { VariableKey } from '../engine/index.ts';

export interface Token {
  readonly kind: 'word' | 'number';
  readonly text: string;
  /** Parsed numeric value (present when kind === 'number'). */
  readonly value?: number;
  /** Position in the token list. */
  readonly index: number;
}

/** Turns raw problem text into a token stream. Swappable by design. */
export interface Tokenizer {
  tokenize(input: string): Token[];
}

export interface SlotMatch {
  readonly ruleId: string;
  readonly variable: VariableKey;
  readonly quantity: Quantity;
  /** Inclusive token span this match consumed. */
  readonly startToken: number;
  readonly endToken: number;
  /** The matched phrase text, for highlighting what was understood. */
  readonly source: string;
}

export interface Rule {
  readonly id: string;
  readonly description: string;
  match(tokens: Token[]): SlotMatch[];
}

export interface Assignment {
  readonly variable: VariableKey;
  readonly quantity: Quantity;
  readonly ruleId: string;
  readonly source: string;
}

export interface ParseResult {
  /** Normalized text the parser actually worked on. */
  readonly text: string;
  /** One assignment per variable, in priority order. */
  readonly assignments: Assignment[];
  /** Numbers the parser saw but could not attach to any variable. */
  readonly unusedNumbers: number[];
  /**
   * The variable the problem asks for, when it asks for one. Absent for a
   * story that only narrates — the solver then falls back to solving all.
   */
  readonly target?: VariableKey;
}
