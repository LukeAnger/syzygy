/**
 * Every equation pack the app can solve with, keyed by id.
 *
 * A registry rather than direct imports, so the store and UI can work with
 * whichever domain is active instead of naming one. Adding a domain means
 * adding a pack and an entry here — the engine, the solver and the tutor all
 * read `Domain` and need no change.
 */
import type { Domain } from '../engine/index.ts';
import { kinematics1D } from './kinematics-1d/index.ts';
import { relativeVelocity } from './relative-velocity/index.ts';

export type DomainId = 'kinematics-1d' | 'relative-velocity';

export const DOMAINS: Record<DomainId, Domain> = {
  'kinematics-1d': kinematics1D,
  'relative-velocity': relativeVelocity,
};

export const DOMAIN_IDS = Object.keys(DOMAINS) as DomainId[];

export function domainOf(id: DomainId): Domain {
  return DOMAINS[id];
}

/**
 * Variables a user can type in — everything the domain declares except its
 * results.
 */
export function inputKeysOf(id: DomainId): string[] {
  return DOMAINS[id].variables.filter((v) => !v.derived).map((v) => v.key);
}

/** Every variable, results included, in the order the domain declares them. */
export function summaryKeysOf(id: DomainId): string[] {
  return DOMAINS[id].variables.map((v) => v.key);
}

/**
 * Find a variable by key across all domains.
 *
 * Keys are near-disjoint — only `t` is shared, and both domains define it
 * identically — so formatting and symbol lookup need not know which domain is
 * active. The guard below keeps that assumption honest if a future pack
 * redefines a key with a different dimension.
 */
export function findVariable(key: string) {
  const matches = DOMAIN_IDS.map((id) => DOMAINS[id].variables.find((v) => v.key === key)).filter(
    (v): v is NonNullable<typeof v> => v !== undefined,
  );
  const first = matches[0];
  if (!first) throw new Error(`unknown variable ${key}`);
  for (const other of matches.slice(1)) {
    if (other.dimension.join() !== first.dimension.join()) {
      throw new Error(`variable ${key} means different things in different domains`);
    }
  }
  return first;
}
