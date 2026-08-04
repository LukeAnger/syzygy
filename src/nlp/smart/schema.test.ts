import { describe, expect, it } from 'vitest';
import { LENGTH, VELOCITY, dimensionsEqual } from '../../math/index.ts';
import {
  extractionToResult,
  parseExtraction,
  schemaString,
} from './schema.ts';

describe('parseExtraction', () => {
  it('parses a well-formed model response', () => {
    const ex = parseExtraction(
      '{"x1":100,"x2":4,"v0":0,"v":null,"a":-9.81,"t":null,"units":"metric"}',
      'metric',
    )!;
    expect(ex.x1).toBe(100);
    expect(ex.x2).toBe(4);
    expect(ex.v0).toBe(0);
    expect(ex.v).toBeNull();
    expect(ex.units).toBe('metric');
  });

  it('coerces numeric strings and rejects junk', () => {
    const ex = parseExtraction(
      '{"x1":"45","x2":null,"v0":"nope","v":null,"a":null,"t":null,"units":"x"}',
      'metric',
    )!;
    expect(ex.x1).toBe(45);
    expect(ex.v0).toBeNull();
    expect(ex.units).toBe('metric'); // invalid units → fallback
  });

  it('returns null on invalid JSON', () => {
    expect(parseExtraction('not json', 'metric')).toBeNull();
    expect(parseExtraction('[1,2,3]', 'metric')).toBeNull();
  });
});

describe('extractionToResult', () => {
  it('maps the obstacle case into position assignments', () => {
    const result = extractionToResult(
      { x1: 100, x2: 4, v0: 0, v: null, a: -9.81, t: null, units: 'metric' },
      'dropped onto a 4 m truck',
    );
    const byVar = Object.fromEntries(
      result.assignments.map((a) => [a.variable, a.quantity]),
    );
    expect(byVar['x1']!.value).toBe(100);
    expect(byVar['x2']!.value).toBe(4);
    expect(byVar['v0']!.value).toBe(0);
    expect(dimensionsEqual(byVar['x1']!.dimension, LENGTH)).toBe(true);
    expect(dimensionsEqual(byVar['v0']!.dimension, VELOCITY)).toBe(true);
    expect(result.assignments).toHaveLength(4); // x1, x2, v0, a (v & t null)
  });

  it('converts imperial values through the math core', () => {
    const result = extractionToResult(
      { x1: 10, x2: null, v0: null, v: null, a: null, t: null, units: 'imperial' },
      'from 10 ft',
    );
    expect(result.assignments[0]!.quantity.value).toBeCloseTo(3.048, 3);
  });
});

describe('schemaString', () => {
  it('is valid JSON describing all six variables', () => {
    const schema = JSON.parse(schemaString());
    expect(schema.required).toContain('x1');
    expect(schema.required).toContain('units');
  });
});
