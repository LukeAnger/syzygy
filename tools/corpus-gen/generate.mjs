#!/usr/bin/env node
/**
 * Synthetic corpus generator — an authoring tool, not part of the app.
 *
 * Nothing under `src/` imports this. It emits a JSON artifact that the test
 * suite reads, so the dependency runs one way: tool → data → tests. That keeps
 * the generator free to change without touching the shipped bundle, and keeps
 * the app free of a build-time dependency on a dev tool.
 *
 * **Labels are correct by construction.** Values are chosen first and the prose
 * is rendered to describe them, so nobody has to solve a thousand problems by
 * hand. What needs human review is the phrasing bank — a few dozen strings —
 * not the instances. See `phrasings.mjs` for why that bank must never be
 * sourced from the grammar it is meant to test.
 *
 * Derived quantities are computed with real kinematics, then rounded, and the
 * rounded value is what both the prose and the label carry — so a problem is
 * internally consistent and solvable the way a textbook's would be.
 *
 * Usage:
 *   node tools/corpus-gen/generate.mjs [--count 1000] [--seed 1] [--out path]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  DISTRACTORS,
  HEIGHT_CLAUSE,
  LAND_GROUND,
  LAND_RAISED,
  OBJECTS,
  PLATFORMS,
  QUESTIONS,
  RELEASE_AT_REST,
  RELEASE_DOWNWARD,
  RELEASE_UPWARD,
  SPEED_STATED,
  SURFACES,
  TIME_ONGOING,
  TIME_STATED,
} from './phrasings.mjs';

/** Deterministic PRNG — same seed, same corpus, so scores are comparable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UNITS = {
  metric: { length: 'm', velocity: 'm/s', accel: 'm/s2', g: -9.81 },
  imperial: { length: 'ft', velocity: 'ft/s', accel: 'ft/s2', g: -32.17 },
};

const round1 = (x) => Math.round(x * 10) / 10;

function parseArgs(argv) {
  const args = { count: 1000, seed: 1, out: 'corpus/synthetic.json' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const value = argv[i + 1];
    if (key === 'count' || key === 'seed') args[key] = Number(value);
    else if (key === 'out') args.out = value;
  }
  return args;
}

/**
 * Build one problem.
 *
 * Returns null when the chosen combination is not physically realisable (an
 * upward throw whose numbers put the object below its landing point, say).
 * Discarding is cheaper and safer than clamping, which would quietly produce
 * prose that contradicts its own labels.
 */
function buildCase(rng, index) {
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const system = rng() < 0.25 ? 'imperial' : 'metric';
  const u = UNITS[system];
  const a = u.g;

  const object = pick(OBJECTS);
  const surface = pick(SURFACES);
  const platform = pick(PLATFORMS);
  // A different noun for what it lands on, so a story doesn't roll off a kiosk
  // onto a kiosk.
  const landingPlatform = pick(PLATFORMS.filter((p) => p !== platform));

  const release = pick(['rest', 'rest', 'rest', 'up', 'down']);
  const landing = pick(['ground', 'ground', 'raised', 'unstated']);

  // Chosen, not derived: whole-ish numbers the way problems state them.
  const startHeight = 10 + Math.floor(rng() * 30) * 5;
  const raisedHeight = 2 + Math.floor(rng() * 8);
  const throwSpeed = 5 + Math.floor(rng() * 20);

  const expected = {};
  const absent = [];
  let x1 = null;
  let x2 = null;
  let v0 = 0;

  if (release === 'up') {
    // Ground-to-ground toss. x1 is left unlabelled: "tossed upward" doesn't
    // actually state a starting height, and scoring a guess would penalise a
    // correct reading.
    v0 = throwSpeed;
    x2 = 0;
  } else if (release === 'down') {
    v0 = -throwSpeed;
    x1 = startHeight;
  } else {
    v0 = 0;
    x1 = startHeight;
  }

  if (landing === 'raised' && x1 !== null && raisedHeight < x1) x2 = raisedHeight;
  else if (landing === 'unstated' && release !== 'up') x2 = null;
  else if (x2 === null) x2 = 0;

  // Derive the rest with real kinematics.
  let t = null;
  let v = null;
  if (x2 !== null && x1 !== null) {
    const dx = x2 - x1;
    const disc = v0 * v0 + 2 * a * dx;
    if (disc < 0) return null;
    v = -Math.sqrt(disc);
    t = (v - v0) / a;
  } else if (release === 'up') {
    // Returns to the height it left, so the flight time is symmetric.
    t = (-2 * v0) / a;
    v = -v0;
  } else {
    // Nothing says where it ends; the duration defines the motion instead.
    // Cap it short of the ground, or the prose would describe an object that
    // has already landed while the labels insist it hasn't.
    const toGround = (-v0 - Math.sqrt(v0 * v0 + 2 * -a * x1)) / a;
    const limit = Number.isFinite(toGround) && toGround > 0.4 ? toGround * 0.8 : 1;
    t = round1(Math.max(0.3, rng() * limit));
    v = v0 + a * t;
  }
  if (!Number.isFinite(t) || t <= 0) return null;

  t = round1(t);
  v = round1(v);

  // ---- prose ----
  const num = (value, unit) => `${value} ${unit}`;
  const fill = (tpl, subs) =>
    tpl.replace(/\{(\w+)\}/g, (_, k) => (k in subs ? subs[k] : `{${k}}`));

  const subs = {
    obj: object,
    surf: surface,
    plat: platform,
    n: num(x1 ?? startHeight, u.length),
    v: num(Math.abs(v0) || throwSpeed, u.velocity),
    t: num(t, 's'),
  };

  const bank =
    release === 'up' ? RELEASE_UPWARD : release === 'down' ? RELEASE_DOWNWARD : RELEASE_AT_REST;
  const releaseTpl = pick(bank);
  const usedTemplates = { release: releaseTpl };
  const clauses = [fill(releaseTpl, subs)];

  // Add a height clause only when the release phrasing didn't carry one.
  if (x1 !== null && !releaseTpl.includes('{n}')) {
    const heightTpl = pick(HEIGHT_CLAUSE);
    usedTemplates.height = heightTpl;
    clauses.push(fill(heightTpl, subs));
  }

  if (landing === 'raised' && x2) {
    const landTpl = pick(LAND_RAISED);
    usedTemplates.landing = landTpl;
    clauses.push(fill(landTpl, { ...subs, plat: landingPlatform, n: num(x2, u.length) }));
  } else if (x2 === 0) {
    const landTpl = pick(LAND_GROUND);
    usedTemplates.landing = landTpl;
    clauses.push(fill(landTpl, subs));
  }

  // At most one derived quantity is stated, so rounding can't make the problem
  // contradict itself.
  const extra = x2 === null ? 'time' : pick(['none', 'none', 'time', 'speed']);
  if (extra === 'time') {
    const timeTpl = pick(x2 === null ? TIME_ONGOING : TIME_STATED);
    usedTemplates.time = timeTpl;
    clauses.push(fill(timeTpl, subs));
    expected.t = [t, 's'];
  } else if (extra === 'speed') {
    const speedTpl = pick(SPEED_STATED);
    usedTemplates.speed = speedTpl;
    clauses.push(fill(speedTpl, { ...subs, v: num(Math.abs(v), u.velocity) }));
    expected.v = [v, u.velocity];
  }

  // A distractor that happens to equal a real quantity is not a distractor —
  // nothing could distinguish the parser adopting it from correctly reading the
  // value it collides with. Reject those rather than emit an unmeasurable case.
  const taken = new Set(
    [x1, x2, v0, v, t, a].filter((n) => n !== null).map((n) => Math.abs(n)),
  );
  const distractors = [];
  let aside = '';
  if (rng() < 0.35) {
    const d = pick(DISTRACTORS);
    let value = null;
    for (let tries = 0; tries < 12 && value === null; tries++) {
      const candidate = round1(d.pick(rng));
      if (!taken.has(Math.abs(candidate))) value = candidate;
    }
    if (value === null) return null;
    distractors.push(value);
    // Its own sentence: a distractor buried in a comma splice reads as part of
    // the setup, and the point is that it is beside the point.
    const text = fill(d.text, { ...subs, n: String(value) });
    aside = ` ${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
  }

  // ---- labels ----
  if (x1 !== null) expected.x1 = [x1, u.length];
  if (x2 !== null) expected.x2 = [x2, u.length];
  else absent.push('x2');
  expected.v0 = [v0, u.velocity];
  expected.a = [a, u.accel];

  const asked = pick(['v', 'v', 't', 'dx', 'none']);
  const question = asked === 'none' ? '' : ` ${pick(QUESTIONS[asked])}`;

  const body =
    clauses.length > 1
      ? `${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`
      : clauses[0];
  const text = `${body.charAt(0).toUpperCase()}${body.slice(1)}.${aside}${question}`;

  return {
    id: `syn-${String(index).padStart(5, '0')}`,
    text,
    expected,
    absent,
    distractors,
    asked: asked === 'none' ? null : asked,
    tags: { system, release, landing, extra, hasDistractor: distractors.length > 0 },
    templates: usedTemplates,
  };
}

const { count, seed, out } = parseArgs(process.argv.slice(2));
const rng = mulberry32(seed);
const cases = [];
let attempts = 0;
while (cases.length < count && attempts < count * 20) {
  attempts++;
  const built = buildCase(rng, cases.length + 1);
  if (built) cases.push(built);
}

const target = resolve(process.cwd(), out);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(
  target,
  `${JSON.stringify({ seed, count: cases.length, cases }, null, 2)}\n`,
);
console.log(`wrote ${cases.length} cases to ${out} (seed ${seed}, ${attempts} attempts)`);
