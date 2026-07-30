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
 *     is the authoritative, complete history (101 entries).
 *   - `CHANGELOG.md` — the record in the repository (84 entries).
 *   - `public/CHANGELOG.md` — served at /CHANGELOG.md on the deployed site.
 *
 * The public copy is the one that rots invisibly. Nothing in the app reads it,
 * so no build, type check, lint run or test touches it. SPERT Scheduler's
 * equivalent sat 43 releases behind for five months, serving a March changelog,
 * before a guard like this was written.
 *
 * `CHANGELOG.md` is missing 17 versions that the app has always rendered — see
 * KNOWN_MISSING_FROM_MARKDOWN below. That backlog predates this guard and is
 * recorded rather than fixed, so that no NEW gap can open while the decision to
 * backfill stays open. The list may only shrink: removing an entry from it
 * after backfilling is the intended direction, and adding to it should require
 * a deliberate argument.
 *
 * If the public copy fails: cp CHANGELOG.md public/CHANGELOG.md
 */

/**
 * Versions present in `changelog-data.tsx` but absent from `CHANGELOG.md`, as
 * measured on 2026-07-30. Backfilling them means transcribing JSX (with HTML
 * entities) into markdown — a separate piece of work from installing this gate.
 *
 * DO NOT add to this list to make a failing test pass. A new name here means a
 * release was written into the app and never into the repository's changelog.
 */
const KNOWN_MISSING_FROM_MARKDOWN = [
  '0.22.0',
  '13.9',
  '13.8',
  '12.6',
  '12.5',
  '12.4',
  '12.3',
  '12.2',
  '12.1',
  '12.0',
  '11.3',
  '11.2',
  '11.1',
  '3.4',
  '3.3',
  '3.2',
  '3.1',
];

describe('changelog surfaces agree', () => {
  const rootPath = join(process.cwd(), 'CHANGELOG.md');
  const publicPath = join(process.cwd(), 'public/CHANGELOG.md');
  const markdown = readFileSync(rootPath, 'utf-8');

  const markdownVersions = [...markdown.matchAll(/^## Version ([\d.]+)/gm)]
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
