/**
 * How textbooks actually word kinematics problems.
 *
 * WRITTEN WITHOUT READING `src/nlp/grammar.ts`, AND IT MUST STAY THAT WAY.
 *
 * The point of a corpus is to measure the parser against language it was not
 * built around. Source the phrasings from the grammar's own trigger lists and
 * the corpus becomes a mirror: it reports ~100% and teaches nothing. That is
 * not hypothetical — `parse.test.ts` passes at essentially 100% because its
 * cases were written alongside the rules, while the same grammar scored 3/20
 * on five problems written without consulting it.
 *
 * So: if you are tempted to add a phrasing here because you just saw it in
 * `grammar.ts`, don't. Add it because a textbook says it. Several entries below
 * are deliberately ones the grammar is known to miss; that is the instrument
 * working, not a bug in the bank.
 *
 * `{n}` interpolates the number and its unit, `{obj}` the object, `{surf}` a
 * ground-level surface, `{plat}` a raised platform noun.
 */

/** Released with no initial speed. */
export const RELEASE_AT_REST = [
  '{obj} is dropped from {n}',
  '{obj} is released from rest {n} above the ground',
  '{obj} falls freely from {n}',
  '{obj} is let go from {n}',
  '{obj} slips from a ledge {n} up',
  '{obj} is allowed to fall from {n}',
  '{obj} begins to fall from a height of {n}',
  '{obj} breaks loose {n} above the ground',
  'from an altitude of {n}, {obj} is released',
  'starting from rest at {n}, {obj} falls',
  '{obj} rolls off the edge of a {plat} {n} high',
  '{obj} is knocked off a shelf {n} above the floor',
];

/** Given an upward initial speed. */
export const RELEASE_UPWARD = [
  '{obj} is thrown straight up at {v}',
  '{obj} is launched vertically upward with a speed of {v}',
  '{obj} is tossed upward at {v}',
  '{obj} leaves the ground moving upward at {v}',
  '{obj} is projected straight upward, leaving the hand at {v}',
  'with an initial upward speed of {v}, {obj} is released',
  '{obj} is flung skyward at {v}',
];

/** Given a downward initial speed. */
export const RELEASE_DOWNWARD = [
  '{obj} is thrown straight down at {v}',
  '{obj} is hurled downward with a speed of {v}',
  '{obj} is already falling at {v} as it passes a marker {n} up',
  '{obj} is pushed downward at {v} from {n}',
  'moving downward at {v}, {obj} passes a window {n} above the street',
];

/** Where the motion ends, at ground level. */
export const LAND_GROUND = [
  'it lands on the {surf}',
  'it strikes the {surf}',
  'it comes down on the {surf}',
  'it reaches the {surf}',
  'it finally meets the {surf}',
  'it thuds into the {surf}',
  'it comes to rest on the {surf}',
];

/** Where the motion ends, on something with a height of its own. */
export const LAND_RAISED = [
  'it lands on a {plat} {n} tall',
  'it comes down on a {plat} standing {n} high',
  'it settles on a {plat} {n} above the ground',
  'it stops on the roof of a {plat} {n} high',
  'it drops onto a {plat} whose top is {n} up',
];

/**
 * A duration during motion that is still going. Kept apart from `TIME_STATED`
 * because those phrasings ("it takes {t} to arrive") assert a landing, which
 * would contradict a problem that deliberately never says where the object
 * ends up.
 */
export const TIME_ONGOING = [
  'it falls for {t}',
  'it has been falling for {t}',
  'it descends for {t}',
  'it continues for another {t}',
  '{t} passes',
];

/** A stated duration for motion that ends somewhere. */
export const TIME_STATED = [
  'it takes {t} to arrive',
  '{t} later it lands',
  'the whole fall lasts {t}',
  'the descent occupies {t}',
  'it is in the air for {t}',
  'after {t} of flight it arrives',
];

/** A stated final speed. */
export const SPEED_STATED = [
  'it arrives at {v}',
  'it is moving at {v} on impact',
  'its speed just before landing is {v}',
  'it arrives travelling at {v}',
  'the impact speed is {v}',
];

/** The question a problem asks. */
export const QUESTIONS = {
  v: [
    'How fast is it going when it lands?',
    'What is its speed on impact?',
    'Find the final velocity.',
    'Determine how quickly it is moving at the end.',
  ],
  t: [
    'How long does the fall take?',
    'What is the time of flight?',
    'Find the time taken.',
    'Determine how long it is in the air.',
  ],
  dx: [
    'How far does it fall?',
    'What distance does it cover?',
    'Find the displacement.',
    'Through what height does it drop?',
  ],
};

/** Falling things. */
export const OBJECTS = [
  'a ball', 'a stone', 'a wrench', 'a brick', 'an acorn', 'a coin',
  'a hammer', 'a bolt', 'a flowerpot', 'a textbook', 'a pebble',
  'a steel sphere', 'a marble', 'a water bottle', 'a chunk of ice',
];

/** Things at ground level. */
export const SURFACES = [
  'ground', 'pavement', 'grass', 'floor', 'concrete', 'sand', 'street',
];

/** Things with a height of their own. */
export const PLATFORMS = [
  'shed', 'truck', 'crate', 'platform', 'ledge', 'wall', 'dumpster', 'kiosk',
];

/**
 * Irrelevant quantities, as textbooks phrase them. Each renders a number that
 * belongs to no slot — the parser claiming one is a fabrication, and scoring
 * that is the whole reason these exist.
 */
export const DISTRACTORS = [
  { text: 'it has a mass of {n} kg', pick: (r) => 0.5 + Math.round(r() * 90) / 10 },
  { text: 'a class of {n} students is watching', pick: (r) => 12 + Math.floor(r() * 25) },
  { text: 'this is trial number {n} of the afternoon', pick: (r) => 2 + Math.floor(r() * 8) },
  { text: 'the air temperature is {n} degrees', pick: (r) => 5 + Math.floor(r() * 30) },
  { text: 'it cost {n} dollars', pick: (r) => 3 + Math.floor(r() * 40) },
  { text: 'the experiment is repeated {n} times', pick: (r) => 3 + Math.floor(r() * 12) },
];

/** Height clauses, for release phrasings that don't carry one themselves. */
export const HEIGHT_CLAUSE = [
  'from {n}',
  'from a height of {n}',
  'starting {n} above the ground',
  '{n} above the ground',
  'at the {n} mark',
];
