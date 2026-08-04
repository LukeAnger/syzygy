#!/usr/bin/env node
/**
 * Test-approval standard for the computational core.
 *
 * Every runtime module under `src/math/`, `src/engine/`, and `src/domains/`
 * must ship with a colocated `*.test.ts` file. This is a structural gate that
 * complements the coverage thresholds: coverage proves existing code is
 * exercised, this proves new modules arrive *with* tests rather than being
 * backfilled later.
 *
 * Excluded: test files themselves, barrels (`index.ts`), type-only modules
 * (`types.ts`), and declaration files (`*.d.ts`), none of which carry testable
 * runtime logic.
 *
 * Exits non-zero (failing CI) and lists any module missing its test.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARDED_DIRS = ['src/math', 'src/engine', 'src/domains', 'src/nlp'];

/** Recursively collect every file under `dir`. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function isGuardedModule(file) {
  if (!file.endsWith('.ts')) return false;
  if (file.endsWith('.test.ts')) return false;
  if (file.endsWith('.d.ts')) return false;
  if (basename(file) === 'index.ts') return false;
  if (basename(file) === 'types.ts') return false;
  return true;
}

const missing = [];
let checked = 0;

for (const rel of GUARDED_DIRS) {
  const abs = join(ROOT, rel);
  for (const file of walk(abs)) {
    if (!isGuardedModule(file)) continue;
    checked += 1;
    const testFile = join(dirname(file), `${basename(file, '.ts')}.test.ts`);
    if (!existsSync(testFile)) {
      missing.push(file.slice(ROOT.length + 1));
    }
  }
}

if (missing.length > 0) {
  console.error(
    `\n✗ Test-approval standard failed: ${missing.length} module(s) under ` +
      `${GUARDED_DIRS.join(', ')} have no colocated *.test.ts:\n`,
  );
  for (const file of missing) {
    console.error(`  - ${file}  (expected ${file.replace(/\.ts$/, '.test.ts')})`);
  }
  console.error(
    '\nEvery math/domain module must arrive with tests. Add the test file ' +
      'above, or exclude the module if it is a barrel/type-only file.\n',
  );
  process.exit(1);
}

console.log(
  `✓ Test-approval standard passed: ${checked} module(s) under ` +
    `${GUARDED_DIRS.join(', ')} each have a colocated test.`,
);
