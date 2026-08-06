#!/usr/bin/env node
/**
 * Distils the generated corpus into the example bank the model retrieves from.
 *
 * Authoring tool, same as its sibling: nothing under `src/` imports this. It
 * writes `src/nlp/smart/examples.json`, which the app *does* ship — but only in
 * the lazy smart-parse chunk, never the base bundle.
 *
 * Deduplicated by the combination of templates that produced each case, not
 * sampled at random. A bank of near-duplicates wastes the few example slots a
 * prompt has; one case per distinct phrasing combination covers the space at a
 * fraction of the size.
 *
 * Usage:
 *   node tools/corpus-gen/build-examples.mjs [--in path] [--out path]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = { in: 'corpus/synthetic.json', out: 'src/nlp/smart/examples.json' };
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]?.replace(/^--/, '');
  if (key === 'in' || key === 'out') args[key] = process.argv[i + 1];
}

const SLOTS = ['x1', 'x2', 'v0', 'v', 'a', 't'];

const { cases } = JSON.parse(readFileSync(resolve(process.cwd(), args.in), 'utf8'));

const seen = new Set();
const examples = [];
for (const c of cases) {
  // One per distinct phrasing combination — that is what makes the bank cover
  // the space rather than repeat the common shapes.
  const key = JSON.stringify(c.templates ?? {});
  if (seen.has(key)) continue;
  seen.add(key);

  // Flattened into exactly the shape the model must emit, so a retrieved
  // example doubles as a format demonstration.
  const extraction = { units: c.tags.system };
  for (const slot of SLOTS) extraction[slot] = c.expected[slot]?.[0] ?? null;

  examples.push({
    text: c.text,
    extraction: {
      x1: extraction.x1,
      x2: extraction.x2,
      v0: extraction.v0,
      v: extraction.v,
      a: extraction.a,
      t: extraction.t,
      units: extraction.units,
    },
  });
}

const target = resolve(process.cwd(), args.out);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(examples)}\n`);

const bytes = Buffer.byteLength(JSON.stringify(examples));
console.log(
  `wrote ${examples.length} examples to ${args.out} ` +
    `(${(bytes / 1024).toFixed(0)} KB raw, from ${cases.length} cases)`,
);
