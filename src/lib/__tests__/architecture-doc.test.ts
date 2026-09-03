// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * ARCHITECTURE.md guards (v0.28.13; extended v0.28.14).
 *
 * `ARCHITECTURE.md` is read by every later brief to decide what to build, and it
 * had drifted: it named two files that no longer exist, one that never existed,
 * a class deleted in v0.22.2, and a UI affordance this app has never had.
 *
 * Five assertions, deliberately narrow. Each guards a CLASS of claim that has
 * actually rotted here, not a hypothetical one.
 *
 *   1. Every filename named in the doc resolves in `git ls-files`.
 *   2. The phrase `permission-denied toast` does not reappear.
 *   3. The token `FirestoreDriver` does not reappear.
 *   4. The stale `snapshots.ts` descriptor does not reappear.      (v0.28.14)
 *   5. The GanttStorageService snapshot methods stay documented.   (v0.28.14)
 *
 * 4 and 5 point in OPPOSITE directions on purpose. The five functions v0.28.14
 * deleted from `src/shared/utils/snapshots.ts` share their names with live
 * `GanttStorageService` methods, so a name search for them returns nine lines of
 * correct interface documentation. 4 catches the descriptor that went stale; 5
 * catches an editor who reads those nine false positives as rot and deletes them.
 *
 * WHAT THIS DOES NOT GUARD, stated so the gap is not mistaken for coverage:
 *
 *   - OMISSIONS. A named -> exists check cannot see a file the doc failed to
 *     mention. 29 of 100 tracked non-test source files are unnamed. That is why
 *     the `## Directory Structure (key files)` heading was hedged rather than
 *     the tree regenerated: once the tree stops claiming completeness, an
 *     omission stops being a defect and this guard is exactly right.
 *   - Claims that name no file: stale version numbers, wrong behaviour
 *     descriptions, `window.confirm()` where the code now uses `ConfirmDialog`.
 *     Those were fixed by hand in v0.28.13 and nothing here stops them rotting
 *     again.
 *   - Assertion 2 guards a PHRASE, not a class. "produces one permission-denied
 *     notification" passes this test. It exists because that exact wording
 *     reached its fourth copy across the docs before anyone noticed. Assertion 4
 *     has the same weakness: a REWORDED stale descriptor passes it.
 *   - Assertion 5 pins ONE of the nine interface lines. The other eight say the
 *     same thing in prose and no phrase can enumerate them. What covers those is
 *     `git show --numstat HEAD -- ARCHITECTURE.md` read on the release commit,
 *     which is a review step and not a test.
 *
 * THE NO-REPRINT CONVENTION, stated here in full because this is the file it
 * most directly constrains and the only tracked file that records it.
 *
 * Set in v0.28.8: when you correct a piece of wording, describe the correction
 * WITHOUT reprinting the wording you are correcting. v0.28.7 had reworded a
 * v11.0 changelog entry away from a euphemism and then quoted the euphemism
 * verbatim to explain why -- moving it from an entry 1,500 lines down into the
 * newest entry of a served file and the first item rendered in the in-app
 * Change Log, more prominent than it had ever been in the entry being fixed.
 *
 * Why it bites HERE specifically. Three of the assertions above are of the form
 * `doc.includes(phrase) === false`. So a correction written INTO ARCHITECTURE.md
 * that quotes the phrase it is retiring puts that phrase straight back into the
 * file and fails the very assertion the correction was honouring. The failure
 * message will name the phrase and look like a regression, when what actually
 * happened is that someone documented a removal by performing it in reverse.
 *
 * The retired phrases appear as string literals in THIS file, which is correct
 * and is not a reprint: the assertions read `ARCHITECTURE.md` and nothing else,
 * so a test file is the one safe place in the repository to name them. Write
 * the correction in ARCHITECTURE.md so that it needs no quotation -- say what
 * the file now describes, not what it used to.
 *
 * ⚠️ This DOCUMENTS the convention; it does not ENFORCE it. Nothing here checks
 * that a correction avoids reprinting, and no assertion can: the three above can
 * only fail AFTER a reprint has already landed in the doc, and they cannot tell
 * a reprint apart from the original rot. Until v0.28.16 the convention was
 * recorded only in `CLAUDE.md`, which is gitignored and therefore absent from
 * every clean checkout -- exactly the state a new contributor is in when they
 * first hit this.
 *
 * `CLAUDE.md` is deliberately NOT guarded here. It is gitignored, so it is
 * absent from a clean checkout, and every test in this directory is a hard
 * assertion with no self-skip. The existing `claudeMdVersionPatterns` mechanism
 * in `shipgate.config.json` captures a version and cannot express "this phrase
 * must be absent". Reopen this if that mechanism gains the capability.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const docPath = join(process.cwd(), 'ARCHITECTURE.md');
const doc = readFileSync(docPath, 'utf-8');

/**
 * Real files that legitimately live outside this repository. An entry here is a
 * claim that the file exists somewhere else on purpose.
 */
const EXTERNAL_ALLOWLIST = [
  // Canonical Firestore rules live in the SPERT Landing Page repo; CI deploys
  // them from there. This repo deliberately carries no firestore.rules.
  'spert-landing-page/firestore.rules',
  // The Level 4 import spec guide lives outside this repo, in
  // ~/Documents/SPERT Documentation/robust-import-guide/. The APPLYING Contract
  // section cites it as the authority for the file-pick-boundary write site.
  // ⚠️ It must be named in the doc as a BARE BASENAME. The extractor's character
  // class excludes spaces, so writing the full path yields a different token
  // ("Documentation/robust-import-guide/IMPORT-DESIGN-GUIDE.md") that this entry
  // would not match, and the path-existence assertion would fail.
  'IMPORT-DESIGN-GUIDE.md',
];

/**
 * Tokens that match the filename pattern but are not filenames at all. This is
 * NOT the allowlist above and must not be used as one: nothing here is a file,
 * so "does it resolve?" is not a meaningful question about it.
 */
const NOT_A_FILENAME = [
  // Product name. The ".js" is branding, not an extension.
  'Next.js',
];

const EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'json', 'md',
  'rules', 'ico', 'png', 'pdf', 'svg', 'yml', 'yaml', 'txt', 'sh',
];

function extractFilenameTokens(text: string): string[] {
  const pattern = new RegExp(`[A-Za-z0-9_.\\-/]+\\.(?:${EXTENSIONS.join('|')})\\b`, 'g');
  return Array.from(new Set(text.match(pattern) ?? [])).sort();
}

function trackedFiles(): { paths: Set<string>; basenames: Set<string> } {
  const out = execSync('git ls-files', { encoding: 'utf-8' });
  const paths = out.split('\n').filter(Boolean);
  return {
    paths: new Set(paths),
    basenames: new Set(paths.map((p) => p.split('/').pop() as string)),
  };
}

describe('ARCHITECTURE.md — documented paths resolve', () => {
  it('names no file that does not exist', () => {
    const { paths, basenames } = trackedFiles();
    const unresolved = extractFilenameTokens(doc).filter(
      (tok) =>
        !EXTERNAL_ALLOWLIST.includes(tok) &&
        !NOT_A_FILENAME.includes(tok) &&
        !paths.has(tok) &&
        !basenames.has(tok.split('/').pop() as string)
    );

    expect(
      unresolved,
      `ARCHITECTURE.md names ${unresolved.length} path(s) that resolve nowhere in ` +
        `\`git ls-files\`: ${unresolved.join(', ')}. Either the file was renamed or ` +
        `deleted and the doc was not updated, or it lives outside this repo and ` +
        `belongs in EXTERNAL_ALLOWLIST with a comment saying where.`
    ).toEqual([]);
  });

  /**
   * Positive control. The count below was established by READING the extension
   * list against the document, not by running the extractor whose correctness is
   * in question — an extractor that silently matched nothing would satisfy a
   * mere non-emptiness check while finding none of the three dead files this
   * guard exists to catch.
   *
   * The `.ico` entry is load-bearing and is the reason this control asserts
   * membership rather than a bare count: an earlier revision of this extractor
   * omitted `.ico` and therefore could not see `public/favicon.ico`, a file that
   * never existed, while appearing to work.
   */
  it('extracts the file types the doc actually uses (control)', () => {
    const tokens = extractFilenameTokens(doc);
    const extensionsSeen = new Set(tokens.map((t) => t.split('.').pop()));

    for (const required of ['ts', 'tsx', 'md', 'css', 'mjs']) {
      expect(extensionsSeen, `extractor stopped matching .${required} files`).toContain(required);
    }
    expect(EXTENSIONS, 'the .ico extension must stay in the extractor').toContain('ico');
    // The doc names most files by basename inside the tree, a few by full path
    // in prose. The control asserts one of each so a regression in either form
    // is caught.
    expect(tokens, 'a known-good basename must resolve through the extractor').toContain(
      'validation.ts'
    );
    expect(tokens, 'a known-good full path must resolve through the extractor').toContain(
      'src/shared/hooks/useBufferedField.ts'
    );
    expect(tokens.length).toBeGreaterThan(60);
  });

  it('keeps the external allowlist minimal and load-bearing', () => {
    const { paths, basenames } = trackedFiles();
    for (const entry of EXTERNAL_ALLOWLIST) {
      expect(
        paths.has(entry) || basenames.has(entry.split('/').pop() as string),
        `${entry} is tracked in this repo now — remove it from EXTERNAL_ALLOWLIST ` +
          `so the real check applies to it.`
      ).toBe(false);
      expect(doc, `${entry} is allowlisted but no longer referenced — delete the entry.`).toContain(
        entry
      );
    }
  });
});

describe('ARCHITECTURE.md — retired claims stay retired', () => {
  it('does not describe a permission-denied toast', () => {
    // GanttApp has never had a toast: no library, no component. Cloud save
    // errors surface only in Settings -> Storage, via onSaveResult (v17.3.2).
    expect(
      doc.includes('permission-denied toast'),
      'ARCHITECTURE.md contains the phrase "permission-denied toast". This app has ' +
        'no toast mechanism and never has. Cloud save errors reach the user only ' +
        'through Settings -> Storage ("Cloud sync error: ..."), and only there.'
    ).toBe(false);
  });

  it('does not reference the deleted FirestoreDriver', () => {
    // Deleted in v0.22.2. Guarded as a bare token because the path-existence
    // check above only sees `firestore-driver.ts` — a recurrence of the
    // CamelCase symbol in prose or in an ASCII diagram would pass it.
    for (const token of ['FirestoreDriver', 'firestore-driver']) {
      expect(
        doc.includes(token),
        `ARCHITECTURE.md references "${token}", deleted in v0.22.2. The cloud path ` +
          `has no driver layer: FirestoreGanttStorageServiceImpl calls the Firestore ` +
          `SDK directly. Version-history records elsewhere keep the name on purpose ` +
          `and are correct — this file holds live description only.`
      ).toBe(false);
    }
  });

  it('does not describe snapshots.ts as CRUD or localStorage', () => {
    // v0.28.14 deleted five dead exports from `src/shared/utils/snapshots.ts`
    // along with the three constants they orphaned -- including SNAPSHOTS_KEY,
    // the `ganttAppSnapshots` localStorage key. What remains is validateSnapshot
    // and getSnapshotsForProject; the file touches localStorage nowhere.
    const stale = 'Snapshot CRUD, validation, localStorage';
    expect(
      doc.includes(stale),
      `ARCHITECTURE.md describes snapshots.ts as "${stale}". Both halves are ` +
        `false as of v0.28.14, which deleted every CRUD export and every ` +
        `localStorage access from that file. It now exports validateSnapshot ` +
        `and getSnapshotsForProject and nothing else.`
    ).toBe(false);
  });
});

describe('ARCHITECTURE.md - live interface docs are not collateral damage', () => {
  /**
   * Added v0.28.14, and it points the opposite way from every other assertion
   * here: it requires text to be PRESENT.
   *
   * `GanttStorageService` declares methods with the SAME NAMES as the five
   * functions v0.28.14 deleted from `src/shared/utils/snapshots.ts`. A name
   * search for the deleted functions therefore returns nine lines of live,
   * correct interface documentation in this file -- and invites whoever ran the
   * search to delete them while believing they are fixing the doc's accuracy.
   */
  it('still documents the GanttStorageService snapshot methods', () => {
    const box = 'addSnapshot, deleteSnapshot, deleteSnapshotsForProject';
    expect(
      doc.includes(box),
      `ARCHITECTURE.md no longer lists "${box}" in its GanttStorageService box. ` +
        `Those are LIVE interface methods -- declared in src/shared/types/storage.ts ` +
        `and implemented by both storage services. They share names with functions ` +
        `deleted from src/shared/utils/snapshots.ts in v0.28.14, which is precisely ` +
        `why they look deletable and are not. Restore the line.`
    ).toBe(true);
  });
});
