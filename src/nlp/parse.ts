/**
 * Word-problem parser: tokenize → run every rule → resolve one assignment per
 * variable (first match wins, in rule-priority order) → report leftover numbers.
 *
 * Graceful degradation is the whole point: the result *pre-fills* the variable
 * form and flags numbers it couldn't place, so the student sees and corrects
 * what the parser missed rather than trusting a black box.
 */
import type { Quantity } from '../math/index.ts';
import type { Knowns, VariableKey } from '../engine/index.ts';
import type { Assignment, ParseResult, SlotMatch, Tokenizer } from './types.ts';
import { defaultTokenizer } from './tokenizer.ts';
import { RULES } from './grammar.ts';
import { RELATIVE_RULES } from './grammar-relative.ts';
import type { DomainId } from '../domains/index.ts';

/** Which rule set reads a story, by domain. */
const RULES_FOR: Record<DomainId, typeof RULES> = {
  'kinematics-1d': RULES,
  'relative-velocity': RELATIVE_RULES,
};
import { detectQuestion } from './question.ts';

export function parse(
  input: string,
  domain: DomainId = 'kinematics-1d',
  tokenizer: Tokenizer = defaultTokenizer,
): ParseResult {
  const tokens = tokenizer.tokenize(input);
  const allMatches = RULES_FOR[domain].flatMap((rule) => rule.match(tokens));

  const chosen = new Map<VariableKey, SlotMatch>();
  for (const match of allMatches) {
    if (!chosen.has(match.variable)) chosen.set(match.variable, match);
  }

  const consumed = new Set<number>();
  for (const match of chosen.values()) {
    for (let i = match.startToken; i <= match.endToken; i++) consumed.add(i);
  }

  const assignments: Assignment[] = [...chosen.values()].map((match) => ({
    variable: match.variable,
    quantity: match.quantity,
    ruleId: match.ruleId,
    source: match.source,
  }));

  const unusedNumbers = tokens
    .filter((t) => t.kind === 'number' && t.value !== undefined && !consumed.has(t.index))
    .map((t) => t.value!);

  return {
    text: tokens.map((t) => t.text).join(' '),
    assignments,
    unusedNumbers,
    target: detectQuestion(input, domain)?.target,
  };
}

/** Fold parsed assignments into a `Knowns` map the solver can consume. */
export function toKnowns(assignments: Assignment[]): Knowns {
  const knowns: Record<VariableKey, Quantity> = {};
  for (const assignment of assignments) {
    knowns[assignment.variable] = assignment.quantity;
  }
  return knowns;
}
