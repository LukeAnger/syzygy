/**
 * The catalogue behind the dev panel's one-click buttons.
 *
 * Separate from the component so it can be tested in node — `DevPanel.tsx`
 * pulls in React and a CSS module, and the thing worth checking here is data.
 *
 * The grouping is an assertion, not decoration. Every group names the domain
 * its problems should be *detected* as, and `dev-problems.test.ts` holds the
 * catalogue to it. That turns the panel into a tripwire: if a change to the
 * cue lists starts routing river problems to kinematics, the test says so
 * before anyone clicks anything.
 *
 * Known gaps are recorded as `detects` overrides rather than quietly filed
 * under whatever they currently do. The override is the honest way to keep a
 * problem next to its topic — where a person looking for it will look — while
 * still pinning what the app really does with it today. When a gap closes, the
 * override is what fails.
 */
import type { DomainId } from '../domains/index.ts';

export interface DevProblem {
  readonly id: string;
  readonly text: string;
  /** Where this really lands today, when that is not the group's domain. */
  readonly detects?: DomainId;
  /** Why it lands there, shown as the button's tooltip suffix. */
  readonly gap?: string;
}

export interface DevGroup {
  readonly heading: string;
  /** The domain every problem here should be detected as. */
  readonly domain: DomainId;
  readonly problems: readonly DevProblem[];
  /** Shown under the row when the group's expectation needs saying. */
  readonly note?: string;
}

/**
 * Verbatim from the problem set these were scoped against, so a button loads
 * what a student would actually paste — not a version tidied up until it
 * parses. Numbered as they are on the page, for traceability.
 */
const RV1 =
  'A motorcycle traveling on the highway at a speed of 120 km/h passes a car ' +
  'traveling at a speed of 90 km/h. From the point of view of a passenger on ' +
  'the car, what is the velocity of the motorcycle?';

const RV2 =
  'A ball is kicked off the back of a pickup truck traveling at 50 km/h. A ' +
  'pedestrian on the ground sees the ball hit the pavement and then bounce ' +
  'straight up. What was the velocity of the ball relative to the truck?';

const RV3 =
  'A duck swims at a constant speed from one side of a river to the other ' +
  'side in a time of 4 seconds. The river is 6 meters wide and it is flowing ' +
  'at a speed of 2 m/s. What is the velocity of the duck and what is its ' +
  'direction of travel, with respect to ground?';

const RV5 =
  'A car is driving down the road at a velocity Vc, relative to ground, and ' +
  'is delivering newspapers to homes. The newspapers are thrown at a velocity ' +
  'of Vp relative to the car. At what angle must the newspapers be thrown, ' +
  'relative to the car, so that they fly in a direction parallel to the ' +
  'driveways?';

const RV6 =
  'In a skills competition, a hockey player is skating across the ice at a ' +
  'velocity Vh and tries to hit a target with the puck. If the velocity of ' +
  'the puck relative to the player is Vp, at what angle must the player hit ' +
  'the puck, relative to the line of sight between puck and target, so that ' +
  'the puck hits the target?';

/** A numeric compensation crossing, to sit beside the duck's drift crossing. */
const SWIMMER =
  'A swimmer who can swim at 1.2 m/s must head upstream to land directly ' +
  'opposite across a river 30 m wide flowing at 0.5 m/s. At what angle must ' +
  'she head?';

export const DEV_GROUPS: readonly DevGroup[] = [
  {
    heading: 'Kinematics 1-D',
    domain: 'kinematics-1d',
    problems: [
      {
        id: 'roof-two-phase',
        text:
          'a ball is dropped off a roof at 150m then falls on another roof thats 30m ' +
          'high. the ball then rolls off and falls to the ground. how fast is the ' +
          'ball traveling when it hits the ground?',
      },
      {
        id: 'staged-unsegmentable',
        text: 'a ball falls 40 m and then rolls off and hits the ground',
      },
      { id: 'plain-drop', text: 'A ball is dropped from a height of 45 m' },
      // For "Work it through": both ask a question and offer a real choice.
      // Verified with the relevance trace — the brick's two heights genuinely
      // do not enter v, since v = v0 + at needs only the duration.
      {
        id: 'tutor-all-needed',
        text: 'A ball is dropped from a height of 45 m. How fast is it going when it lands?',
      },
      {
        id: 'tutor-two-distractors',
        text:
          'A brick is dropped from 80 m onto a shed 5 m tall and takes 3.9 s. ' +
          'How fast is it moving when it lands?',
      },
    ],
  },
  {
    heading: 'Relative velocity',
    domain: 'relative-velocity',
    problems: [
      { id: 'rv1-two-vehicles', text: RV1 },
      {
        id: 'rv2-inferred-zero',
        text: RV2,
        // Two gaps, both documented: "bounce straight up" is a velocity stated
        // in words, so only one speed is numeric and detection's second bar is
        // never cleared; and "velocity of the ball relative to the truck"
        // should outrank word order in deciding which body is which.
        detects: 'kinematics-1d',
        gap: 'one numeric speed only — reads as kinematics',
      },
    ],
  },
  {
    heading: '2-D relative velocity',
    domain: 'relative-velocity-2d',
    problems: [
      // The two river archetypes, adjacent on purpose. They are hard to tell
      // apart by eye, so if a change ever makes the second read like the first
      // the answer stays plausible and stops being right — the failure that is
      // hardest to catch by hand.
      { id: 'rv2d-duck-drift', text: RV3 },
      { id: 'rv2d-swimmer-compensating', text: SWIMMER },
    ],
  },
  {
    // 2-D by topic, and the same shape as the compensating swimmer, but every
    // quantity is a letter. Kept as buttons because the right behaviour is an
    // empty form and an honest refusal, and that is worth one click to check.
    heading: '2-D, stated symbolically',
    domain: 'relative-velocity-2d',
    problems: [
      {
        id: 'rv5-newspaper-angle',
        text: RV5,
        detects: 'kinematics-1d',
        gap: 'velocities are symbols, not numbers',
      },
      {
        id: 'rv6-puck-angle',
        text: RV6,
        detects: 'kinematics-1d',
        gap: 'velocities are symbols, not numbers',
      },
    ],
    note: 'No numbers to read. Detects as kinematics; should solve nothing.',
  },
];
