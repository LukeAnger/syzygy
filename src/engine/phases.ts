/**
 * Motion in more than one segment.
 *
 * A single `solve` handles one stretch of constant acceleration. Most problems
 * past the opening chapter are not that: *"drops off a roof at 150 m onto
 * another roof 30 m high, then rolls off and falls to the ground"* is two
 * falls with the ball at rest between them, and the answer depends only on the
 * second. Model it as one segment and you get a confident wrong number.
 *
 * A phase sequence is that story as a list of segments, each with its own full
 * variable set, joined by links describing what carries across the boundary.
 * Position always carries — one segment ends where the next begins. Velocity
 * depends on what happened there, which is what `LinkKind` names.
 *
 * `solve` itself is untouched. This is the same constraint propagation one
 * level up: solve each segment, push whatever that revealed across the links,
 * repeat until nothing new appears. A single-segment sequence behaves exactly
 * as a bare `solve` did, so this generalizes the old model rather than
 * replacing it.
 */
import {
  type Quantity,
  dimensionsEqual,
  multiply,
  negate,
  quantity,
  scalar,
} from '../math/index.ts';
import { solve } from './solver.ts';
import type { Domain, Knowns, SolveResult, VariableKey } from './types.ts';

/** What happens to velocity at a boundary between two segments. */
export type LinkKind =
  /** Nothing interrupts it — the object passes a marker and keeps going. */
  | 'continuous'
  /** It stops: lands, settles, and later departs from rest. */
  | 'rest'
  /** It rebounds, scaled by `restitution` and reversed in sign. */
  | 'reversed';

export interface PhaseLink {
  readonly kind: LinkKind;
  /** Coefficient of restitution for `reversed`; defaults to 1 (elastic). */
  readonly restitution?: number;
}

export interface Phase {
  /** What the story states about this segment. */
  readonly knowns: Knowns;
  /** Short description for the solution view, e.g. "roof to roof". */
  readonly label?: string;
}

/** Which quantity fails to line up across a boundary. */
export type LinkChannel = 'position' | 'velocity';

/**
 * A boundary whose two sides were separately stated and disagree.
 *
 * Reported once per boundary and channel, not once per variable: a segment
 * ending at 30 m against a next segment starting at 25 m is a single fact, and
 * would otherwise surface twice — once propagating forwards and once back.
 */
export interface PhaseConflict {
  /** Index of the link whose two sides disagree. */
  readonly link: number;
  readonly channel: LinkChannel;
  /** What the earlier segment implies. */
  readonly implied: Quantity;
  /** What the later segment states. */
  readonly stated: Quantity;
}

/** A value that reached a segment across a boundary rather than from the story. */
export interface Inherited {
  /** Segment the value came from. */
  readonly phase: number;
  readonly channel: LinkChannel;
}

export interface PhaseSolveResult {
  /** One solve per segment, in order. */
  readonly phases: SolveResult[];
  /**
   * Boundaries whose two sides were separately stated and disagree. The
   * sequence is still solved — reporting the contradiction is more useful than
   * silently preferring one side.
   */
  readonly conflicts: PhaseConflict[];
  /**
   * Per segment, which of its knowns arrived across a link and from where.
   *
   * This is what makes "did the earlier motion matter?" answerable rather than
   * assumed. A value the story stated outright creates no dependency on what
   * came before it, so the chain of reasoning stops there.
   *
   * Note what is deliberately *not* recorded: the zero velocity a `rest` link
   * injects. It is supplied by the boundary itself, not carried from the
   * previous segment — which is precisely why coming to rest severs the
   * dependency on everything before it.
   */
  readonly inherited: Array<Record<VariableKey, Inherited>>;
}

/** Values agree when they match to within floating-point noise. */
function agrees(a: Quantity, b: Quantity): boolean {
  return (
    dimensionsEqual(a.dimension, b.dimension) &&
    Math.abs(a.value - b.value) <= 1e-9 * Math.max(1, Math.abs(b.value))
  );
}

/** Departing velocity of the next segment, given the arriving one. */
function carryForward(v: Quantity, link: PhaseLink): Quantity | null {
  switch (link.kind) {
    case 'continuous':
      return v;
    case 'reversed':
      return multiply(negate(v), scalar(link.restitution ?? 1));
    case 'rest':
      // Independent of what arrived, so it needs no arriving value at all —
      // supplied by `restingStart` before any solving happens.
      return null;
  }
}

/** Arriving velocity of this segment, inferred from the next one's departure. */
function carryBackward(v0: Quantity, link: PhaseLink): Quantity | null {
  switch (link.kind) {
    case 'continuous':
      return v0;
    case 'reversed': {
      const e = link.restitution ?? 1;
      return e === 0 ? null : negate(multiply(v0, scalar(1 / e)));
    }
    case 'rest':
      // Everything arrives at rest; the departure says nothing about it.
      return null;
  }
}

/** Add `value` under `key` if absent; report a conflict if it disagrees. */
function offer(
  knowns: Record<VariableKey, Quantity>,
  key: VariableKey,
  value: Quantity,
  link: number,
  channel: LinkChannel,
  conflicts: PhaseConflict[],
): boolean {
  const existing = knowns[key];
  if (existing === undefined) {
    knowns[key] = value;
    return true;
  }
  if (!agrees(value, existing)) {
    const already = conflicts.some((c) => c.link === link && c.channel === channel);
    if (!already) conflicts.push({ link, channel, implied: value, stated: existing });
  }
  return false;
}

/**
 * Solve a sequence of motion segments.
 *
 * `links[i]` joins `phases[i]` to `phases[i + 1]`, so there is one fewer link
 * than phase. Propagation runs in both directions: a known landing height fixes
 * the next segment's start, and a known start fixes the previous segment's end,
 * which is what lets a problem stating only its final conditions be worked
 * backwards.
 */
export function solvePhases(
  domain: Domain,
  phases: readonly Phase[],
  links: readonly PhaseLink[] = [],
): PhaseSolveResult {
  if (links.length !== Math.max(0, phases.length - 1)) {
    throw new Error(
      `expected ${Math.max(0, phases.length - 1)} links for ${phases.length} phases, got ${links.length}`,
    );
  }

  const working = phases.map((phase) => ({ ...phase.knowns }) as Record<VariableKey, Quantity>);
  const conflicts: PhaseConflict[] = [];
  const inherited: Array<Record<VariableKey, Inherited>> = phases.map(() => ({}));

  /** Offer a value and, if it lands, record that it crossed a boundary. */
  const carry = (
    into: number,
    key: VariableKey,
    value: Quantity,
    link: number,
    channel: LinkChannel,
    from: number,
  ): boolean => {
    const added = offer(working[into]!, key, value, link, channel, conflicts);
    if (added) inherited[into]![key] = { phase: from, channel };
    return added;
  };

  // A segment entered at rest starts at rest whatever preceded it.
  links.forEach((link, i) => {
    if (link.kind === 'rest') {
      offer(
        working[i + 1]!,
        'v0',
        quantity(0, domainVelocity(domain)),
        i,
        'velocity',
        conflicts,
      );
    }
  });

  let results = working.map((knowns) => solve(domain, knowns));

  // Alternate solving and propagating until a full pass reveals nothing new.
  // Each pass can only add knowns, so this terminates.
  for (;;) {
    let added = false;

    links.forEach((link, i) => {
      const before = results[i]!.knowns;
      const after = results[i + 1]!.knowns;

      // Position always carries: one segment ends where the next begins.
      if (before['x2'])
        added = carry(i + 1, 'x1', before['x2'], i, 'position', i) || added;
      if (after['x1'])
        added = carry(i, 'x2', after['x1'], i, 'position', i + 1) || added;

      // Velocity carries according to what happened at the boundary. A `rest`
      // link yields nothing here — that is the severance.
      const forward = before['v'] ? carryForward(before['v'], link) : null;
      if (forward) added = carry(i + 1, 'v0', forward, i, 'velocity', i) || added;

      const backward = after['v0'] ? carryBackward(after['v0'], link) : null;
      if (backward) added = carry(i, 'v', backward, i, 'velocity', i + 1) || added;
    });

    if (!added) break;
    results = working.map((knowns) => solve(domain, knowns));
  }

  return { phases: results, conflicts, inherited };
}

/** The velocity dimension, taken from the domain rather than assumed. */
function domainVelocity(domain: Domain) {
  const v0 = domain.variables.find((variable) => variable.key === 'v0');
  if (!v0) throw new Error('domain has no v0 variable to take a rest value from');
  return v0.dimension;
}
