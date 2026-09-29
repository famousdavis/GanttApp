// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, matchesGlob, relative, sep } from 'node:path';

import { describe, it, expect } from 'vitest';

/**
 * The coverage report must list every source file under `src/` and `pages/`,
 * including files no test loads. Without `test.coverage.include` in
 * `vitest.config.ts`, Vitest reports only files some test imports, so a file
 * with no test at all is missing from the report instead of counting at 0% —
 * and the headline figure is about five points higher than the code deserves.
 *
 * This reads the config as TEXT because importing `vitest.config.ts` from a test
 * fails in both environments: under jsdom esbuild's TextEncoder invariant
 * breaks, and under the node environment `src/test/setup.ts` needs `window`.
 *
 * ⚠️ LIMIT: the patterns are matched here with Node's `path.matchesGlob`, not
 * with the matcher Vitest uses. The two agree on these patterns today, but
 * nothing here proves they always will — a real `--coverage` run listing every
 * source file is what ties them together. This check is also deliberately
 * stricter than Vitest in one place: Vitest drops test files and setup files
 * from the report on its own, so removing the matching `exclude` entry would
 * not change a real report, but it fails here.
 */

const PRODUCTION_ROOTS = ['src', 'pages'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function stringList(block: string, key: string): string[] {
  const list = block.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`));
  if (!list) return [];
  return Array.from(list[1].matchAll(/'([^']*)'/g), (m) => m[1]);
}

const root = process.cwd();
const configText = readFileSync(join(root, 'vitest.config.ts'), 'utf-8');
const coverageBlock = configText.match(/coverage:\s*\{([\s\S]*?)\n\s*\},/)?.[1] ?? '';
const include = stringList(coverageBlock, 'include');
const exclude = stringList(coverageBlock, 'exclude');

const allFiles = PRODUCTION_ROOTS.flatMap((dir) => walk(join(root, dir)))
  .map((file) => relative(root, file).split(sep).join('/'));

// Not production code: test files, anything under a __tests__ folder, the
// shared test helpers, and type declarations.
const isTestOrHelper = (file: string) =>
  /\.test\.(ts|tsx)$/.test(file)
  || file.includes('/__tests__/')
  || file.startsWith('src/test/')
  || file.endsWith('.d.ts');

const isReported = (file: string) =>
  include.some((pattern) => matchesGlob(file, pattern))
  && !exclude.some((pattern) => matchesGlob(file, pattern));

describe('vitest.config.ts coverage covers every source file', () => {
  it('reports every production file under src/ and pages/', () => {
    const production = allFiles.filter((file) => !isTestOrHelper(file));
    // Must-find controls: a walk that found nothing would make the next
    // assertion pass while checking nothing. These two are the files the
    // default report used to omit.
    expect(production).toContain('pages/index.tsx');
    expect(production).toContain('src/shared/components/InvitationBanner.tsx');

    const unreported = production.filter((file) => !isReported(file));
    expect(unreported).toEqual([]);
  });

  it('reports no test file, test helper or declaration file', () => {
    const nonProduction = allFiles.filter(isTestOrHelper);
    // Must-find controls, one per kind of file the exclude list must drop.
    expect(nonProduction).toContain('src/test/setup.ts');
    expect(nonProduction).toContain('src/types/css.d.ts');
    expect(nonProduction).toContain('src/lib/__tests__/coverage-config.test.ts');

    const reported = nonProduction.filter(isReported);
    expect(reported).toEqual([]);
  });
});
