/**
 * Splitting a story into motion segments.
 *
 * `engine/phases.ts` can solve a sequence of segments; this works out what the
 * sequence is. The shape it recognizes is the one textbooks lean on — an object
 * descending through a chain of named heights, pausing or rebounding at each:
 *
 *     "dropped off a roof at 150 m, then falls on another roof that's 30 m
 *      high, then rolls off and falls to the ground"
 *
 *     150 ──(phase 1)── 30 ──(phase 2)── 0
 *                        └─ "rolls off" ⇒ the ball departs from rest
 *
 * Positions in order of mention form a chain, consecutive pairs become phases,
 * and the words *between* two positions say what happened at the boundary.
 *
 * **Segmentation is opt-in on evidence.** Without a staging cue ("then",
 * "next", "after that") the story is treated as one segment exactly as before,
 * so nothing that works today changes. Where the evidence is there but the
 * chain is too short or ambiguous to trust, this returns null rather than
 * guessing — a wrong split silently answers a different problem, which is worse
 * than not splitting at all.
 */
import { LENGTH, type Quantity, dimensionsEqual, fromUnit, quantity } from '../math/index.ts';
import type { LinkKind, PhaseLink } from '../engine/index.ts';
import { GROUND_SURFACES, UNITS } from './grammar.ts';
import { defaultTokenizer } from './tokenizer.ts';
import type { Token } from './types.ts';

/** Words marking one stage of motion ending and the next beginning. */
const STAGING_CUES: ReadonlyArray<string[]> = [
  ['then'],
  ['next'],
  ['after', 'that'],
  ['afterwards'],
  ['afterward'],
  ['subsequently'],
  ['finally'],
];

/** Boundary phrases and the velocity link each implies. */
const LINK_CUES: ReadonlyArray<readonly [string[], LinkKind]> = [
  [['rolls', 'off'], 'rest'],
  [['rolled', 'off'], 'rest'],
  [['comes', 'to', 'rest'], 'rest'],
  [['came', 'to', 'rest'], 'rest'],
  [['lands', 'on'], 'rest'],
  [['landing'], 'rest'],
  [['settles'], 'rest'],
  [['stops'], 'rest'],
  [['falls', 'on'], 'rest'],
  [['bounces'], 'reversed'],
  [['bounced'], 'reversed'],
  [['rebounds'], 'reversed'],
  [['passes'], 'continuous'],
  [['continues'], 'continuous'],
  [['keeps'], 'continuous'],
];

/** A height the story names, and where it was said. */
interface PositionMention {
  readonly height: Quantity;
  readonly at: number;
}

function phraseAt(tokens: Token[], at: number, words: readonly string[]): boolean {
  return words.every((word, j) => {
    const token = tokens[at + j];
    return token?.kind === 'word' && token.text === word;
  });
}

function hasStagingCue(tokens: Token[]): boolean {
  return tokens.some((_, i) => STAGING_CUES.some((cue) => phraseAt(tokens, i, cue)));
}

/**
 * True when the story signposts more than one stage of motion.
 *
 * Independent of whether `segmentPhases` could act on it. A story that stages
 * itself but yields no usable chain is exactly the case worth warning about:
 * the single-segment path will answer it, confidently and probably wrongly.
 */
export function describesStages(text: string): boolean {
  return hasStagingCue(defaultTokenizer.tokenize(text));
}

/**
 * Heights in order of mention: every length-carrying number, plus ground level
 * wherever a ground-level surface is named.
 */
function positionsIn(tokens: Token[]): PositionMention[] {
  const mentions: PositionMention[] = [];
  tokens.forEach((token, i) => {
    if (token.kind === 'number' && token.value !== undefined) {
      const next = tokens[i + 1];
      const unit = next?.kind === 'word' ? UNITS[next.text] : undefined;
      if (unit && dimensionsEqual(unit.dimension, LENGTH)) {
        mentions.push({ height: fromUnit(token.value, unit), at: i });
      }
      return;
    }
    if (token.kind === 'word' && GROUND_SURFACES.includes(token.text)) {
      mentions.push({ height: quantity(0, LENGTH), at: i });
    }
  });
  return mentions;
}

/** Collapse runs of the same height — "to the ground ... hits the ground". */
function dedupeAdjacent(mentions: PositionMention[]): PositionMention[] {
  return mentions.filter(
    (m, i) => i === 0 || Math.abs(m.height.value - mentions[i - 1]!.height.value) > 1e-9,
  );
}

/** The link implied by the words between two positions; `rest` if unstated. */
function linkBetween(tokens: Token[], from: number, to: number): PhaseLink {
  for (let i = from; i <= Math.min(to, tokens.length - 1); i++) {
    for (const [phrase, kind] of LINK_CUES) {
      if (phraseAt(tokens, i, phrase)) return { kind };
    }
  }
  // An object that arrives somewhere and is described as leaving again has
  // stopped there unless the story says otherwise; a chain of heights only
  // exists because something interrupted the fall.
  return { kind: 'rest' };
}

export interface SegmentedPhase {
  readonly x1: Quantity;
  readonly x2: Quantity;
}

export interface Segmentation {
  readonly phases: SegmentedPhase[];
  /** One fewer than `phases`; `links[i]` joins phase i to phase i + 1. */
  readonly links: PhaseLink[];
}

/**
 * Split a story into motion segments, or null when it is a single segment.
 *
 * Null is the common and safe answer: it means "solve this the way you always
 * have". A segmentation is only returned when the story stages itself *and*
 * names enough distinct heights to chain.
 */
export function segmentPhases(text: string): Segmentation | null {
  const tokens = defaultTokenizer.tokenize(text);
  if (!hasStagingCue(tokens)) return null;

  const positions = dedupeAdjacent(positionsIn(tokens));
  // Two positions are one fall — the ordinary case, already handled.
  if (positions.length < 3) return null;

  const phases: SegmentedPhase[] = [];
  const links: PhaseLink[] = [];
  for (let i = 0; i < positions.length - 1; i++) {
    phases.push({ x1: positions[i]!.height, x2: positions[i + 1]!.height });
    if (i > 0) {
      links.push(linkBetween(tokens, positions[i]!.at, positions[i + 1]!.at));
    }
  }
  return { phases, links };
}
