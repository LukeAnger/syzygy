/**
 * Prompt for the local extraction model.
 *
 * The examples are load-bearing: a 360M model copies from them when it can't
 * ground a slot in the problem text. The first hardware run used four examples
 * that were metric, had `t: null`, and never had `v0: null` — and the model
 * duly dropped every stated time, never detected imperial, and filled `v0`
 * with 20 (the value from the last example) on problems that stated no initial
 * velocity at all. So every slot below varies across the examples, and each
 * slot is shown as `null` at least once. A constant column teaches a constant.
 *
 * Example numbers are deliberately odd (14, 26, 3.5, 62) and never round. If a
 * value like 14 or 26 shows up in an extraction for a problem that doesn't
 * contain it, that is copying, and it is obvious at a glance.
 *
 * Varying the examples is not by itself a fix — a second run showed the model
 * simply copying the *new* values instead (t=3.5 landed on a problem with no
 * duration at all). Asking a model not to invent numbers is unenforceable, so
 * `dropUngrounded` in schema.ts enforces it structurally: any value absent
 * from the problem text is discarded before it can reach the solver. The
 * wording here need only make the right answer easy, not police the wrong one.
 */
import type { UnitSystem } from '../../math/index.ts';
import type { Example } from './retrieve.ts';

export const SYSTEM_PROMPT = `You extract the known quantities from a 1-D free-fall / kinematics word problem.

Output ONLY a JSON object with these keys:
  x1  initial (starting) position, measured upward from the ground
  x2  final (ending) position, measured upward from the ground
  v0  initial velocity
  v   final velocity
  a   acceleration
  t   elapsed time, in seconds
  units  "metric" or "imperial"

Conventions:
- Down is negative: falling velocities and downward acceleration are negative.
- Positions are heights above the ground. "dropped from 100 m" => x1=100. "lands on the ground" => x2=0. "lands on a 4 m truck"/"a platform 15 m off the ground" => x2 is that height (4, 15).
- Starting at rest => v0=0. "dropped", "released", "slips", "topples", "breaks loose", "falls" and "from rest" all mean the object started at rest.
- Already moving downward at a stated speed => v0 is negative. "already falling at 4 m/s" => v0=-4.
- Gravity: a=-9.81 (metric) or -32.17 (imperial) whenever the object is in free fall. A stated acceleration replaces it. Braking while moving downward opposes the motion, so "decelerates at 1.2 m/s^2 while descending" => a=1.2.
- Units: metres, m, m/s => "metric". feet, ft, inches, miles => "imperial". Report every value as a plain number in that system; never convert.
- Time is in seconds. "for the next 6 seconds" => t=6. A duration is a time, not a position.

Apply the conventions first: they supply v0=0 and the gravity value even when the problem never spells them out. Use null only for what is left over — a quantity the problem does not state and no convention supplies. Most often that is x2 (the story never says where the object ends up) or t (no duration given).

Every number you output must appear in the problem itself or come from a convention above. Never carry one over from the examples.

Do not solve anything. Only report what the problem states.
`;

/**
 * The worked examples, rendered ahead of the problem.
 *
 * Retrieved per problem rather than fixed, because a small model imitates its
 * examples far more readily than it follows instructions. Six generic cases
 * cannot resemble arbitrary input; the nearest few out of hundreds usually can,
 * which turns the copying into the mechanism instead of the defect.
 */
export function examplesBlock(examples: readonly Example[]): string {
  if (examples.length === 0) return '';
  const rendered = examples
    .map((e) => `Problem: "${e.text}"\n${JSON.stringify(e.extraction)}`)
    .join('\n\n');
  return `\n\nExamples:\n${rendered}`;
}

export function userPrompt(text: string, system: UnitSystem): string {
  return `Unit system: ${system}\nProblem: "${text.trim()}"\nJSON:`;
}
