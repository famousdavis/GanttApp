// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { CHANGELOG_ENTRIES } from '../../features/changelog/changelog-data';

/**
 * GanttApp keeps its changelog in three places and nothing has ever held them
 * together:
 *
 *   - `src/features/changelog/changelog-data.tsx` — what the app renders. This
 *     is the authoritative, complete history.
 *   - `CHANGELOG.md` — the record in the repository.
 *   - `public/CHANGELOG.md` — served at /CHANGELOG.md on the deployed site.
 *
 * The public copy is the one that rots invisibly. Nothing in the app reads it,
 * so no build, type check, lint run or test touches it. SPERT Scheduler's
 * equivalent sat 43 releases behind for five months, serving a March changelog,
 * before a guard like this was written.
 *
 * The first two now hold the same versions in the same order, and this is
 * the first point at which that has ever been true. The count is deliberately
 * not written here: it rises every release, nothing checks a number in a
 * comment, and a stale one reads exactly like a true one. The tests below
 * derive it from the data. (It was 104 when this note was written; it is
 * whatever `CHANGELOG_ENTRIES` holds when you read it.) `CHANGELOG.md` was missing
 * 17 versions the app had always rendered: the four plain-text ones, 3.1 through
 * 3.4, were transcribed in v0.27.16, and the remaining 13 — whose items are JSX,
 * so they had to be converted rather than copied — in v0.27.17.
 * KNOWN_MISSING_FROM_MARKDOWN is deliberately kept at zero length rather than
 * deleted; see the note on it below.
 *
 * That completes the suite. SPERT AHP closed its single missing version in
 * v0.18.16, MyScrumBudget 21 in v0.34.6, SPERT Scheduler 33 in v0.59.6, and
 * GanttApp was the last one carrying it.
 *
 * If the public copy fails: cp CHANGELOG.md public/CHANGELOG.md
 */

/**
 * Versions present in `changelog-data.tsx` but absent from `CHANGELOG.md`. Empty
 * as of 2026-07-31, and it should stay that way.
 *
 * This is kept at zero length on purpose rather than deleted, and the two tests
 * that read it are kept with it. Emptied, they assert something stronger than
 * they did while it had names in it: the "no NEW gap" test becomes a plain
 * every-version-is-in-both check with no exemptions, and the ratchet below it
 * becomes a guard against anyone reintroducing an exemption. Deleting the list
 * would mean deleting both, and the next release that forgot a changelog entry
 * would land unnoticed — which is the exact defect that took 17 versions to
 * accumulate here. Both directions were re-verified by mutation once the list
 * was emptied, not assumed.
 *
 * DO NOT add a name here to make a failing test pass. A name here means a
 * release was written into the app and never into the repository's changelog.
 * Write the entry instead; that is a two-minute job and this list is not.
 *
 * Three things to know when adding an entry to `CHANGELOG.md` by hand:
 *
 * 1. An entry whose heading does not match `## Version X.Y (YYYY-MM-DD)`
 *    exactly is invisible to the regex below. While a version could sit on this
 *    list that failure was SILENT; with the list empty the hole is closed,
 *    because there is nothing left to exempt a malformed entry from the
 *    "no NEW gap" check.
 * 2. This file's dates are ISO, but `changelog-data.tsx` stores `Month D, YYYY`.
 *    They must be converted, not copied.
 * 3. GanttApp's version numbers are NOT monotonic — the history runs 1.0 → 18.0.0
 *    and then renumbers down to the 0.20.x era — so an entry's position must come
 *    from the data file's array order, never from sorting the numbers.
 */
const KNOWN_MISSING_FROM_MARKDOWN: string[] = [];

describe('changelog surfaces agree', () => {
  const rootPath = join(process.cwd(), 'CHANGELOG.md');
  const publicPath = join(process.cwd(), 'public/CHANGELOG.md');
  const markdown = readFileSync(rootPath, 'utf-8');

  const markdownVersions = Array.from(markdown.matchAll(/^## Version ([\d.]+)/gm))
    .map((m) => m[1])
    .filter((v): v is string => v !== undefined);
  const dataVersions = CHANGELOG_ENTRIES.map((e) => e.version);

  it('both surfaces carry entries', () => {
    expect(dataVersions.length).toBeGreaterThan(0);
    expect(markdownVersions.length).toBeGreaterThan(0);
  });

  it('every CHANGELOG.md entry also exists in the app', () => {
    const missing = markdownVersions.filter((v) => !dataVersions.includes(v));

    expect(
      missing,
      `these versions are in CHANGELOG.md but never render in the app: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('opens no NEW gap between the app and CHANGELOG.md', () => {
    const missing = dataVersions.filter((v) => !markdownVersions.includes(v));
    const unexpected = missing.filter((v) => !KNOWN_MISSING_FROM_MARKDOWN.includes(v));

    expect(
      unexpected,
      `these versions render in the app but were never written into CHANGELOG.md: ` +
        `${unexpected.join(', ')}. Add the entry to CHANGELOG.md — do not add it to ` +
        `KNOWN_MISSING_FROM_MARKDOWN.`,
    ).toEqual([]);
  });

  it('keeps the recorded gap accurate as entries are backfilled', () => {
    // The ratchet: once a version is backfilled into CHANGELOG.md it must leave
    // the list, so the recorded debt stays honest and can only shrink.
    const stillMissing = new Set(dataVersions.filter((v) => !markdownVersions.includes(v)));
    const backfilled = KNOWN_MISSING_FROM_MARKDOWN.filter((v) => !stillMissing.has(v));

    expect(
      backfilled,
      `these versions are now in CHANGELOG.md — remove them from ` +
        `KNOWN_MISSING_FROM_MARKDOWN: ${backfilled.join(', ')}`,
    ).toEqual([]);
  });

  it('agrees on the newest entry', () => {
    expect(dataVersions[0]).toBe(markdownVersions[0]);
  });

  it('the public copy is byte-identical to the root changelog', () => {
    expect(existsSync(publicPath), 'public/CHANGELOG.md is missing').toBe(true);

    const rootBuf = readFileSync(rootPath);
    const publicBuf = readFileSync(publicPath);

    if (!rootBuf.equals(publicBuf)) {
      const newestHeading = (buf: Buffer): string =>
        buf.toString('utf-8').match(/^## .*$/m)?.[0] ?? '(no version heading found)';

      throw new Error(
        'public/CHANGELOG.md has drifted from CHANGELOG.md.\n' +
          `  root:   ${rootBuf.length} bytes, newest entry ${newestHeading(rootBuf)}\n` +
          `  public: ${publicBuf.length} bytes, newest entry ${newestHeading(publicBuf)}\n` +
          'Fix with: cp CHANGELOG.md public/CHANGELOG.md',
      );
    }

    expect(publicBuf.equals(rootBuf)).toBe(true);
  });
});
