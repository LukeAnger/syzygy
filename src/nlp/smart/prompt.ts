/**
 * Prompt for the local extraction model. Kept small and example-driven — the
 * few-shot cases are the exact compositional problems the rule parser can't
 * handle (obstacle height, raised landing surface), so the model learns the
 * position convention rather than pattern-matching phrases.
 */
import type { UnitSystem } from '../../math/index.ts';

export const SYSTEM_PROMPT = `You extract the known quantities from a 1-D free-fall / kinematics word problem.

Output ONLY a JSON object with these keys (use null when the problem does not state a value):
  x1  initial (starting) position, measured upward from the ground
  x2  final (ending) position, measured upward from the ground
  v0  initial velocity
  v   final velocity
  a   acceleration
  t   time
  units  "metric" or "imperial"

Conventions:
- Down is negative: falling velocities and downward acceleration are negative.
- Positions are heights above the ground. "dropped from 100 m" => x1=100. "lands on the ground" => x2=0. "lands on a 4 m truck"/"a platform 15 m off the ground" => x2 is that height (4, 15).
- "dropped" or "from rest" => v0=0.
- Gravity: a=-9.81 (metric) or -32.17 (imperial) for free fall, unless stated.
- Values are numbers in the chosen unit system (metric: m, m/s, m/s^2, s).
- Do not solve anything. Only report what the problem states.

Examples:
Problem: "A ball is dropped from a height of 45 m"
{"x1":45,"x2":0,"v0":0,"v":null,"a":-9.81,"t":null,"units":"metric"}

Problem: "A ball is dropped from a platform 100 m up and lands on a truck that is 4 m tall"
{"x1":100,"x2":4,"v0":0,"v":null,"a":-9.81,"t":null,"units":"metric"}

Problem: "Dropped from 100 m onto a platform 15 m off the ground"
{"x1":100,"x2":15,"v0":0,"v":null,"a":-9.81,"t":null,"units":"metric"}

Problem: "A stone is thrown upward at 20 m/s and hits the ground at 30 m/s"
{"x1":null,"x2":0,"v0":20,"v":-30,"a":-9.81,"t":null,"units":"metric"}`;

export function userPrompt(text: string, system: UnitSystem): string {
  return `Unit system: ${system}\nProblem: "${text.trim()}"\nJSON:`;
}
