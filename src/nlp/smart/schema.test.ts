import { describe, expect, it } from 'vitest';
import { LENGTH, VELOCITY, dimensionsEqual } from '../../math/index.ts';
import {
  applyTextUnits,
  detectSystem,
  dropUngrounded,
  extractionToResult,
  isEmptyExtraction,
  numbersIn,
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

describe('dropUngrounded', () => {
  const wrench =
    'A wrench slips from a scaffold plank 24 m off the ground and comes to ' +
    'rest on the roof of a toolshed that stands 3 m tall.';

  it('keeps values the problem actually states', () => {
    const ex = dropUngrounded(
      { x1: 24, x2: 3, v0: 0, v: null, a: -9.81, t: null, units: 'metric' },
      wrench,
    );
    expect(ex.x1).toBe(24);
    expect(ex.x2).toBe(3);
  });

  // The observed failure: t=3.5 copied out of a few-shot example.
  it('drops a value copied from the prompt examples', () => {
    const ex = dropUngrounded(
      { x1: 24, x2: 3, v0: null, v: null, a: -9.81, t: 3.5, units: 'metric' },
      wrench,
    );
    expect(ex.t).toBeNull();
    expect(ex.x1).toBe(24); // grounded slots survive
  });

  it('allows convention constants the story never spells out', () => {
    const ex = dropUngrounded(
      { x1: 24, x2: null, v0: 0, v: null, a: -9.81, t: null, units: 'metric' },
      wrench,
    );
    expect(ex.v0).toBe(0); // "slips" ⇒ from rest
    expect(ex.a).toBe(-9.81); // gravity
  });

  it('allows imperial gravity', () => {
    const ex = dropUngrounded(
      { x1: 62, x2: 0, v0: 0, v: null, a: -32.17, t: null, units: 'imperial' },
      'A brick topples off a ledge 62 ft above the pavement',
    );
    expect(ex.a).toBe(-32.17);
    expect(ex.x1).toBe(62);
  });

  it('matches a stated magnitude regardless of sign', () => {
    const ex = dropUngrounded(
      { x1: null, x2: 0, v0: 14, v: -26, a: -9.81, t: null, units: 'metric' },
      'thrown upward at 14 m/s and hits the ground at 26 m/s',
    );
    expect(ex.v).toBe(-26);
    expect(ex.v0).toBe(14);
  });

  // The observed failure: the model filed "20 m/s" under x1 and "30 m/s"
  // under a, on a problem where both numbers are plainly velocities.
  it('drops a value whose unit in the text contradicts the slot', () => {
    const ex = dropUngrounded(
      { x1: 20, x2: 0, v0: null, v: null, a: 30, t: null, units: 'metric' },
      'it leaves her hand at 20 m/s and strikes the pavement at 30 m/s',
    );
    expect(ex.x1).toBeNull(); // 20 is a velocity, not a height
    expect(ex.a).toBeNull(); // 30 is a velocity, not an acceleration
    expect(ex.x2).toBe(0); // convention constant, still allowed
  });

  it('keeps a value whose unit matches the slot', () => {
    const ex = dropUngrounded(
      { x1: null, x2: null, v0: 20, v: -30, a: null, t: null, units: 'metric' },
      'it leaves her hand at 20 m/s and strikes the pavement at 30 m/s',
    );
    expect(ex.v0).toBe(20);
    expect(ex.v).toBe(-30);
  });

  it('accepts a bare number for any slot, having no unit to contradict', () => {
    const ex = dropUngrounded(
      { x1: null, x2: null, v0: null, v: null, a: null, t: 6, units: 'metric' },
      'braking for the next 6 seconds',
    );
    expect(ex.t).toBe(6);
  });

  it('is unfooled by decimals appearing only as substrings', () => {
    const ex = dropUngrounded(
      { x1: null, x2: null, v0: null, v: null, a: null, t: 1.2, units: 'metric' },
      'a fall lasting 12 s',
    );
    expect(ex.t).toBeNull();
  });
});

describe('detectSystem', () => {
  it('reads imperial off the story, however "feet" is spelled', () => {
    expect(detectSystem('some 40 feet above the lawn')).toBe('imperial');
    expect(detectSystem('a ledge 62 ft up')).toBe('imperial');
  });

  it('reads metric off the story', () => {
    expect(detectSystem('dropped from 45 m at 3 m/s')).toBe('metric');
  });

  it('declines to guess when the story has no units, or mixes them', () => {
    expect(detectSystem('a ball is dropped')).toBeNull();
    expect(detectSystem('from 40 ft at 3 m/s')).toBeNull();
  });
});

describe('applyTextUnits', () => {
  const acorn = 'An acorn breaks loose from a branch some 40 feet above the lawn';

  // The observed failure: the model reported metric for a problem in feet, so
  // "40 feet" was solved as 40 metres under metric gravity.
  it('overrides the model when the story is written in feet', () => {
    const ex = applyTextUnits(
      { x1: 40, x2: 0, v0: 0, v: null, a: -9.81, t: null, units: 'metric' },
      acorn,
    );
    expect(ex.units).toBe('imperial');
    // Gravity is convention-supplied, so it must be restated, not relabelled:
    // leaving −9.81 would mean −9.81 ft/s², about a third of real gravity.
    expect(ex.a).toBe(-32.17);
    expect(ex.x1).toBe(40); // read off the page; unchanged
  });

  it('leaves a stated acceleration alone', () => {
    const ex = applyTextUnits(
      { x1: 150, x2: null, v0: -4, v: null, a: 1.2, t: 6, units: 'metric' },
      'a marker 150 m up, braking at 1.2 m/s2 for 6 s',
    );
    expect(ex.a).toBe(1.2);
    expect(ex.units).toBe('metric');
  });

  it('leaves the extraction untouched when the story has no units', () => {
    const original = {
      x1: 45,
      x2: 0,
      v0: 0,
      v: null,
      a: -9.81,
      t: null,
      units: 'metric' as const,
    };
    expect(applyTextUnits(original, 'a ball is dropped')).toEqual(original);
  });
});

describe('isEmptyExtraction', () => {
  it('is true only when every slot is null', () => {
    const base = { x1: null, x2: null, v0: null, v: null, a: null, t: null };
    expect(isEmptyExtraction({ ...base, units: 'metric' })).toBe(true);
    expect(isEmptyExtraction({ ...base, x1: 5, units: 'metric' })).toBe(false);
  });
});

describe('numbersIn', () => {
  it('pulls every numeric literal, including decimals', () => {
    expect(numbersIn('150 m at 4 m/s for 1.2 s')).toEqual([150, 4, 1.2]);
  });

  it('is empty for text with no numbers', () => {
    expect(numbersIn('a ball is dropped')).toEqual([]);
  });
});

describe('schemaString', () => {
  it('is valid JSON describing all six variables', () => {
    const schema = JSON.parse(schemaString());
    expect(schema.required).toContain('x1');
    expect(schema.required).toContain('units');
  });
});
