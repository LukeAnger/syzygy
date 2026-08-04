/**
 * Prompt collection — the data flywheel that improves the FREE rule parser.
 *
 * Storymode submissions (especially ones the rule parser couldn't fully place)
 * are the highest-signal data for writing new grammar rules. This module builds
 * an anonymized record and hands it to a pluggable sink. A batch job downstream
 * (out of this static app's scope) reads them from storage and proposes new
 * rules.
 *
 * Privacy: this is outward data flow, so it is OFF unless BOTH an endpoint is
 * configured (build-time) AND the user has explicitly consented (runtime). No
 * identifiers are attached — only the problem text and how it parsed.
 */
const APP_VERSION = '2.0.0';

export type ParseEngine = 'rule' | 'smart';
export type CollectionPolicy = 'all' | 'failures' | 'off';

export interface PromptRecord {
  prompt: string;
  engine: ParseEngine;
  /** Which variables were extracted. */
  variables: string[];
  /** Numbers the parser saw but could not place (empty = clean parse). */
  unusedNumbers: number[];
  /** True when nothing was left unplaced and at least one value was found. */
  parsedOk: boolean;
  version: string;
  ts: number;
}

export interface CollectorSink {
  send(record: PromptRecord): void;
}

export const noopSink: CollectorSink = { send() {} };

/** POST records to an ingest endpoint (their S3-backed collector). */
export function httpSink(endpoint: string): CollectorSink {
  return {
    send(record) {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(record),
        keepalive: true,
      }).catch(() => {
        /* fire-and-forget: never let telemetry break the app */
      });
    },
  };
}

export function buildRecord(input: {
  prompt: string;
  engine: ParseEngine;
  variables: string[];
  unusedNumbers: number[];
  ts: number;
}): PromptRecord {
  const parsedOk = input.unusedNumbers.length === 0 && input.variables.length > 0;
  return { ...input, parsedOk, version: APP_VERSION };
}

/** Whether a record should be sent under the given collection policy. */
export function shouldCollect(
  record: PromptRecord,
  policy: CollectionPolicy,
): boolean {
  if (policy === 'off') return false;
  if (policy === 'all') return true;
  return !record.parsedOk; // 'failures'
}

/** Config resolved from build-time env; collection is disabled unless set. */
export interface CollectorConfig {
  endpoint?: string;
  policy: CollectionPolicy;
}

export function resolveConfig(env: {
  VITE_COLLECTOR_ENDPOINT?: string;
  VITE_COLLECTOR_POLICY?: string;
}): CollectorConfig {
  const policy: CollectionPolicy =
    env.VITE_COLLECTOR_POLICY === 'all'
      ? 'all'
      : env.VITE_COLLECTOR_POLICY === 'off'
        ? 'off'
        : 'failures';
  return { endpoint: env.VITE_COLLECTOR_ENDPOINT, policy };
}

/** True only when an endpoint is configured — gates the consent UI. */
export function collectorConfigured(config: CollectorConfig): boolean {
  return typeof config.endpoint === 'string' && config.endpoint.length > 0;
}
