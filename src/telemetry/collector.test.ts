import { describe, expect, it, vi } from 'vitest';
import {
  buildRecord,
  collectorConfigured,
  httpSink,
  resolveConfig,
  shouldCollect,
} from './collector.ts';

const base = {
  prompt: 'dropped from 45 m',
  engine: 'rule' as const,
  variables: ['x1', 'x2', 'v0', 'a'],
  unusedNumbers: [] as number[],
  ts: 1000,
};

describe('buildRecord', () => {
  it('marks a clean parse as parsedOk', () => {
    expect(buildRecord(base).parsedOk).toBe(true);
  });

  it('marks a parse with leftover numbers as not ok', () => {
    expect(buildRecord({ ...base, unusedNumbers: [15] }).parsedOk).toBe(false);
  });

  it('marks an empty extraction as not ok', () => {
    expect(buildRecord({ ...base, variables: [] }).parsedOk).toBe(false);
  });
});

describe('shouldCollect', () => {
  const ok = buildRecord(base);
  const failed = buildRecord({ ...base, unusedNumbers: [15] });

  it('off collects nothing', () => {
    expect(shouldCollect(ok, 'off')).toBe(false);
    expect(shouldCollect(failed, 'off')).toBe(false);
  });

  it('all collects everything', () => {
    expect(shouldCollect(ok, 'all')).toBe(true);
    expect(shouldCollect(failed, 'all')).toBe(true);
  });

  it('failures collects only imperfect parses', () => {
    expect(shouldCollect(ok, 'failures')).toBe(false);
    expect(shouldCollect(failed, 'failures')).toBe(true);
  });
});

describe('resolveConfig', () => {
  it('defaults to failures and no endpoint', () => {
    const config = resolveConfig({});
    expect(config.policy).toBe('failures');
    expect(collectorConfigured(config)).toBe(false);
  });

  it('reads endpoint and policy from env', () => {
    const config = resolveConfig({
      VITE_COLLECTOR_ENDPOINT: 'https://ingest.example/prompts',
      VITE_COLLECTOR_POLICY: 'all',
    });
    expect(config.policy).toBe('all');
    expect(collectorConfigured(config)).toBe(true);
  });
});

describe('httpSink', () => {
  it('POSTs the record to the endpoint', () => {
    const fetchMock = vi.fn(
      (_url: string, _init?: RequestInit) => Promise.resolve({} as Response),
    );
    vi.stubGlobal('fetch', fetchMock);

    httpSink('https://ingest.example/prompts').send(buildRecord(base));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://ingest.example/prompts');
    expect(JSON.parse(init!.body as string).prompt).toBe('dropped from 45 m');
    vi.unstubAllGlobals();
  });

  it('swallows network errors', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    expect(() => httpSink('https://x').send(buildRecord(base))).not.toThrow();
    vi.unstubAllGlobals();
  });
});
