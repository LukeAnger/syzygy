/**
 * The units a problem was written in, so answers come back the same way.
 *
 * The unit *system* already decides metric or imperial, but that is not fine
 * enough: km/h and m/s are both metric, and a student who writes 120 km/h and
 * reads back 33.3 m/s has been handed a correct answer to a question they did
 * not ask. The SI value never changes — only how it is rendered.
 *
 * Only reports units the text actually used; anything unmentioned keeps the
 * system default. A story mixing two velocity units returns neither, since
 * picking one would silently misreport the other.
 */
import {
  FOOT,
  FOOT_PER_SECOND,
  KILOMETRE,
  KILOMETRE_PER_HOUR,
  METRE,
  METRE_PER_SECOND,
  MILE,
  MILE_PER_HOUR,
  type Unit,
  type UnitKit,
} from '../math/index.ts';
import { defaultTokenizer } from './tokenizer.ts';

/** Unit tokens the tokenizer emits, and which kit slot each would fill. */
const VELOCITY_TOKENS: Record<string, Unit> = {
  'm/s': METRE_PER_SECOND,
  'ft/s': FOOT_PER_SECOND,
  'km/h': KILOMETRE_PER_HOUR,
  mph: MILE_PER_HOUR,
};

const LENGTH_TOKENS: Record<string, Unit> = {
  m: METRE,
  ft: FOOT,
  km: KILOMETRE,
  mi: MILE,
};

/** The single unit used for a slot, or undefined if none or several. */
function sole(words: Set<string>, table: Record<string, Unit>): Unit | undefined {
  const found = Object.entries(table)
    .filter(([token]) => words.has(token))
    .map(([, unit]) => unit);
  return found.length === 1 ? found[0] : undefined;
}

export function detectDisplayUnits(text: string): Partial<UnitKit> {
  const words = new Set(
    defaultTokenizer
      .tokenize(text)
      .filter((token) => token.kind === 'word')
      .map((token) => token.text),
  );
  const overrides: Partial<UnitKit> = {};
  const velocity = sole(words, VELOCITY_TOKENS);
  const length = sole(words, LENGTH_TOKENS);
  if (velocity) overrides.velocity = velocity;
  if (length) overrides.length = length;
  return overrides;
}
