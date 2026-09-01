// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * The mutation scope and its written record cannot drift apart (v0.28.15).
 *
 * `stryker.config.json` used to tell readers to see `docs/mutation-baseline.md`
 * "for the candidacy gate that selected them and, just as importantly, for what
 * was excluded and why." That file has never contained the word "snapshots" and
 * documents no exclusion at all: it records the RUN -- score, all 209 classified
 * survivors, the guard, the cost. The pointer was false on the day it was
 * written, and it survived a mutation-baseline release plus six more because a
 * cross-reference is exactly the kind of claim nothing executes.
 *
 * Two assertions, both cheap, both about a divergence that has actually happened
 * here rather than a hypothetical one:
 *
 *   1. Every file in `mutate[]` exists. A scope entry naming a deleted or
 *      renamed file silently shrinks the mutation scope: Stryker matches it as a
 *      glob, so a stale path contributes no mutants and no error, and the score
 *      is computed over whatever is left.
 *   2. Every file in `mutate[]` is named in `docs/mutation-baseline.md`. That
 *      document is what the config's own comment points at, and a file added to
 *      the scope without appearing in the record makes the record a description
 *      of a run nobody can reproduce from it.
 *
 * WHAT THIS DOES NOT GUARD, stated so the gap is not mistaken for coverage:
 * nothing here reads the prose. `_mutateNote` carries per-file coverage figures,
 * and a figure going stale -- which is what v0.28.15 fixed in two places -- is
 * invisible to this test. It also cannot see a file that SHOULD be in scope and
 * is not; the direction it checks is scope -> record, never the converse.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const config = JSON.parse(
  readFileSync(join(process.cwd(), 'stryker.config.json'), 'utf-8')
) as { mutate: string[] };

const BASELINE_DOC = 'docs/mutation-baseline.md';
const baseline = readFileSync(join(process.cwd(), BASELINE_DOC), 'utf-8');

describe('stryker.config.json - mutation scope', () => {
  it('names only files that exist (control: the scope is non-empty)', () => {
    // The control is part of the assertion, not decoration: an empty or
    // mis-parsed `mutate` array would satisfy a bare "every path resolves"
    // check while proving nothing at all.
    expect(config.mutate.length, 'stryker.config.json mutate[] is empty').toBeGreaterThan(0);

    const missing = config.mutate.filter((p) => !existsSync(join(process.cwd(), p)));
    expect(
      missing,
      `stryker.config.json mutate[] names ${missing.length} path(s) that do not ` +
        `exist: ${missing.join(', ')}. Stryker treats these as globs, so a stale ` +
        `path contributes no mutants and raises no error -- the scope shrinks and ` +
        `the score is computed over whatever remains.`
    ).toEqual([]);
  });

  it(`is described in ${BASELINE_DOC}`, () => {
    const unrecorded = config.mutate.filter((p) => !baseline.includes(basename(p)));
    expect(
      unrecorded,
      `${BASELINE_DOC} does not mention ${unrecorded.join(', ')}, which ` +
        `stryker.config.json has in scope. That document is the record of the ` +
        `run; a scoped file missing from it makes the record unreproducible.`
    ).toEqual([]);
  });
});
