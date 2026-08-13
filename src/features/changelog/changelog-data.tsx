// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Changelog data — version entries rendered by ChangelogTab.
// To add a new version: insert an entry at the TOP of the array.

import type { ReactNode } from 'react';

export interface ChangelogEntry {
  version: string;
  date: string;
  items: ReactNode[];
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: '0.28.0',
    date: 'August 12, 2026',
    items: [
      <>
        <strong>Added</strong> &mdash; you can now choose the date the &ldquo;today&rdquo; line is
        drawn at. A date box sits beside the Show Today&rsquo;s Date toggle in Chart Settings.
        Leave it empty and nothing changes. Put a date in it &mdash; an upcoming sprint review,
        say &mdash; and the line moves there, with that date printed above it. Useful when a
        chart is prepared days before it is presented.
      </>,
      <>
        <strong>Unchanged</strong> &mdash; Date Prepared still reports the real date the chart was
        made. The two are separate on purpose: one says when the chart was drawn, the other says
        what point in the plan it describes.
      </>,
      <>
        <strong>Changed</strong> &mdash; with a date chosen, the legend reads &ldquo;Status
        Date&rdquo; rather than &ldquo;Today&rsquo;s Date&rdquo;, so a chart never shows a future
        date labelled as today next to a Date Prepared showing the real one. With no date chosen
        the legend is unchanged.
      </>,
      <>
        <strong>Added</strong> &mdash; a note appears if the chosen date falls outside the span the
        chart covers, where no line can be drawn. Previously such a date would simply vanish with
        no explanation.
      </>,
      <>
        <strong>Added</strong> &mdash; snapshots freeze the status date they were saved with and go
        on drawing the line where it was when the plan was captured. Older snapshots, and any saved
        without a status date, still draw at the real current date &mdash; they never inherit a date
        chosen later.
      </>,
      <>
        <strong>Fixed</strong> &mdash; emptying <em>all five</em> boxes under Settings &rarr; Default
        Legend Labels now restores the default names. Previously the old names were written back over
        the top and reappeared on the next reload; clearing only some of them always worked. A saving
        rule could add a setting but never remove one. Dating from v16.2, and found because the new
        status date would have had the same flaw.
      </>,
    ],
  },
  {
    version: '0.27.21',
    date: 'August 4, 2026',
    items: [
      <>
        <strong>Fixed</strong> &mdash; the browser tab now shows a name as soon as the page
        arrives, instead of the web address until the app finished loading. Anything that reads
        a page without running it &mdash; search engines, link previews, a screen reader
        announcing the page, the monitoring that checks the site is up &mdash; previously found
        nothing to go on.
      </>,
      <>
        <strong>Fixed</strong> &mdash; the page description and the tab icon were missing from
        that first page for the same reason, and now arrive with it too.
      </>,
      <>
        <strong>Changed</strong> &mdash; the tab reads &ldquo;GanttApp&trade; &mdash; Split-bar
        Gantt charts for visualizing release uncertainty&rdquo;, matching how the other SPERT®
        Suite apps name themselves. The version number that used to sit in the tab is gone; it
        remains in the footer and on this tab.
      </>,
      <>
        <strong>Added</strong> &mdash; a check that keeps the title where the first page can
        reach it. It was deliberately broken twice before being trusted.
      </>,
    ],
  },
  {
    version: '0.27.20',
    date: 'August 2, 2026',
    items: [
      <>
        <strong>Changed</strong> &mdash; licensing only. Nothing in the app changed &mdash; it
        behaves identically to v0.27.19.
      </>,
      <>
        <strong>Changed</strong> &mdash; the conditions attached to this project&apos;s licence
        now number six rather than four, and each follows the wording of the standard licence
        itself rather than paraphrasing it. What the licence permits is unchanged: anyone may
        still use, study, modify and share this software freely.
      </>,
      <>
        <strong>Added</strong> &mdash; the author&apos;s name may not be used to endorse or
        promote a product built from this software without permission. The project&apos;s
        trademarks are protected whether the licence mentions them or not, but a personal name
        has no such protection, and another condition requires that name to stay in the source
        code.
      </>,
      <>
        <strong>Added</strong> &mdash; anyone who resells this software with a warranty or
        support contract of their own covers any liability those promises impose on the
        original author.
      </>,
      <>
        <strong>Changed</strong> &mdash; the condition covering on-screen credit used to require
        any modified version with a user interface to display a notice. The standard licence
        permits requiring that existing notices be preserved, not that new ones be created, so
        a condition reaching past that could simply be deleted by whoever received it. It now
        requires that where a modified version already shows legal notices, the original
        author&apos;s name is kept among them.
      </>,
      <>
        <strong>Changed</strong> &mdash; a modified version may no longer misrepresent where
        this software came from, and the trademark condition now says plainly that naming this
        project to describe honestly what a fork was derived from is not itself prohibited,
        provided it does not suggest this project endorses the result.
      </>,
    ],
  },
  {
    version: '0.27.19',
    date: 'July 31, 2026',
    items: [
      <>
        <strong>Changed</strong> &mdash; tooling only. Nothing in the app changed &mdash; it
        behaves identically to v0.27.18.
      </>,
      <>
        <strong>Changed</strong> &mdash; the release checks now cover all three copies of this
        changelog, not just one. This project keeps its version history in the file alongside
        the source, in a served copy, and here inside the app. Only the first was ever checked,
        which is how seventeen versions went missing from it before they were transcribed back.
      </>,
    ],
  },
  {
    version: '0.27.18',
    date: 'July 31, 2026',
    items: [
      <>
        <strong>Changed</strong> &mdash; tooling only. Nothing in the app changed &mdash; it
        behaves identically to v0.27.17.
      </>,
      <>
        <strong>Changed</strong> &mdash; the automated release checks now read the Node version
        this repository pins, from the file kept alongside the source, rather than a version
        written directly into the checks themselves. The two were free to disagree, and did.
      </>,
    ],
  },
  {
    version: '0.27.17',
    date: 'July 31, 2026',
    items: [
      <>
        <strong>Changed</strong> &mdash; record-keeping only. Nothing in the app changed &mdash;
        it behaves identically to v0.27.16.
      </>,
      <>
        <strong>Changed</strong> &mdash; the last thirteen releases that were listed here in the
        app but missing from the changelog file kept alongside the source code &mdash; v11.1
        through v13.9, and v0.22.0 &mdash; have now been copied across. The two records are
        complete and identical for the first time, covering all 104 releases back to v1.0.
      </>,
    ],
  },
  {
    version: '0.27.16',
    date: 'July 31, 2026',
    items: [
      <>
        <strong>Changed</strong> &mdash; record-keeping only. Nothing in the app changed &mdash;
        it behaves identically to v0.27.15.
      </>,
      <>
        <strong>Changed</strong> &mdash; four releases from January 2026, v3.1 through v3.4, have
        always been listed here in the app but had never been written into the changelog file
        kept alongside the source code. They have now been copied across word for word. Thirteen
        more are still outstanding; they are tracked automatically, so they cannot quietly be
        forgotten.
      </>,
    ],
  },
  {
    version: '0.27.15',
    date: 'July 30, 2026',
    items: [
      <><strong>Changed</strong> &mdash; Release-process work only. Nothing in the app itself changed &mdash; it behaves identically to v0.27.14.</>,
      <>Every proposed change is now checked automatically before it can be merged: the full test suite, the linter, a production build, and a check that the version number agrees everywhere it appears. This is the first automated checking this project has ever had &mdash; previously a green checkmark meant only that a preview had been built, not that the 1,250 tests had been run, because nothing ran them.</>,
      <>A test that had to be hand-edited on every single release no longer does. It listed the newest 28 versions by position and had to be renumbered each time a release was added. It now checks the underlying rule instead &mdash; that every entry in this changelog appears on the page, in order &mdash; which covers all 101 entries and needs no maintenance.</>,
      <>Added automatic checks that this changelog stays consistent across the three places it is kept, that the license file still matches the canonical copy shared across the suite, and that every file the app links to actually exists.</>,
    ],
  },
  {
    version: '0.27.14',
    date: 'July 29, 2026',
    items: [
      <><strong>Changed</strong> &mdash; The license file now reserves the SPERT&reg; brand. It has always required that the original author be credited, but it said nothing about the brand name itself &mdash; which left room to read the licence&rsquo;s freedom to copy and modify the code as carrying the name along with it. That was never the intent. Two clauses were added: the first names &ldquo;SPERT&rdquo;, &ldquo;Statistical PERT&rdquo; and &ldquo;Estimation Made Easy&rdquo; as registered trademarks and &ldquo;GanttApp&rdquo; and &ldquo;MyScrumBudget&rdquo; as common-law trademarks, and grants no right to use any of them; the second requires anyone who modifies the app to release it under a different name. The effect is that the code is still free to take, change and share, credit to the original author still has to travel with it, and the brand does not.</>,
      <><strong>Fixed</strong> &mdash; This repository was not actually shipping the GNU GPL v3. The <code>LICENSE</code> file held only a short summary and a link to gnu.org &mdash; 48 lines, with none of the licence&rsquo;s 17 operative sections present. It now carries the complete 726-line licence, as GPL v3 Section 4 requires. The additional terms were also an older, weaker wording that left out both the ban on replacing the author&rsquo;s name with someone else&rsquo;s and the requirement that the credit appear somewhere visible in the interface.</>,
      <>Nothing in the app itself changed &mdash; this release only edits the license file.</>,
    ],
  },
  {
    version: '0.27.13',
    date: 'July 29, 2026',
    items: [
      <><strong>Fixed</strong> &mdash; Shared project members showed a raw internal account ID instead of a name or email address. This affected anyone added through an emailed invitation who had used another SPERT&reg; Suite app but had never personally signed into GanttApp. The member list now falls back to the shared suite-wide profile, so the name or email appears immediately &mdash; including for members added before this release. Nothing needs to be re-invited.</>,
    ],
  },
  {
    version: '0.27.12',
    date: 'July 25, 2026',
    items: [
      <><strong>Security</strong> &mdash; Raised the <code>postcss</code> override floor <code>^8.5.10</code> &rarr; <code>^8.5.18</code> (resolves to 8.5.23), clearing GHSA-r28c-9q8g-f849 (PostCSS path traversal in previous-source-map auto-loading, high). This was the only advisory reaching the production bundle &mdash; <code>next</code> was flagged solely for depending on the vulnerable <code>postcss</code>. Shipped-side audit (<code>npm audit --omit=dev</code>) is back to 0. No app behavior changes.</>,
    ],
  },
  {
    version: '0.27.11',
    date: 'July 23, 2026',
    items: [
      <><strong>Maintenance</strong> &mdash; jsdom 29.0.2 &rarr; 29.1.1 (routine, past the 60-day soak window). Test environment only (vitest <code>environment: &apos;jsdom&apos;</code>) &mdash; not in the production bundle. All 1247 tests pass. No app behavior changes.</>,
    ],
  },
  {
    version: '0.27.10',
    date: 'July 23, 2026',
    items: [
      <><strong>Security</strong> &mdash; Dev-tooling cleanup (no shipped-bundle impact). <code>firebase-tools</code> 15.22.1 &rarr; 15.24.0, then a non-force <code>npm audit fix</code> sweep clears the in-range transitives &mdash; the critical <code>tar</code> and the high <code>brace-expansion</code> / <code>js-yaml</code> / <code>fast-uri</code> plus low <code>body-parser</code> (total 13 &rarr; 8). The 8 remaining are dev-only with no forward fix (the firebase-tools OpenTelemetry/pubsub/gaxios/uuid/@hono/MCP-SDK cluster + <code>esbuild</code> Windows-dev-server low); none ship to production (<code>npm audit --omit=dev</code>: 0). No app behavior changes.</>,
    ],
  },
  {
    version: '0.27.9',
    date: 'July 23, 2026',
    items: [
      <><strong>Security</strong> &mdash; Shipped-side dependency update. <code>next</code> 16.2.9 &rarr; 16.2.11 (high-severity advisory cluster; <code>eslint-config-next</code> co-bumped to 16.2.11), the <code>protobufjs</code> override floor <code>^7.6.3</code> &rarr; <code>^7.6.5</code> (clears a DoS advisory on the Firebase SDK&apos;s copy), and a new <code>sharp</code> override <code>^0.35.0</code> (clears the inherited libvips CVEs; the <code>next</code> bump alone doesn&apos;t lift it since next still pins <code>sharp ^0.34.5</code>). sharp is an unused optional dependency here (no <code>next/image</code>). The next advisories aren&apos;t structurally reachable in this Pages-Router app; taken for currency and a clean scan. No app behavior changes.</>,
    ],
  },
  {
    version: '0.27.8',
    date: 'July 4, 2026',
    items: [
      <><strong>UX</strong> &mdash; Release dates now read chronologically everywhere on the Releases tab. The <em>Most Likely</em> date input moved between <em>Early Finish</em> and <em>Late Finish</em> in the Add/Edit release form (matching the chart, where the Most Likely line renders between the early and late boundaries), and its label now spells out <em>(Optional)</em>. Saved release rows show the same order &mdash; Start, Early, Most Likely, Late &mdash; with the former &ldquo;ML:&rdquo; abbreviation spelled out as &ldquo;Most Likely:&rdquo;. No data-model or chart changes.</>,
    ],
  },
  {
    version: '0.27.7',
    date: 'June 28, 2026',
    items: [
      <><strong>Security</strong> &mdash; Standardized the <code>postcss</code> override to a caret range (<code>8.5.10</code> &rarr; <code>^8.5.10</code>), floating the single hoisted copy to <code>postcss</code> 8.5.16. Keeps GHSA-qx2v-qp2m-jg93 (PostCSS XSS, <code>postcss &lt;8.5.10</code>) closed while taking future 8.5.x patches and matching the rest of the SPERT suite. No app behavior changes.</>,
    ],
  },
  {
    version: '0.27.6',
    date: 'June 25, 2026',
    items: [
      <><strong>Maintenance</strong> &mdash; Adopted <strong>Node 24 LTS</strong>: <code>@types/node</code> 22.19.15 &rarr; 24.12.2, <code>engines.node</code> 22.x &rarr; 24.x, and <code>.nvmrc</code> 22 &rarr; 24, matching the Vercel build/runtime setting. All deps support Node 24; type definitions now match the runtime. Next bump: 26.x ~December 2026. No app behavior changes.</>,
    ],
  },
  {
    version: '0.27.5',
    date: 'June 25, 2026',
    items: [
      <><strong>Maintenance</strong> &mdash; jsdom updated 27.4.0 &rarr; 29.0.2 (two-major; test environment only, not shipped to production). Introduces <code>undici</code> 6.27.0 as a transitive dep. All 1245 tests pass under jsdom 29. No behavior changes.</>,
    ],
  },
  {
    version: '0.27.4',
    date: 'June 25, 2026',
    items: [
      <><strong>Maintenance</strong> &mdash; TypeScript updated 5.9.3 &rarr; 6.0.3. Dev-time type checker only &mdash; SWC compiles the bundle, so no runtime impact. TS 6.0 deprecates the <code>es5</code> target (fully removed in 7.0); the project&apos;s es5 target is retained via a new <code>ignoreDeprecations: &quot;6.0&quot;</code> opt-in in tsconfig. <code>@typescript-eslint</code> 8.62.0 admits 6.0.3 (no override needed). No behavior changes.</>,
    ],
  },
  {
    version: '0.27.3',
    date: 'June 25, 2026',
    items: [
      <><strong>Maintenance</strong> &mdash; react and react-dom updated 19.2.4 &rarr; 19.2.5 (patch; 77 days soaked). They move as an atomic pair; <code>@types/react</code> and <code>@types/react-dom</code> held. No behavior changes.</>,
    ],
  },
  {
    version: '0.27.2',
    date: 'June 25, 2026',
    items: [
      <>
        <strong>Security</strong> &mdash; Dependency security update: next 16.2.9 (high CVE
        cluster), vite 7.3.5 (two high Windows dev-server advisories), firebase 12.12.1
        (clears protobufjs critical; @grpc/grpc-js high expected to clear via float),
        firebase-tools 15.22.1 (js-yaml CVE). postcss and protobufjs overrides added.
        eslint-config-next co-bumps to 16.2.9; vitest to 4.1.5. No runtime behavior changes.
      </>,
    ],
  },
  {
    version: '0.27.1',
    date: 'June 19, 2026',
    items: [
      <><strong>Dependency security</strong> &mdash; Targeted dev-dependency security update closing four CVEs flagged by the SPERT&reg; Story Map v0.46.2 audit. <code>vitest</code> and <code>vite</code> are test tooling only and never ship to production, so there is zero runtime, app-behavior, or user-facing change. All 1245 tests pass on the new toolchain; production build and lint are clean. Node.js stays pinned at v22 LTS</>,
      <><strong>vitest 4.0.18 &rarr; 4.1.4</strong> &mdash; Closes GHSA-5xrq-8626-4rwp (<strong>Critical</strong>) &mdash; Vitest UI server arbitrary file read and execute</>,
      <><strong>vite 7.3.1 &rarr; 7.3.2</strong> &mdash; Closes GHSA-p9ff-h696-f583 (High) arbitrary file read via the dev-server WebSocket, GHSA-v2wj-q39q-566r (High) <code>server.fs.deny</code> bypass via queries, and GHSA-4w7w-66w2-5vf9 (Moderate) path traversal in optimized-deps <code>.map</code> handling</>,
      <><strong>Mechanism</strong> &mdash; <code>vite</code> is transitive (pulled by <code>vitest</code> and <code>@vitejs/plugin-react</code>), not a direct dependency. Bumping vitest to 4.1.4 did not move vite on its own: vitest@4.1.4 declares a wide <code>^6.0.0 || ^7.0.0 || ^8.0.0</code> vite range that the locked 7.3.1 already satisfied, and vite&apos;s <code>latest</code> dist-tag is now 8.x, so normal resolution would never select 7.3.2. vite is therefore pinned to exactly 7.3.2 through a package.json <code>overrides</code> entry, which forces the patched build across the whole tree while keeping vite out of <code>dependencies</code> and <code>devDependencies</code></>,
      <><strong>Deferred (intentional)</strong> &mdash; vite GHSA-fx2h-pf6j-xcff and GHSA-v6wh-96g9-6wx3 remain open. Both are Windows-only and are first fixed in vite 7.3.5, which has not yet cleared the 60-day stability window; the bump is scheduled as a follow-up around July 31, 2026. At that point the <code>overrides</code> pin moves from 7.3.2 to 7.3.5 and the remaining vite advisory node clears entirely</>,
    ],
  },
  {
    version: '0.27.0',
    date: 'May 25, 2026',
    items: [
      <><strong>Security (E1 / F1/F3 / E2-gap &mdash; CRITICAL)</strong> &mdash; Three sign-out correctness gaps closed. (1) <strong>Externally-revoked sessions</strong> (<code>onAuthStateChanged(null)</code> firing from a token expiry, an admin revoke, or sign-out in another tab) now run the full cleanup chain instead of leaving the cloud service alive and the previous user&apos;s data in memory. (2) The combined <code>!firebaseUser || !db</code> branch is <strong>split</strong>: the partial-config case (Auth available, Firestore not) preserves prior behavior; only true revocation runs cleanup. (3) <code>ganttAppData</code> and <code>ganttAppSnapshots</code> are <strong>cleared from <code>localStorage</code></strong> on cloud sign-out, closing the shared-browser path where the next user&apos;s cloud-mode switch would have read those keys and uploaded the previous user&apos;s data into their Firestore account</>,
      <><strong>Bug fix (I1 &mdash; HIGH)</strong> &mdash; Real-time releases data-loss guard now fires only on the <strong>first snapshot per project per cloud session</strong>. A <code>Set&lt;string&gt;</code> sentinel at <code>AppDataProvider</code> scope (survives subscription re-mounts; clears on storage change) tracks seen projects. Sentinel mutation placed outside the <code>setData</code> updater for React StrictMode correctness. Previously the guard blocked every empty snapshot, indefinitely preventing legitimate collaborator deletions from propagating</>,
      <><strong>Bug fix (I2 &mdash; HIGH)</strong> &mdash; <code>permission-denied</code> on a real-time subscription now (1) prunes the revoked project from driver <code>lastSavedState</code> and <code>pendingData</code> before dispatching the eviction event &mdash; closing an infinite save-fail loop where the next diff treated the revoked project as &ldquo;removed&rdquo; and re-attempted writes to its now-inaccessible subcollections; (2) evicts the project and its releases from <code>AppDataContext</code>; (3) evicts snapshots from <code>useSnapshots</code>. One in-flight save to the revoked project&apos;s subcollections may still surface a single permission-denied toast before the pruned state takes effect</>,
      <><strong>Bug fix (A3 &mdash; HIGH)</strong> &mdash; Eight global text inputs (<em>Prepared By</em>, the five <em>Default Legend Labels</em>, and <em>Export Attribution</em> name + identifier) now commit to cloud storage <strong>on blur, Enter, or tab-away</strong> (component unmount) via the new <code>useBufferedField</code> shared hook. Escape reverts the draft without committing. Previously: one Firestore write per keystroke, trailing-space trim mid-input, and a silent data-loss bug where tab-navigating away from Settings dropped the in-progress edit. Inline chart label editors are intentionally <strong>deferred</strong> &mdash; they are per-project (shared with collaborators) and need different conflict-resolution semantics</>,
      <><strong>Bug fix (I1a &mdash; HIGH)</strong> &mdash; <strong>User-switch race guard</strong> added to the <code>subscribeToProject</code> success callback, after each async boundary in <code>loadAppData</code> and <code>loadSnapshots</code>, and inside <code>executeSave</code> (the save-side guard prevents an infinite save-fail loop if a debounced save fires after a different user has signed in). The driver now refuses to deliver stale data or attempt writes when <code>auth.currentUser.uid</code> no longer matches its construction-time <code>uid</code></>,
      <><strong>Reliability (D1 &mdash; HIGH)</strong> &mdash; Save debounce reduced from 500&thinsp;ms to 200&thinsp;ms</>,
      <><strong>Reliability (D2 &mdash; HIGH)</strong> &mdash; <code>pagehide</code> listener added alongside <code>beforeunload</code> for pending-write flushing. Both handlers use distinct function references and are idempotent. <code>pagehide</code> also fires on bfcache entry, so mobile Safari users no longer lose unsaved edits when switching apps</>,
      <><strong>Bug fix (J1/J2 &mdash; MEDIUM)</strong> &mdash; <code>loading</code> now resets to <code>true</code> at the start of every storage load cycle, closing a race where the import fast-path gate (<code>!appDataLoading</code>) was sticky-false during invitation-claim reloads and storage swaps</>,
      <><strong>Maintenance (K2 &mdash; LOW)</strong> &mdash; <code>schemaVersion: 1</code> included in every Firestore user-settings write; read-side migration hook added in <code>userSettingsToAppData</code> (warns on unknown future versions). Snapshot documents deferred to a future pass</>,
      <><strong>Architecture</strong> &mdash; New <code>ganttapp:project-revoked</code> CustomEvent (app-scoped) dispatched only by <code>FirestoreGanttStorageServiceImpl</code> on <code>permission-denied</code>. Handled by <code>AppDataContext</code> (gated on cloud mode) and <code>useSnapshots</code> (ungated &mdash; driver is the sole dispatcher; avoids a <code>useStorage()</code> dependency cascade). <code>dispose()</code> gains an explicit <code>if (this.disposed) return</code> guard for cleaner double-cleanup semantics</>,
      <><strong>Tests</strong> &mdash; +25 net. New shared cloud-mode harness in <code>AppDataContext.cloud.test.tsx</code> covering I1, I2, and J1/J2 paths. New <code>StorageContext.cloud.test.tsx</code> covering cloud-mode sign-out cleanup. New <code>useBufferedField.test.ts</code>. Driver gets new I1a uid-guard tests, I2 pruning regression, D1/D2 timing tests. Existing component tests updated to add the blur step where commit assertions previously fired on change. Suite total: 1220 &rarr; 1245</>,
    ],
  },
  {
    version: '0.26.1',
    date: 'May 24, 2026',
    items: [
      <><strong>About page polish</strong> &mdash; Renamed the QRG download button from <em>Download Quick Reference Guide (PDF)</em> to <em>Open Quick Reference Guide (PDF)</em> so the label matches the canonical convention used across the SPERT&reg; Suite (Forecaster, MyScrumBudget, AHP, Story Map, Scheduler). The PDF target is unchanged &mdash; still opens <code>/GanttApp_Quick_Reference_Guide.pdf</code> in a new tab</>,
    ],
  },
  {
    version: '0.26.0',
    date: 'May 21, 2026',
    items: [
      <><strong>Bug fix (cloud mode, CRITICAL)</strong> &mdash; Both import fast paths are now gated on local storage mode. In cloud mode, the import preview is always shown regardless of conflict count. Prevents silent duplicate projects during the post-sign-in Firestore hydration window when <code>listAppData()</code> returns a stale empty snapshot</>,
      <><strong>Bug fix (default decisions)</strong> &mdash; ID-conflict projects now default to <em>Skip</em>, not conditionally <em>Replace</em>. Matching names is not evidence that an import is newer than the workspace &mdash; a user who exported a backup, did more work, then imported the older file would silently lose the newer work. Users must explicitly select <em>Replace</em> to overwrite an existing project</>,
      <><strong>Bug fix (copy collision)</strong> &mdash; Import &lsquo;copy&rsquo; decisions now use collision-safe <code>(2)</code>, <code>(3)</code>, <code>(4)</code>, ... iteration up to <code>(99)</code>. Previously, importing the same file twice via &lsquo;copy&rsquo; produced two projects both named &ldquo;Foo (2)&rdquo; with no distinguishing label. The new iteration reserves names in a <code>usedNames</code> Set so each copy in the same batch (and across re-imports) gets a unique suffix</>,
      <><strong>Reliability</strong> &mdash; Both apply functions now use <code>try/finally &#123; setApplying(false) &#125;</code>, guaranteeing the UI is never permanently locked after an unexpected throw. <code>applyingRef</code> (<code>useRef</code>) added to both apply functions as a same-tick reentrancy guard, preventing double-apply on rapid Confirm clicks. <code>handleConfirmMerge</code> and <code>handleConfirmReplaceAll</code> gain belt-and-suspenders <code>if (applying) return</code> UI-layer guards</>,
      <><strong>Reliability</strong> &mdash; <code>readerPendingRef</code> guard added to <code>handleImport</code>: a second file pick while the first reader is in flight is silently ignored. The <code>&lt;input type=&quot;file&quot;&gt;</code> is also disabled immediately on first pick</>,
      <><strong>UX</strong> &mdash; Stale error banner AND stale preview from a prior pick are both cleared at the start of a new file pick, before any processing. Picking a new valid file after a prior failed/abandoned pick no longer renders the old dialog over the new flow</>,
      <><strong>Refactor</strong> &mdash; Smart Import state machine extracted from <code>ProjectsTab.tsx</code> to a new <code>useImportState()</code> hook in <code>src/features/projects/hooks/</code>. ProjectsTab becomes a thin composition layer: the hook owns all import state (preview, banner, applying, replace-confirm), all transitions, and all handlers; ProjectsTab only renders the JSX shell and wires hook callbacks to UI elements. The state machine is now testable via <code>renderHook</code> without going through the full component tree</>,
      <><strong>Refactor</strong> &mdash; <code>applyImportDecisions</code> signature change: now accepts pre-computed <code>conflicts: ImportConflict[]</code> as the 5th parameter, eliminating the internal re-detection call. Callers compute conflicts once at preview-build time and pass the result through. <code>resolvedAction</code> renamed to <code>resolvedOutcome</code> to clarify that the return value includes the synthetic <em>&lsquo;added&rsquo;</em> classification. <code>normalizeProjectName(name)</code> extracted as a shared helper (trim, lowercase, NFC) and used internally by <code>detectImportConflicts</code></>,
      <><strong>Accessibility</strong> &mdash; <code>ImportPreviewSection</code>: outer container gets <code>role=&quot;region&quot;</code> with <code>aria-labelledby</code> pointing at the &ldquo;Review import&rdquo; heading. Heading receives programmatic focus on mount (with <code>tabIndex=&#123;-1&#125;</code> to keep it out of the Tab cycle). Escape key now dismisses the preview, suppressed while applying. Per-conflict containers get <code>role=&quot;radiogroup&quot;</code> with the conflict description as the labelled-by target. Action buttons (Confirm Merge / Replace All Data / Cancel) get <code>aria-busy</code> bound to the applying state</>,
      <><strong>Tests</strong> &mdash; New <code>useImportState.test.ts</code> with 21 <code>renderHook</code> cases covering: parse errors, fast paths + cloud guard, preview/decision flow, drift abort, applying-state lifecycle (success + failure paths), same-tick reentrancy guards (split into ref-based + state-based), <code>readerPendingRef</code>, decision-state management (Map clone, mode toggle preserves decisions), <code>handleConfirmReplaceAll</code> flow + double-click guard, Cancel returns to preview state intact. Plus 4 new collision tests in <code>export.test.ts</code>. Test count: 1197 &rarr; 1220 (+23)</>,
      <><strong>SPEC_DEVIATIONS</strong> &mdash; New <code>docs/SPEC_DEVIATIONS.md</code> tracks Level 4 import-spec deferred items: SD-1 (React Context closure boundary), SD-2 (<code>selectedProjectId</code> non-atomic remap), SD-5 (coarse-grain abort vs per-decision graceful fallback), SD-6 (<code>cloneProject</code> not reused in copy path due to owner semantics), SD-7 (<code>aria-busy</code> observability gap on Replace-All path; needs <code>flushSync</code>). SD-3 (collision-safe copy) and SD-4 (default &lsquo;Replace&rsquo; reversion) are resolved in this release</>,
      <><strong>Note (cloud mode)</strong> &mdash; The import success banner reflects the in-memory merge result. Firestore commit completes within ~500 ms via the debounced auto-save. Banner counts are optimistic in cloud mode</>,
    ],
  },
  {
    version: '0.25.0',
    date: 'May 10, 2026',
    items: [
      <><strong>UX</strong> &mdash; <strong>Releases tab right-side controls upgraded to the shared icon family.</strong> The per-release <strong>Edit</strong> and <strong>Duplicate</strong> text buttons are replaced with the same icon buttons used on the Projects tab &mdash; <code>PencilIconButton</code> (blue) and <code>CloneIconButton</code> (violet) &mdash; in <strong>Edit, Duplicate, Delete</strong> order matching the Projects tab. The existing <code>TrashIconButton</code> stays put. Tighter row, less visual noise, full cross-page consistency</>,
      <><strong>UX</strong> &mdash; <strong>Vertical divider</strong> (1&times;20 px) sits to the left of the icon trio, separating the <strong>Show</strong> checkbox + <strong>Status</strong> dropdown (settings) from the action icons. Reads as <em>&ldquo;settings | actions.&rdquo;</em> No empty slot &mdash; on Projects the divider separates a fixed-width share slot from the icons; on Releases there&apos;s no equivalent owner-only action, so the divider sits directly left of Edit</>,
      <><strong>Component</strong> &mdash; <strong>New <code>PencilIconButton.active</code> prop.</strong> When <code>true</code>, the button renders its hover state permanently (blue icon + blue tint + blue ring) so the row currently being edited stays visibly marked even when the cursor moves away &mdash; preserving the &ldquo;this is the active edit&rdquo; cue that the old solid-blue text button provided. <code>disabled</code> overrides <code>active</code>. Backwards-compatible: prop defaults to <code>false</code>, so existing call sites (Projects tab edit pencil) are unchanged</>,
    ],
  },
  {
    version: '0.24.0',
    date: 'May 10, 2026',
    items: [
      <><strong>Feature</strong> &mdash; <strong>Smart Import with per-project conflict resolution.</strong> The old binary import dialog (replace-all OR additive merge-with-skip) is replaced by an inline preview between the toolbar and the project list. Pick a file, see every conflicting project, choose <em>Keep existing, ignore imported</em> / <em>Add as a copy</em> / <em>Replace existing with imported</em> per project, then Confirm. The previous flow silently skipped any project whose ID matched an existing one &mdash; a surprise when round-tripping a backup with renames or hitting coincidental name collisions. The new flow surfaces every conflict and gives full control</>,
      <><strong>Feature</strong> &mdash; <strong>Dual conflict detection.</strong> Conflicts are detected by ID match (<em>same project</em>) AND by name match (<em>same name, different origin</em>) using a case-insensitive, trimmed comparison. ID conflicts show both names side-by-side so renames since export are visible at a glance. Two existing projects sharing a name are resolved by first-match in array order</>,
      <><strong>Feature</strong> &mdash; <strong>Smarter ID-conflict defaults.</strong> When the existing and incoming names match (the round-trip backup case), the default is <em>Replace</em>. When the names differ (records have diverged), the default is <em>Skip</em> &mdash; preserve the existing version. Name-only conflicts default to <em>Add as a copy</em>. Defaults populated synchronously when the preview opens; user can change any decision before confirming</>,
      <><strong>Feature</strong> &mdash; <strong>Two fast paths.</strong> A <code>ganttapp-project-export</code> file with zero conflicts applies immediately with no preview. A full-workspace replace into a fresh empty workspace also applies immediately, no preview, no modal &mdash; gated on <code>!appDataLoading</code> so a still-loading workspace cannot be silently clobbered</>,
      <><strong>Feature</strong> &mdash; <strong>Mode toggle for full-workspace files.</strong> <code>ganttapp-all-projects</code> and legacy files render a Merge / Replace All toggle in the preview. Merge mode shows the per-project conflict UI plus a hint: <em>&ldquo;Workspace settings (colors, attribution) are not imported in Merge mode. Switch to Replace All to restore them.&rdquo;</em> Replace All mode hides the conflict list and routes through the existing <code>ConfirmDialog</code> modal. Toggling mode does not reset per-project decisions</>,
      <><strong>Reliability</strong> &mdash; <strong>Dual stale-data guards.</strong> If your workspace changes while the preview is open (e.g., a peer edits a shared project in cloud mode), the import aborts with a clear banner: <em>&ldquo;The workspace changed while the preview was open. Please review your import again.&rdquo;</em> Two checks &mdash; one pre-async (cheap, catches the common non-cloud case) and one post-<code>loadSnapshots</code> (authoritative, catches the real-time-sync window) &mdash; both abort cleanly without writing partial data</>,
      <><strong>Reliability</strong> &mdash; <strong>Slot-preserving Replace.</strong> When you Replace an existing project, the new project takes the same array index as the old one. Cloud writes are not falsely flagged as reorders, and ownership (<code>existingProject.owner</code>) is preserved on the slot. If the existing project had no owner (local mode), the imported record stays unowned &mdash; no fabricated UIDs</>,
      <><strong>Reliability</strong> &mdash; <strong>Apply-state safety.</strong> While an import is being applied, the Confirm / Replace All / Cancel buttons, the mode selector, and the toolbar Import button (label <em>and</em> <code>&lt;input type=&quot;file&quot;&gt;</code>) are all disabled. Picking a new file mid-flow dismisses any open Replace-All modal cleanly</>,
      <><strong>UX</strong> &mdash; Success and error banners (<code>role=&quot;status&quot;</code> / <code>role=&quot;alert&quot;</code>) replace all <code>alert()</code> popups in the import flow. Explicit Dismiss button; no auto-fade. Success banner reports exact counts: <em>&ldquo;2 projects added, 1 copied, 1 replaced.&rdquo;</em></>,
      <><strong>Refactor</strong> &mdash; <code>mergeImportedProjects</code> retired in favor of the new <code>applyImportDecisions(existing, incoming, existingSnapshots, decisions, idGenerator?)</code>. New helpers <code>detectImportConflicts</code> and <code>conflictsEqual</code> are exported from <code>export.ts</code> and directly unit-tested. <code>MAX_NAME_LENGTH</code> is now exported from <code>validation.ts</code> for downstream consumers. Inline preview UI extracted as <code>ImportPreviewSection</code> in its own file. Test count: 1161 &rarr; 1195 (net +34)</>,
    ],
  },
  {
    version: '0.23.1',
    date: 'May 10, 2026',
    items: [
      <><strong>UX</strong> &mdash; <strong>Matching colored hover ring on the four per-tile icon buttons.</strong> The v0.23.0 <code>ShareIconButton</code> introduced the soft colored ring pattern (cyan <code>box-shadow</code>) and the pre-existing Trash / Pencil / Export / Clone buttons looked subdued by comparison &mdash; only their tinted background appeared on hover, no ring. Each now renders its own colored ring on hover/focus: Trash red <code>rgba(239,68,68,0.5)</code>, Pencil blue <code>rgba(0,112,243,0.5)</code>, Export green <code>rgba(16,185,129,0.5)</code>, Clone violet <code>rgba(139,92,246,0.5)</code></>,
      <><strong>UX</strong> &mdash; Each transition extended from <code>&apos;background 0.12s ease&apos;</code> to <code>&apos;background 0.12s ease, box-shadow 0.12s ease&apos;</code> so the ring fades in alongside the background tint rather than snapping in. Icon stroke color, hover background, and disabled handling are unchanged from v0.23.0</>,
    ],
  },
  {
    version: '0.23.0',
    date: 'May 10, 2026',
    items: [
      <><strong>UX</strong> &mdash; New <code>ShareIconButton</code> replaces the text-based Share button on each project tile. Borderless, grayscale at rest, and turns cyan (<code>#06b6d4</code>) with a soft cyan ring (<code>box-shadow</code>) on hover &mdash; matching the v17.1 / v19.0 grayscale-at-rest icon-button family. Glyph is a user-plus (person silhouette + crosshair plus sign)</>,
      <><strong>UX</strong> &mdash; <strong>Clickable project tile.</strong> The middle region of every project tile (project name + release-count + finish-date metadata) is now its own <code>&lt;button&gt;</code> that navigates to the Releases tab on click. While the cursor is over the clickable middle region the <strong>entire tile</strong> tints faint teal (<code>#f0fdfa</code> light / <code>rgba(20,184,166,0.10)</code> dark &mdash; matched to the SPERT brand teal <code>#14b8a6</code>) &mdash; drag handle, share slot, divider, and icon buttons all included &mdash; so the affordance reads at a glance even though the icons themselves are not part of the click target. Move off the middle region and the tile returns to grayscale. The button sits as a flex-1 sibling between the drag handle and the icon group, so clicks on the icons cannot bubble into the tile click. The &ldquo;View Releases&rdquo; text button has been deleted; the action lives entirely in the tile gesture now. <code>aria-label=&ldquo;Open releases for &#123;project.name&#125;&rdquo;</code> gives screen readers a clear action name. Outer-tile <code>draggable=&#123;true&#125;</code> + drag handlers preserved verbatim</>,
      <><strong>UX</strong> &mdash; <strong>6-dot drag handle.</strong> <code>DragHandle</code> is now a 2&times;3 grid of 6 dots instead of a 3-dot vertical column. Matches the SPERT Suite (Story Map, Forecaster, CFD, AHP) convention</>,
      <><strong>UX</strong> &mdash; <strong>Drag source restricted to the handle.</strong> <code>draggable=&#123;true&#125;</code> and the drag start/end handlers moved off the outer tile and onto a wrapper around the 6-dot handle. The outer tile keeps <code>onDragOver</code> so it remains a valid drop target &mdash; you can still drop anywhere on a tile to reorder, but you can only <em>initiate</em> a drag from the handle. <code>setDragImage(tile, 12, height/2)</code> is called in <code>onDragStart</code> so the drag ghost shows the whole tile rather than just the tiny handle. Cursor map across the tile is now: <code>grab</code> only on the 6 dots &rarr; <code>default</code> on the surrounding padding &rarr; <code>pointer</code> on the clickable middle &rarr; <code>default</code> between divider and icons &rarr; <code>pointer</code> on each icon button</>,
      <><strong>UX</strong> &mdash; Per-tile icon row in <code>ProjectsTab</code> restructured into two sub-groups separated by a thin vertical divider. The left slot always reserves a fixed footprint (<code>calc(18px + 0.7rem)</code>) for the share icon and renders the button only when <code>isCloudMode &amp;&amp; user &amp;&amp; project.owner === user.uid</code>. The right group (Export, Edit, Clone, Delete) now stays pixel-aligned across owner and non-owner tiles regardless of storage mode</>,
      <><strong>UX</strong> &mdash; All five icon buttons (<code>ShareIconButton</code>, <code>ExportIconButton</code>, <code>PencilIconButton</code>, <code>CloneIconButton</code>, <code>TrashIconButton</code>) now render at <code>18&times;18</code> instead of <code>20&times;20</code> for a tighter, more refined per-tile control strip. <code>viewBox</code> is unchanged at <code>0 0 24 24</code> so strokes scale rather than crop</>,
      <><strong>Behavior</strong> &mdash; No functional changes to share, export, edit, clone, or delete flows. Click handlers, <code>aria-label</code>s, focus/blur hover handling, and disabled states are preserved verbatim</>,
    ],
  },
  {
    version: '0.22.2',
    date: 'May 9, 2026',
    items: [
      <><strong>Security</strong> &mdash; <strong>v0.22.2 security audit fixes (S1, S2, S3, S4, S5, S6, S7, S9)</strong>. App-side companion to the suite-wide Firestore rules update. No user-visible behavior changes.</>,
      <><strong>Security (S1 / S8 — HIGH)</strong> &mdash; Deleted the legacy single-email <code>shareProject()</code> helper, the dead <code>FirestoreDriver</code> class, and the <code>INVITATIONS_ENABLED === false</code> branch in <code>ShareDialog</code>. The legacy helper performed an unbounded <code>getDocs(collection(&apos;ganttapp_profiles&apos;))</code> scan that, combined with the prior <code>allow read: if isAuth()</code> rule on profiles, permitted bulk profile enumeration by any authenticated SPERT user. Bulk invitations via the <code>sendInvitationEmail</code> Cloud Function are now the only email&rarr;share path.</>,
      <><strong>Security (S3 Option A)</strong> &mdash; <code>confirmKeepLocalCopy</code> now strips each project&apos;s cloud <code>owner</code> UID before persisting to <code>localStorage</code>. The UID is meaningful only in cloud mode; in local mode it leaked the cloud user&apos;s Firebase identity into a shared-browser surface. Round-trip preserved: re-upload via <code>projectToFirestoreMeta</code> re-binds <code>owner</code> from the current user.</>,
      <><strong>Security (S5)</strong> &mdash; Cloud <code>owner</code> UID stripped from all four JSON export entry points (<code>exportData</code>, <code>exportAllProjects</code>, <code>exportSingleProject</code>, <code>exportSelectedProjects</code>) via a new <code>stripCloudIdentity()</code> helper. Exported files no longer carry the originating user&apos;s Firebase UID for cross-app correlation.</>,
      <><strong>Security (S6)</strong> &mdash; Removed <code>firebaseUser.uid</code> from the <code>claimPendingInvitations</code> failure log. Devtools and screenshares no longer expose the user&apos;s Firebase identity; server-side CF logs retain the UID via the request context for triage.</>,
      <><strong>Security (S7)</strong> &mdash; Deleted the bare <code>signOut</code> helper from <code>AuthContext</code>&apos;s public surface. All sign-out paths now route through <code>StorageContext.performSignOutWithCleanup</code> (cancelPendingSaves &rarr; runAppDataReset &rarr; dispose &rarr; mode reset &rarr; storage swap &rarr; firebaseSignOut). Eliminates a footgun where a future contributor could bypass the cleanup chain.</>,
      <><strong>Security (S9)</strong> &mdash; <code>subscribeToProject</code> error callback now unsubscribes and removes the listener from the tracking array on <code>permission-denied</code> (e.g., when the owner removes the user mid-session). Other error codes (<code>unavailable</code>, <code>deadline-exceeded</code>) remain transient and are left to the SDK&apos;s retry loop.</>,
      <><strong>Companion rules</strong> &mdash; Suite-wide <code>firestore.rules</code> deploy ships with this release: <code>ganttapp_profiles</code> tightened to <code>get</code> + <code>limit(1)</code>-constrained <code>list</code> (S1); <code>ganttapp_projects</code> create now binds <code>owner == request.auth.uid</code> (S2); <code>ganttapp_projects</code> + <code>releases</code> + <code>snapshots</code> now enforce <code>keys()</code>/<code>affectedKeys()</code> field allowlists on create/update (S4).</>,
    ],
  },
  {
    version: '0.22.1',
    date: 'May 9, 2026',
    items: [
      <><strong>Refactor</strong> &mdash; Bulk-invitation flow extracted from <code>ShareDialog.tsx</code> as an in-file <code>InvitationSection</code> component. Parent retains the members section, the legacy single-email panel, the remove-member confirm modal, and the shared <code>OwnerStatus</code> gating. The legacy panel is intentionally <em>not</em> extracted &mdash; it is marked for deletion when <code>INVITATIONS_ENABLED</code> becomes permanent</>,
      <><strong>Refactor</strong> &mdash; New <code>triggerJsonDownload(payload, filename)</code> helper in <code>export.ts</code> centralizes the Blob &rarr; URL &rarr; anchor-click &rarr; revoke sequence shared by <code>exportData</code>, <code>exportAllProjects</code>, <code>exportSingleProject</code>, and <code>exportSelectedProjects</code> &mdash; single point of change for download UX</>,
      <><strong>Refactor</strong> &mdash; New <code>listMemberProjects()</code> private method on <code>FirestoreGanttStorageServiceImpl</code> dedupes the constrained-query + defense-in-depth preamble previously inlined in <code>loadAppData</code>, <code>loadSnapshots</code>, and <code>saveSnapshots</code></>,
      <><strong>Fix</strong> &mdash; <code>useInvitationLanding</code> cloud auto-flip now logs rejected attempts and drops the banner back to <code>idle</code> (consuming <code>SESSION_KEY</code> first, symmetric with <code>dismiss()</code>) so a transient flip failure no longer leaves the user stuck in <code>pre_auth</code> indefinitely</>,
      <><strong>Fix</strong> &mdash; <code>shareProject</code> now guards <code>meta.members</code> for null before the role check &mdash; a malformed project document yields the friendly &ldquo;Only the project owner can share projects&rdquo; error rather than an unhandled <code>TypeError</code></>,
      <><strong>Fix</strong> &mdash; Firestore reads in <code>userSettingsToAppData</code> and <code>firestoreSnapshotToFlat</code> now route <code>chartColors</code> and <code>chartDisplaySettings</code> through the existing <code>sanitizeChartColors</code> / <code>sanitizeDisplaySettings</code> helpers (defense-in-depth against schema drift or manual doc edits)</>,
      <><strong>Refactor</strong> &mdash; <code>migrateReleaseStatus</code> signature accepts <code>&#123; status?: unknown; completed?: unknown &#125;</code> directly. Eliminates the two <code>data as unknown as Record&lt;string, unknown&gt;</code> double casts at the call sites in <code>firestore-converters.ts</code></>,
      <><strong>Deps</strong> &mdash; <code>@types/react</code> <code>^19</code> &rarr; <code>^19.2.14</code>; <code>@types/react-dom</code> <code>^19</code> &rarr; <code>^19.2.3</code>. Type-only declarations; both released before the 60-day window</>,
    ],
  },
  {
    version: '0.22.0',
    date: 'May 8, 2026',
    items: [
      <><strong>Fix</strong> &mdash; <strong>Bulk-sharing retrograde-audit remediation</strong> (May 2026 audit). Nine confirmed gaps fixed across two PRs, hardening the invitation-banner state machine, the bulk-send pipeline, and the member-removal transaction</>,
      <><strong>Fix</strong> &mdash; <code>removeCollaborator</code> now runs all four guards inside <code>runTransaction</code> so the project-exists check, both ownership guards, and the membership write + <code>_changeLog</code> append cannot interleave with concurrent owner activity. New pre-transaction guard 1 surfaces a user-friendly &ldquo;Cannot remove yourself from a project.&rdquo; when an owner clicks Remove on themselves (LESSONS-LEARNED §50)</>,
      <><strong>Fix</strong> &mdash; <code>claimPendingInvitationsAndNotify</code> short-circuits on <code>firebaseUser.emailVerified === false</code>. Microsoft personal accounts and unverified Google accounts no longer trigger noisy <code>failed-precondition</code> console errors on every auth resolution (LESSONS-LEARNED §26)</>,
      <><strong>Fix</strong> &mdash; <code>useInvitationLanding</code> rewrite. Cloud auto-flip on invite-link arrival is now gated on <code>localProjectCount === 0</code> so users with local content keep their projects (LESSONS-LEARNED §28). The <code>spert:models-changed</code> listener checks <code>sessionStorage[SESSION_KEY]</code> as its first line so spurious &ldquo;you&apos;ve been added to&rdquo; banners no longer appear on normal sign-in (LESSONS-LEARNED §27). A 30 s grace timer transitions stuck <code>pre_auth</code> back to <code>idle</code> and consumes <code>SESSION_KEY</code> before <code>setState</code> so a reload mid-timer cannot rehydrate the stale state (LESSONS-LEARNED §59)</>,
      <><strong>Fix</strong> &mdash; <code>parseBulkEmails</code> now returns <code>&#123; valid, invalid &#125;</code> and runs every token through <code>EMAIL_RE</code>. Share dialog renders rejected tokens in a red &ldquo;Skipped N: &hellip;&rdquo; chip below the textarea instead of silently dropping them. When zero addresses are valid, no CF call fires and the textarea content is preserved so typos can be corrected in place (LESSONS-LEARNED §42)</>,
      <><strong>Fix</strong> &mdash; Share dialog gains a four-state <code>OwnerStatus</code> enum (<code>loading</code> / <code>owner</code> / <code>not-owner</code> / <code>error</code>). When <code>getProjectMembers</code> rejects, the bulk UI is replaced by &ldquo;Couldn&apos;t load sharing details. Refresh the page to try again.&rdquo; rather than leaving the user with a half-loaded dialog (LESSONS-LEARNED §60)</>,
      <><strong>Fix</strong> &mdash; Post-send refresh now uses <code>Promise.allSettled</code>. A transient error on <code>listPendingInvites</code> can no longer discard a fulfilled <code>getProjectMembers</code> value, and the members list updates independently (LESSONS-LEARNED §64)</>,
      <><strong>Refactor</strong> &mdash; <code>useInvitationLanding</code> initial state now derived in a <code>useState</code> lazy initializer. Pages Router has no SSR justification for <code>setState</code>-in-effect, so the <code>react-hooks/set-state-in-effect</code> rule holds without an <code>eslint-disable</code>. Eliminates the visible &ldquo;idle &rarr; pre_auth&rdquo; flicker on invite-link arrivals (LESSONS-LEARNED §66)</>,
      <><strong>UX</strong> &mdash; <code>InvitationBanner</code> renders as a 512 px max-width centered card so the sign-in CTA sits at the visual focus of the page. <code>FirstRunBanner</code> stays full-width as a passive info strip &mdash; the deliberate divergence is documented inline (LESSONS-LEARNED §56)</>,
      <><strong>Tests</strong> &mdash; +6 EMAIL_RE coverage tests on <code>parseBulkEmails</code>, +3 transaction-guard tests on <code>removeCollaborator</code>, +1 service-wrapper test for owner self-removal. Suite total: 1167 &rarr; 1173 (no regressions)</>,
    ],
  },
  {
    version: '0.21.1',
    date: 'May 5, 2026',
    items: [
      <><strong>UX</strong> &mdash; <strong>Export All</strong> and <strong>Import</strong> buttons in the Projects toolbar are now grayscale at rest (no fill, no border, just an icon and label in <code>#9ca3af</code>) and only adopt color on hover/focus. Export All hovers green (<code>#10b981</code>), Import hovers blue (<code>#0070f3</code>). Both pick up a 1px tinted outline and a soft tinted fill on hover, matching the v17.1 trashcan and v19.0.0 per-tile icon button pattern</>,
      <><strong>Why</strong> &mdash; These two actions are infrequent (most users export at the end of a session and import only when restoring or transferring a workspace). Filled high-contrast buttons commanded visual attention disproportionate to how often they&apos;re invoked, and they were the last toolbar element still using the pre-v17.1 button style. Now visually consistent with the rest of the projects toolbar</>,
      <><strong>A11y</strong> &mdash; Both buttons gain explicit <code>aria-label</code>s (&ldquo;Export all projects as JSON&rdquo;, &ldquo;Import projects from JSON&rdquo;) so screen reader users still get a clear action name as the visible styling becomes more subtle</>,
      <><strong>Behavior</strong> &mdash; No functional changes. Click handlers, file-picker behavior, the v19.0.0 toolbar position (between form card and tile list), and zero-projects centering are all preserved</>,
    ],
  },
  {
    version: '0.21.0',
    date: 'May 5, 2026',
    items: [
      <><strong>Fix</strong> &mdash; Cloud projects load again in multi-tenant Firestore. The unconstrained <code>getDocs(collection(&apos;ganttapp_projects&apos;))</code> in <code>loadAppData</code>, <code>loadSnapshots</code>, and <code>saveSnapshots</code> failed with <code>permission-denied</code> as soon as the collection contained any project owned by another user, because Firestore evaluates <code>list</code> rules against the query shape (not per-document) and the rule referenced <code>resource.data.members</code> which is undefined for list operations</>,
      <><strong>Fix</strong> &mdash; Switched to the canonical SPERT pattern (Story Map v0.14.3): constrained query with <code>where(`members.&#36;&#123;uid&#125;`, &apos;in&apos;, [&apos;owner&apos;, &apos;editor&apos;, &apos;viewer&apos;])</code> in all three methods. Server-side filter now returns only the user&apos;s projects; the client-side membership check is retained as defense-in-depth</>,
      <><strong>Rules</strong> &mdash; <code>ganttapp_projects/list</code> rule relaxed to <code>if isAuth()</code> only. The per-user filtering is now done by the <code>where()</code> clause server-side. <code>get</code>, <code>create</code>, <code>update</code>, and <code>delete</code> rules unchanged. Subcollection rules (<code>releases</code>, <code>snapshots</code>) unchanged. Matches the suite-wide pattern documented in <code>cloud-storage-guide/ARCHITECTURE.md</code> §6.5 and §7</>,
      <><strong>Tests</strong> &mdash; +1 regression test asserting <code>where(`members.&#36;&#123;uid&#125;`, &apos;in&apos;, [...])</code> is called during <code>loadAppData</code>. Existing 1165 tests continue to pass</>,
    ],
  },
  {
    version: '0.20.1',
    date: 'May 5, 2026',
    items: [
      <><strong>Fix</strong> &mdash; Share button now appears on owned project tiles immediately after creation in cloud mode. Previously, <code>addProject</code> built the new <code>Project</code> in-memory without seeding the <code>owner</code> field, so the render condition <code>project.owner === user.uid</code> evaluated false until a full reload re-fetched the project from Firestore (where the owner was correctly stored). Now seeded inline at creation time</>,
      <><strong>Fix</strong> &mdash; Cloning a project rebinds the clone&apos;s <code>owner</code> to the current user (cloud mode) instead of inheriting the source&apos;s <code>owner</code> via blind <code>...source</code> spread. Without this, cloning a project shared <em>to</em> you would carry the original owner&apos;s uid in the clone&apos;s in-memory state until reload, even though Firestore correctly wrote the new owner on save</>,
      <><strong>Fix</strong> &mdash; <code>validateLoadedData</code> now preserves the <code>owner</code> field through localStorage round-trips. Previously this sanitization function dropped the field on load, which could clear ownership on any path where cloud-mode data hit the local validator (defense-in-depth, not the primary user-visible path)</>,
      <><strong>Tests</strong> &mdash; +6 regression tests across <code>useProjects</code> (addProject + cloneProject local-mode owner handling) and <code>storage</code> (validateLoadedData owner preservation, sanitization, and absence handling)</>,
    ],
  },
  {
    version: '0.20.0',
    date: 'May 4, 2026',
    items: [
      <><strong>Versioning</strong> &mdash; Renumbered from <code>19.0.0</code> to <code>0.20.0</code> to align with the rest of the SPERT&reg; Suite, which uses standard <code>0.x.x</code> semver because none of those apps have reached a true 1.0 yet (planned for 2027). GanttApp was the first app in the suite and predated the convention; this is a one-time deliberate jump with zero functional impact. The &ldquo;20&rdquo; preserves the &ldquo;20th release&rdquo; intuition (v19 was last)</>,
      <><strong>Versioning</strong> &mdash; All historical changelog entries below remain labeled under their original version numbers (v3.0 through v19.0.0) &mdash; we don&apos;t rewrite history</>,
      <><strong>Versioning</strong> &mdash; Going forward, GanttApp follows standard pre-1.0 semver: <strong>patch</strong> bumps (<code>0.20.1</code>) for bug fixes, security patches, and copy/style tweaks; <strong>minor</strong> bumps (<code>0.21.0</code>) for new features, behavior changes, and refactors that touch user-visible state; no MAJOR bump until the eventual 1.0 launch. This is a behavior change from the prior habit of treating MAJOR as feature-level (e.g. v18.0.0, v19.0.0)</>,
    ],
  },
  {
    version: '19.0.0',
    date: 'May 4, 2026',
    items: [
      <><strong>Feature</strong> &mdash; <strong>Per-project export</strong>. Each project tile gets a new download icon next to Edit. Clicking it downloads a single-project JSON file (project record + releases) named <code>ganttapp-&#123;project-slug&#125;-&#123;YYYY-MM-DD&#125;.json</code>. The file is portable across workspaces and excludes global settings (chart colors, display settings, attribution, etc.) so importing it doesn&apos;t overwrite the recipient&apos;s configuration</>,
      <><strong>Feature</strong> &mdash; <strong>Project cloning</strong>. New duplicate icon next to Delete on each project tile. Clones the project, all releases, and all snapshots with new IDs. The clone appears immediately below the source with the suffix &ldquo;&nbsp;- Copy (1)&rdquo; (incremented as needed to avoid collisions). Snapshot cloning is skipped with a one-line alert if it would exceed the 100-snapshot workspace cap; the project + releases still clone</>,
      <><strong>Feature</strong> &mdash; <strong>Edit pencil icon</strong>. The text &ldquo;Edit&rdquo; button on each project tile is now a pencil icon (matching the visual weight of the trashcan and new export/clone icons). Clicking it scrolls to the form at the top of the page and applies a blue 600&nbsp;ms highlight pulse to the form card so the user can see where their attention is being directed</>,
      <><strong>Feature</strong> &mdash; New <strong>Export Projects</strong> section in Settings. Pick one, several, or all projects via checkboxes. Optional &ldquo;Include snapshots&rdquo; toggle controls whether snapshots are bundled into the file (snapshots can make the file noticeably larger). Downloads as <code>ganttapp-projects-export-&#123;YYYY-MM-DD&#125;.json</code></>,
      <><strong>Feature</strong> &mdash; <strong>Additive merge import</strong>. Importing a single-project or multi-project file (anything tagged <code>_exportType: &apos;ganttapp-project-export&apos;</code>) now <em>adds</em> projects to the existing workspace instead of replacing it. Projects whose <code>id</code> already exists are skipped with a count reported to the user; releases and snapshots associated with skipped projects are not imported. Importing an Export-All file (or a legacy file with no <code>_exportType</code>) still triggers the existing replace-all confirmation dialog &mdash; behavior is unchanged for those</>,
      <><strong>UX</strong> &mdash; The <strong>Export All</strong> and <strong>Import</strong> buttons moved out of the page header row into a toolbar row between the project form and the project tile list. <strong>Import</strong> remains visible at zero projects (it has to be reachable for first-import); <strong>Export All</strong> is hidden at zero projects</>,
      <><strong>Fix</strong> &mdash; Local-storage warning banner: text and &ldquo;Got it&rdquo; button are now vertically centered (previously the button hugged the top of the banner when the text wrapped to one line)</>,
      <><strong>Refactor</strong> &mdash; The snapshot caps (<code>MAX_SNAPSHOTS_TOTAL = 100</code>, <code>MAX_SNAPSHOTS_PER_PROJECT = 50</code>) were duplicated as private <code>const</code>s in both the local and Firestore storage services. Extracted to <code>src/shared/storage/snapshot-limits.ts</code> and imported by all three call sites (the two storage services and the new <code>cloneProject</code> in <code>useProjects</code>) so the cap can be changed in one place</>,
      <><strong>Refactor</strong> &mdash; <code>ConfirmDialog</code> modal-mode rendering now handles the <code>&apos;primary&apos;</code> variant (filled blue, white text) in addition to <code>&apos;danger&apos;</code> and the default secondary outline. Used by the new merge-import &ldquo;Add Projects&rdquo; CTA</>,
    ],
  },
  {
    version: '18.0.0',
    date: 'May 4, 2026',
    items: [
      <><strong>Feature</strong> &mdash; Bulk invitations on the Share Project dialog. Project owners can paste multiple email addresses (separated by commas, semicolons, or whitespace), pick a role (Editor / Viewer), and send invitations in one round-trip. Existing SPERT&reg; Suite users are auto-added to the project immediately; new users receive a branded invitation email and are auto-claimed on next sign-in via Google or Microsoft SSO</>,
      <><strong>Feature</strong> &mdash; Pending invitations list shows the recipient email, role, and email-send count (max 5 resends). Each pending invite has a Resend button (text affordance) and a Revoke button (trashcan icon, with confirmation dialog). Server-side caps enforce the 5-resend limit and the per-user 25/day send limit</>,
      <><strong>Feature</strong> &mdash; <code>InvitationBanner</code> renders at the top of the app when the URL contains <code>?invite=&lt;token&gt;</code> or after a successful claim. Three states: idle (hidden), pre-auth (sign-in prompt with Google + Microsoft SSO buttons), and claimed (&ldquo;You&apos;ve been added to: &lt;project list&gt;&rdquo;). Sign-in routes through the existing <code>useSignInWithTosGate</code> so the Terms-of-Service consent flow cannot be bypassed</>,
      <><strong>Architecture</strong> &mdash; Backend prerequisite: <code>spert-landing</code> Cloud Functions (<code>sendInvitationEmail</code>, <code>claimPendingInvitations</code>, <code>resendInvite</code>, <code>revokeInvite</code>) now register <code>ganttapp</code> as a supported <code>appId</code>. CORS allowlist covers the production domain and dev ports 3000&ndash;3010</>,
      <><strong>Architecture</strong> &mdash; <code>writeUserProfile</code> in <code>AuthContext</code> dual-writes <code>ganttapp_profiles/&#123;uid&#125;</code> + <code>spertsuite_profiles/&#123;uid&#125;</code> on every auth resolution. The cross-app <code>spertsuite_profiles</code> write enables email&rarr;uid lookup for the bulk-send path. <code>createUserProfile</code> deleted &mdash; profile writes are now no longer gated on cloud-mode switching</>,
      <><strong>Architecture</strong> &mdash; <code>removeProjectMember</code> renamed to <code>removeCollaborator</code> and refactored to use <code>deleteField()</code> on the specific <code>members.&#123;uid&#125;</code> key (race-safe under concurrent membership changes). The flag-off legacy single-email Share input panel is preserved byte-identical; the rename applies in both flag states</>,
      <><strong>Architecture</strong> &mdash; <code>AppDataContext</code> listens for <code>spert:models-changed</code> custom events dispatched by <code>claimPendingInvitationsAndNotify</code>. A new <code>reloadCounter</code> + <code>loadedDataRef</code> pattern triggers a Firestore reload without invoking the save effect &mdash; concurrent collaborator edits on the just-claimed project are not clobbered. CI-gated regression test covers this path</>,
    ],
  },
  {
    version: '17.3.3',
    date: 'May 3, 2026',
    items: [
      <><strong>Accessibility</strong> &mdash; Form-field hygiene residual sweep covering Chrome DevTools Issues panel rules: every <code>&lt;input&gt;</code>, <code>&lt;textarea&gt;</code>, and <code>&lt;select&gt;</code> now carries a <code>name</code> attribute, every sibling-style <code>&lt;label&gt;</code> is associated with its input via <code>htmlFor</code> + <code>id</code> (generated with <code>useId()</code> for collision-free uniqueness), and one orphan <code>&lt;label&gt;</code> for the WorkWeekSelector (a custom button-group with no single input target) was converted to a styled <code>&lt;span&gt;</code></>,
      <><strong>Hygiene</strong> &mdash; Added <code>autoComplete=&quot;name&quot;</code> to the Export Attribution &ldquo;Name&rdquo; input (placeholder &ldquo;e.g., Jane Smith&rdquo; matches the personal-name pattern; user&apos;s own name). The Identifier sibling stays free of <code>autoComplete</code> because its placeholder &ldquo;e.g., student ID, email, or team name&rdquo; is intentionally generic and not a category the browser knows how to autofill</>,
      <><strong>Accessibility (in passing)</strong> &mdash; Added <code>aria-label</code> to four inputs that lack a surrounding <code>&lt;label&gt;</code> element: ChartSettings &ldquo;Prepared By&rdquo;, ShareDialog email + role select, ReleasesTab + GanttChart project pickers, and the inline date / text / legend-label editors</>,
    ],
  },
  {
    version: '17.3.2',
    date: 'May 3, 2026',
    items: [
      <><strong>Fix</strong> &mdash; Cloud auto-save failures (background debounced writes from <code>FirestoreGanttStorageServiceImpl.executeSave</code>) were previously logged with <code>console.error</code> only and never surfaced to the user. The service now accepts an optional <code>onSaveResult(error | null)</code> callback that <code>StorageContext</code> wires to a new <code>saveError</code> state; the message renders in the Settings &rarr; Storage section using the same red-text pattern as <code>switchError</code> and <code>authError</code>, and clears automatically on the next successful save</>,
      <><strong>Fix</strong> &mdash; Both Firestore <code>onSnapshot</code> listener sites (<code>FirestoreGanttStorageServiceImpl.subscribeToProject</code> and <code>FirestoreDriver.onRemoteChange</code>) now provide an error callback that logs via <code>sanitizeFirebaseError</code>; <code>subscribeToProject</code> additionally surfaces the error through the same <code>onSaveResult</code> channel as auto-save. Permission revocations and network drops are no longer silent</>,
      <><strong>Accessibility / Hygiene</strong> &mdash; Added <code>autoComplete=&quot;off&quot;</code> to the share-project email input (avoids autofilling the signed-in user&apos;s own email when inviting another user) and <code>autoComplete=&quot;name&quot;</code> to the chart &ldquo;Prepared By&rdquo; input</>,
    ],
  },
  {
    version: '17.3',
    date: 'May 1, 2026',
    items: [
      <><strong>UX</strong> &mdash; Added a branded teal SPERT&reg; Suite favicon as both the browser tab icon and a header mark immediately to the left of the &ldquo;GanttApp&trade;&rdquo; title. A charcoal dark-mode variant swaps automatically when the active theme is dark, driven by the existing <code>useTheme()</code> hook</>,
    ],
  },
  {
    version: '17.2',
    date: 'April 28, 2026',
    items: [
      <><strong>UX</strong> &mdash; Lightened the default <code>TrashIconButton</code> color from theme-aware <code>colors.textSecondary</code> (<code>#666</code> in light mode) to a hardcoded soft gray <code>#9ca3af</code> across both themes. The previous shade read too dark next to the blue Edit / View Releases buttons; the lighter gray matches the standardized SPERT&reg; Suite trashcan look. Hover/focus state (red <code>#ef4444</code> + soft red background tile) is unchanged</>,
    ],
  },
  {
    version: '17.1',
    date: 'April 28, 2026',
    items: [
      <><strong>UX</strong> &mdash; Replaced the text <strong>Delete</strong> button on the Projects and Releases tabs, the <strong>Remove</strong> button in the project sharing dialog, and the snapshot delete button in the SnapshotBar with a single shared icon button. The trashcan is grayscale by default and turns red &mdash; with a soft red background tile &mdash; on hover or keyboard focus. Destructive actions now have a lower visual weight, matching the standardized SPERT&reg; Suite look. Confirmation dialogs (<code>ConfirmDialog</code>) are unchanged so the second-tier safety net stays in place</>,
      <><strong>Accessibility</strong> &mdash; Each icon button carries a specific <code>aria-label</code> (&ldquo;Delete project&rdquo;, &ldquo;Delete release&rdquo;, &ldquo;Remove member&rdquo;, &ldquo;Delete snapshot&rdquo;) and a matching <code>title</code> for hover tooltip + screen-reader announcement, so the loss of visible &ldquo;Delete&rdquo; text doesn&apos;t reduce discoverability for assistive tech</>,
    ],
  },
  {
    version: '17.0',
    date: 'April 26, 2026',
    items: [
      <><strong>Feature</strong> &mdash; New <strong>Cloud Storage</strong> modal opens from the header auth chip. Single click target across all three valid auth &times; storage states (signed-out + local, signed-in + local, signed-in + cloud). Replaces the prior in-chip <code>ConfirmDialog</code> popover and the Settings-tab detour for sign-in. Users can sign in, switch storage modes, edit Export Attribution, and toggle the local-storage warning &mdash; all from one dialog without leaving their current view</>,
      <><strong>Feature</strong> &mdash; Sign-in row uses native full-color Google and Microsoft logos (inline SVG) on a unified primary-blue background, matching the standardized SPERT&reg; Suite look</>,
      <><strong>Feature</strong> &mdash; Modal uses State 2 (signed-in + local) to expose a &ldquo;Keep using local storage&rdquo; secondary button so users who just signed in have a clear &ldquo;leave me on local&rdquo; action without needing to dismiss via &times; / Escape / backdrop</>,
      <><strong>UX</strong> &mdash; Sign-in error normalization in the modal: <code>auth/popup-closed-by-user</code> and <code>auth/cancelled-popup-request</code> are silent; <code>auth/popup-blocked</code> shows &ldquo;Allow pop-ups in your browser to sign in.&rdquo;; all others fall through to the standard <code>sanitizeFirebaseError</code> mapping</>,
      <><strong>UX</strong> &mdash; Identity card uses the new <code>normalizeDisplayName</code> helper so Microsoft Entra ID display names (returned as &ldquo;Last, First MI&rdquo;) render as &ldquo;First MI Last&rdquo; in the modal&apos;s account card. The chip&apos;s first-name segment continues to use the existing <code>getFirstName</code></>,
      <><strong>Refactor</strong> &mdash; Three prerequisite extractions land with the modal so Settings and the modal share a single source of truth: <code>UploadConfirmFlow</code> (radio-click upload + post-upload cleanup), <code>LocalStorageWarningToggle</code> (notifications checkbox + suppress-key write), and the <code>useSignInWithTosGate</code> hook (centralizes the load-bearing localStorage flag sequencing for Terms-of-Service consent)</>,
      <><strong>Architecture</strong> &mdash; <code>useSignInWithTosGate</code> lives in <code>src/shared/hooks/</code> rather than <code>src/features/settings/</code> because it&apos;s consumed by both a feature (SettingsTab) and a shared component (CloudStorageModal). Placing it in <code>features/</code> would invert layering &mdash; shared importing from feature</>,
      <><strong>Refactor</strong> &mdash; <code>StorageStatusChip</code> prop renamed <code>onSettingsClick</code> &rarr; <code>onOpenModal</code>. All popover, sign-out, and ConfirmDialog logic removed from the chip &mdash; it&apos;s now purely a click target. Settings tab retains its full cloud-storage section as a secondary entry point</>,
      <><strong>UX</strong> &mdash; Export Attribution input placeholders updated: name field shows &ldquo;e.g., Jane Smith&rdquo;; identifier placeholder typo fixed (&ldquo;e.g,&rdquo; &rarr; &ldquo;e.g.,&rdquo;)</>,
    ],
  },
  {
    version: '16.8',
    date: 'April 21, 2026',
    items: [
      <><strong>Fix</strong> &mdash; Saving a snapshot now captures any per-project legend label overrides that are active on the chart, not just the global labels from Settings. Previously, if a user customized legend labels while a project was selected (writing to the project-scope override introduced in v16.1), the snapshot froze the global baseline instead of what was actually on screen. Matches the precedence already used by the live chart rendering (<code>resolveLabel</code>)</>,
    ],
  },
  {
    version: '16.7',
    date: 'April 20, 2026',
    items: [
      <><strong>Fix</strong> &mdash; SnapshotBar chip row now scrolls horizontally with a standard vertical mouse wheel. On Windows, the browser did not reliably translate <code>deltaY</code> into horizontal scroll on containers whose only overflow axis is X, so users with many snapshots had no way to scroll back to newer chips without Shift-Wheel or a touchpad. A scoped native wheel listener redirects vertical wheel to <code>scrollLeft</code> only when the chip row is actually overflowing and the event has no horizontal component; touchpads with real <code>deltaX</code> still use native scroll</>,
      <><strong>Fix</strong> &mdash; Importing a JSON file with snapshots now updates the SnapshotBar immediately instead of requiring a page reload. The import path was writing snapshots directly to storage, bypassing the in-memory hook state. Now routed through <code>replaceAllSnapshots</code> so storage and state stay in sync</>,
      <><strong>Fix</strong> &mdash; Importing a legacy export with no <code>snapshots</code> key (or an empty snapshots array) now clears any pre-existing snapshots in storage. The replace-all import confirmation explicitly covers snapshots, but the previous code skipped the save when imported snapshots were absent, leaving orphaned snapshots under deleted project IDs</>,
    ],
  },
  {
    version: '16.6',
    date: 'April 19, 2026',
    items: [
      <><strong>Security</strong> &mdash; Centralized sign-out flow now clears all in-memory state (projects, releases, Export Attribution, legend labels, Prepared By, chart settings) on every sign-out path, including the ToS-version-mismatch auto-signout. Closes the multi-account data-leak vector on shared browsers</>,
      <><strong>Security</strong> &mdash; Pending cloud writes are cancelled (not flushed) at sign-out, rather than committing stale edits with about-to-be-revoked credentials</>,
      <><strong>Security</strong> &mdash; The switch-to-Cloud prompt now reads the project count from in-memory state instead of localStorage. Stale on-disk data from a previous user can no longer get silently uploaded to the current user&apos;s Firestore account</>,
      <><strong>UX</strong> &mdash; Header account pill now has a fourth state: signed-in-local. When you&apos;re signed in but haven&apos;t switched to Cloud storage, the pill shows your avatar, first name, and a lock icon. Clicking opens an account popover with &ldquo;Switch to Cloud Storage&rdquo;, &ldquo;Sign Out&rdquo;, and &ldquo;Cancel&rdquo;. Previously this state rendered as if you were signed out</>,
      <><strong>UX</strong> &mdash; Switching from Cloud to Local while signed in now prompts: &ldquo;Keep a local copy of your N cloud project(s)?&rdquo; with Keep Local Copy and Discard options. Previously the switch silently persisted cloud data to localStorage without asking</>,
      <><strong>UX</strong> &mdash; Microsoft accounts whose display name comes back as &ldquo;Last, First&rdquo; now render their first name correctly in both signed-in pill states. The name-extraction logic is a single shared utility, no duplication across branches</>,
      <><strong>Fix</strong> &mdash; Concurrent sign-in popup collisions (<code>auth/cancelled-popup-request</code>) now show a clear error message: &ldquo;Another sign-in is already in progress. Please complete or cancel it first.&rdquo;</>,
      <><strong>Fix</strong> &mdash; Removed the dead <code>ganttapp-has-uploaded-to-cloud</code> localStorage key. It was written but never read. A one-time migration removeItem runs during sign-out so existing users get their browser cleaned up</>,
      <><strong>Fix</strong> &mdash; Terms of Service acceptance Firestore write now retries on next sign-in if the initial write fails. Previously a transient network error would orphan the user&apos;s local &ldquo;accepted&rdquo; state from a missing Firestore record, causing re-consent prompts in other SPERT Suite apps</>,
      <><strong>Internal</strong> &mdash; Two new module-level registries (<code>signOutCleanupRegistry</code>, <code>appDataResetRegistry</code>) bridge the AuthContext/StorageContext/AppDataContext provider layers without violating React&apos;s provider ordering. <code>cancelPendingSaves()</code> added to the <code>GanttStorageService</code> interface</>,
    ],
  },
  {
    version: '16.5',
    date: 'April 17, 2026',
    items: [
      <><strong>Fix</strong> &mdash; Hid the horizontal scrollbar chrome on the snapshot chip bar (Gantt Chart tab) so it no longer visually overlays the bottom of the chip buttons when a project has many snapshots. Scrolling by drag/wheel/keyboard still works; partially-visible chips at the edge now signal overflow. Matches the pattern used in SPERT Scheduler v0.37.1</>,
    ],
  },
  {
    version: '16.4',
    date: 'April 17, 2026',
    items: [
      <><strong>Fix</strong> &mdash; The project form&apos;s Work Week selector now reflects the live global setting. Previously it showed a hardcoded Mon&ndash;Fri baseline when no project override was set, so changing the global work week in Settings had no visible effect on the Add Project form until the user explicitly created an override</>,
      <><strong>API</strong> &mdash; New optional <code>fallbackDays</code> prop on <code>WorkWeekSelector</code>. Caller can pass a fallback (e.g. the live global work days) that displays when <code>value</code> is undefined. Falls through to the hardcoded Mon&ndash;Fri only when both <code>value</code> and <code>fallbackDays</code> are absent</>,
      <><strong>Docs</strong> &mdash; Updated the Quick Reference Guide PDF (linked from the About tab). Content refreshed to reflect the current feature set</>,
    ],
  },
  {
    version: '16.3',
    date: 'April 16, 2026',
    items: [
      <><strong>Default</strong> &mdash; The global Work Week now defaults to Monday&ndash;Friday for all new users and for existing users who never configured one. Previously the feature was opt-in and silently did nothing until you picked days in Settings. You can still customize or override per project</>,
      <><strong>Feature</strong> &mdash; Non-workday warnings now appear everywhere dates are shown: the release list rows, project list rows next to Finish Date, and the Project Finish Date form field &mdash; not just while typing in the release form</>,
      <><strong>Feature</strong> &mdash; Chart date labels (Start, Early, Late, Most Likely) that fall on non-workdays render in amber bold with a hover tooltip explaining which day of the week the date lands on</>,
      <><strong>Feature</strong> &mdash; The inline chart date editor shows a non-workday warning beneath the input as you change a date, so you see the impact of your edit before saving</>,
      <><strong>UX</strong> &mdash; Updated the Settings &rarr; Work Week description to mention that new accounts start with Mon&ndash;Fri. Removed the &ldquo;not persisted until you change it&rdquo; placeholder copy since the default is now always persisted</>,
      <><strong>Data</strong> &mdash; First-time users get <code>globalWorkDays: [1,2,3,4,5]</code> persisted on first save. Existing users whose stored data omits <code>globalWorkDays</code> also receive the default on next save. Nothing overwrites an explicitly-configured work week</>,
    ],
  },
  {
    version: '16.2',
    date: 'April 16, 2026',
    items: [
      <><strong>Feature</strong> &mdash; New &ldquo;Default Legend Labels&rdquo; section in Settings lets you customize the five global chart legend defaults (Solid Bar, Hatched Bar, Project Finish Date, Most Likely Finish, In Progress). Closes the v16.1 UX gap where global defaults were unreachable once any project existed</>,
      <><strong>UX</strong> &mdash; Settings inputs start empty with the hardcoded defaults shown as placeholders. Clearing an input reverts to the placeholder default &mdash; no &ldquo;reset&rdquo; button needed. First-time users see placeholders until they type</>,
      <><strong>UX</strong> &mdash; Updated the chart legend scope hint to point to Settings &rarr; Default Legend Labels, so global-vs-project scope is discoverable from the legend itself</>,
      <><strong>UX</strong> &mdash; Removed italic styling on overridden legend labels. The &ldquo;&#8634;&rdquo; reset button is the sole visual indicator of an active project override. Mixed-italic legend rows looked inconsistent; all labels now share one font style</>,
      <><strong>UX</strong> &mdash; Per-project reset buttons and the scope hint are now excluded from the &ldquo;Copy Chart as Image&rdquo; capture (via the existing <code>copy-image-button</code> pattern)</>,
      <><strong>Data</strong> &mdash; State model change: uncustomized global labels are no longer stored literally. First-time users have no <code>legendLabels</code> entries in localStorage or Firestore until they customize. Existing customizations are unaffected; they continue to load and render identically to v16.1</>,
    ],
  },
  {
    version: '16.1',
    date: 'April 16, 2026',
    items: [
      <><strong>Feature</strong> &mdash; Per-project legend label overrides: each project can now have its own custom label text for Solid Bar, Hatched Bar, Project Finish Date, Most Likely Finish, and In Progress. Global labels remain the baseline and apply to any project that doesn&apos;t set its own override</>,
      <><strong>UX</strong> &mdash; In the chart legend, labels with project-scope overrides render in italic with a &ldquo;&#8634;&rdquo; reset button to revert to the global label. A one-line hint appears above the legend when a project is selected to clarify edit scope</>,
      <><strong>UX</strong> &mdash; Legend label edits save to the current project&apos;s scope when a project is selected. When no project is selected, edits save globally (existing behavior). Edit boxes open with the effective value &mdash; project override if present, otherwise global</>,
      <><strong>Data</strong> &mdash; Per-project labels persist in both local and cloud storage and round-trip through JSON export/import. Nothing breaks for existing data; projects without overrides behave identically to v16.0</>,
      <><strong>Resolver</strong> &mdash; New <code>resolveLabel</code> utility is the single source of truth for label precedence (snapshot &rarr; project override &rarr; global). Used by both the render path and the edit UI&apos;s starting value so the two can never disagree</>,
      <><strong>Risk mitigation</strong> &mdash; Firestore <code>contentChanged</code> diff check updated to compare <code>legendLabels</code>. Without this, a project label override change in cloud mode wouldn&apos;t trigger a Firestore write (same class as v12.5 reorder and v15.0 workDays bugs). Dedicated regression test added</>,
    ],
  },
  {
    version: '16.0',
    date: 'April 16, 2026',
    items: [
      <><strong>Feature</strong> &mdash; Added three-state release status: Not Started, In Progress, and Complete. Replaces the previous two-state completed toggle with a segmented control in the release list</>,
      <><strong>Feature</strong> &mdash; Added a customizable In Progress bar color to Chart Settings and all 10 color presets (default: amber)</>,
      <><strong>Feature</strong> &mdash; Added today&apos;s date label above the Today vertical line on the Gantt chart, using the line&apos;s color and formatted as a short date</>,
      <><strong>UX</strong> &mdash; In Progress legend entry appears on the chart when any release has In Progress status</>,
      <><strong>UX</strong> &mdash; The &ldquo;In Progress&rdquo; legend label is now editable in place, consistent with the Solid Bar, Hatched Bar, Project Finish Date, and Most Likely Finish labels</>,
      <><strong>UX</strong> &mdash; Legend entries reorder left-to-right to match status progression: Completed &rarr; In Progress &rarr; Not Started (solid + hatched) &rarr; vertical lines</>,
      <><strong>Migration</strong> &mdash; Existing releases with completed status are automatically migrated to the new Complete status on load. No manual action required. Snapshots are migrated at read time</>,
      <><strong>UX</strong> &mdash; Chart legend now wraps gracefully when many entries are visible (gap reduced, flex-wrap added)</>,
      <><strong>UX</strong> &mdash; Chart Settings color picker grid narrowed to fit the new In Progress swatch without adding a row</>,
    ],
  },
  {
    version: '15.3',
    date: 'April 15, 2026',
    items: [
      <><strong>Security</strong> &mdash; Sanitized Firestore-loaded snapshot names and release names in <code>firestoreSnapshotToFlat()</code> via <code>sanitizeString()</code>, matching the existing pattern in project and release converters</>,
      <><strong>Security</strong> &mdash; Replaced full error object logging with sanitized messages across 14 <code>console.error()</code> call sites (7 files); Firestore errors use <code>sanitizeFirebaseError()</code>, localStorage errors use <code>instanceof Error</code> guard</>,
      <><strong>Security</strong> &mdash; Added email format validation (<code>@</code> check) in ShareDialog before Firestore lookup for immediate user feedback on invalid input</>,
    ],
  },
  {
    version: '15.2',
    date: 'April 15, 2026',
    items: [
      <><strong>Refactor</strong> &mdash; Extracted <code>ReleaseFormFields</code> component from <code>ReleasesTab</code> (506 &rarr; 360 LOC), making the 5-field release form independently testable and reducing token cost for AI-assisted edits</>,
      <><strong>UX</strong> &mdash; Unbolded parenthetical text in &ldquo;Finish Date (Optional)&rdquo; and &ldquo;Work Week (Optional Override)&rdquo; labels for clearer visual hierarchy</>,
      <><strong>Code quality</strong> &mdash; Reviewed all post-v13.0 modules (WorkWeekSelector, WorkWeekSection, useSnapshots, SnapshotBar) &mdash; no issues found; all infrastructure dependencies audited against 60-day stability window</>,
    ],
  },
  {
    version: '15.1',
    date: 'April 15, 2026',
    items: [
      <><strong>UX</strong> &mdash; Moved the Save Snapshot and Delete Snapshot buttons to the left side of the snapshot bar so they are always visible without scrolling</>,
      <><strong>UX</strong> &mdash; Snapshots now sort newest-first so the most recent snapshot always appears immediately after &ldquo;Current&rdquo;</>,
      <><strong>Fix</strong> &mdash; Fixed horizontal scrollbar overlapping snapshot bar chips by adding padding for the scrollbar track</>,
      <><strong>Fix</strong> &mdash; Fixed cloud storage mode overwriting snapshots instead of accumulating them by using optimistic state updates</>,
    ],
  },
  {
    version: '15.0',
    date: 'April 15, 2026',
    items: [
      <><strong>Feature</strong> &mdash; Added a global work-week setting in the Settings tab &mdash; pick which days of the week count as workdays using a toggleable 7-chip selector (S&nbsp;M&nbsp;T&nbsp;W&nbsp;T&nbsp;F&nbsp;S)</>,
      <><strong>Feature</strong> &mdash; Added a per-project work-week override in the Project form, falling back to the global default when not set</>,
      <><strong>UX</strong> &mdash; Release date fields in the Releases tab now show an amber warning when a date falls outside your work week; saves are still allowed &mdash; warnings are informational</>,
      <><strong>Component</strong> &mdash; New <code>WorkWeekSelector</code> shared component: round day-chips with accessible labels (<code>aria-pressed</code>, <code>aria-label</code>), enforces at least one day selected</>,
      <><strong>Data</strong> &mdash; Work-week data persists in both local and cloud storage and round-trips through JSON export/import</>,
      <><strong>UX</strong> &mdash; Project form layout: work-week chips sit inline beside the finish date instead of on a separate row</>,
      <><strong>UX</strong> &mdash; Renamed &ldquo;Project Finish Date&rdquo; label to &ldquo;Finish Date&rdquo; and &ldquo;Export&rdquo; button to &ldquo;Export All&rdquo; for clarity</>,
      <><strong>Code quality</strong> &mdash; Fixed all pre-existing lint errors (8 issues across 6 files): removed stale eslint directives, converted effect-based derived state to render-time derivation, replaced setState-in-effect with lazy initializers where SSR-safe</>,
    ],
  },
  {
    version: '14.0',
    date: 'April 9, 2026',
    items: [
      <><strong>UX</strong> &mdash; Unified the header auth chip into a single click target. Clicking anywhere on the pill (avatar, name, or cloud icon) now opens an account popover when signed in to cloud storage</>,
      <><strong>UX</strong> &mdash; Account popover shows display name + email and exposes a Sign Out button directly from the header &mdash; no more navigating to Settings to sign out</>,
      <><strong>UX</strong> &mdash; Signed-out chip behavior unchanged: clicking anywhere on the pill opens the Settings tab to start the sign-in flow</>,
      <><strong>A11y</strong> &mdash; Chip is now a single <code>&lt;button&gt;</code> with <code>aria-haspopup</code>, <code>aria-expanded</code>, and a descriptive <code>aria-label</code>; Escape dismisses the popover</>,
      <><strong>Reliability</strong> &mdash; Sign Out uses a loading state with re-entry guards so the popover cannot be dismissed mid-await</>,
    ],
  },
  {
    version: '13.9',
    date: 'April 5, 2026',
    items: [
      <><strong>Legal</strong> &mdash; Updated Terms of Service and Privacy Policy to v04-05-2026</>,
      <><strong>Legal</strong> &mdash; Added SPERT&reg; AHP to list of covered apps</>,
      <><strong>Legal</strong> &mdash; Updated effective date to April 5, 2026</>,
    ],
  },
  {
    version: '13.8',
    date: 'April 4, 2026',
    items: [
      <><strong>UX</strong> &mdash; Added storage &amp; auth status chip in the upper-right header: shows a &quot;Local&quot; pill (with database icon) in local storage mode, and a user avatar initial + display name + cloud icon in cloud mode; clicking navigates to Settings</>,
    ],
  },
  {
    version: '13.7',
    date: 'April 2, 2026',
    items: [
      <><strong>UX</strong> &mdash; Added amber warning banner that appears on every app load when using local storage mode, reminding users to export their data; dismissible per session via &times;</>,
      <><strong>Settings</strong> &mdash; New &quot;Notifications&quot; section with a checkbox to permanently suppress the local storage warning banner (visible only in local storage mode)</>,
    ],
  },
  {
    version: '13.6',
    date: 'March 31, 2026',
    items: [
      <><strong>Legal</strong> &mdash; Updated Terms of Service and Privacy Policy to revised versions (effective March 31, 2026); existing Cloud Storage users will be prompted to re-accept on next sign-in</>,
      <><strong>Legal</strong> &mdash; Updated canonical legal document URLs to spertsuite.com</>,
      <><strong>UI</strong> &mdash; Updated consent UI text to SPERT&reg; Suite branding</>,
      <><strong>UI</strong> &mdash; Added License link to footer (links to GitHub LICENSE file)</>,
    ],
  },
  {
    version: '13.5',
    date: 'March 24, 2026',
    items: [
      <><strong>UX</strong> &mdash; Clicking Edit on a release now shows the edit form inline below that release instead of scrolling to the top of the page</>,
      <><strong>Chart</strong> &mdash; New &quot;Show Months&quot; toggle in Chart Settings displays abbreviated month labels and thin separator lines on the Gantt chart</>,
      <><strong>Chart</strong> &mdash; Renamed &quot;Show Project Finish Date&quot; to &quot;Show Finish Date&quot; in Chart Settings</>,
      <><strong>Export</strong> &mdash; JSON export filename changed from &quot;gantt-data&quot; to &quot;ganttapp-export&quot; prefix</>,
      <><strong>UI</strong> &mdash; Improved footer spacing between copyright row and legal links</>,
    ],
  },
  {
    version: '13.4',
    date: 'March 20, 2026',
    items: [
      <><strong>Legal</strong> &mdash; Updated Terms of Service and Privacy Policy to revised versions (effective March 20, 2026); existing Cloud Storage users will be prompted to re-accept on next sign-in</>,
    ],
  },
  {
    version: '13.3.1',
    date: 'March 16, 2026',
    items: [
      <><strong>UX</strong> &mdash; Updated first-run notification to clarify browsewrap agreement to Terms of Service and Privacy Policy</>,
    ],
  },
  {
    version: '13.3',
    date: 'March 11, 2026',
    items: [
      <><strong>Infrastructure</strong> &mdash; Pinned Node.js target to v22 LTS: added <code>engines</code> field to package.json, created <code>.nvmrc</code>, and updated <code>@types/node</code> to ^22 ahead of Node 20 EOL (April 30, 2026)</>,
    ],
  },
  {
    version: '13.2',
    date: 'March 11, 2026',
    items: [
      <><strong>Security</strong> &mdash; Added <code>sanitizeString()</code> to inline chart editing (release names and legend labels) for defense-in-depth consistency</>,
      <><strong>Security</strong> &mdash; Sanitized Firestore-loaded project and release names in converters, matching the localStorage validation path</>,
      <><strong>Security</strong> &mdash; Removed user email interpolation from sharing error messages to prevent information leakage</>,
      <><strong>Security</strong> &mdash; Sanitized raw Firestore error in cloud mode-switch re-thrown error via <code>sanitizeFirebaseError()</code></>,
      <><strong>Security</strong> &mdash; Added <code>maxLength</code> to project name, release name, and share email inputs for consistent client-side length limits</>,
      <><strong>Security</strong> &mdash; Applied <code>sanitizeString()</code> to share email and duplicate release name at point of entry</>,
    ],
  },
  {
    version: '13.1',
    date: 'March 11, 2026',
    items: [
      <><strong>Improvement</strong> &mdash; Replaced all remaining <code>window.confirm()</code> calls with styled <code>ConfirmDialog</code> component for consistent UX across project delete, release delete, member removal, and snapshot delete</>,
      <><strong>Improvement</strong> &mdash; Updated dependencies to latest within semver ranges: firebase 12.10.0, eslint 9.39.4, @types/react 19.2.14, @vitejs/plugin-react 5.1.4, firebase-tools 15.9.1</>,
    ],
  },
  {
    version: '13.0',
    date: 'March 11, 2026',
    items: [
      <><strong>Legal</strong> &mdash; Added Terms of Service and Privacy Policy links to persistent footer (browsewrap notice)</>,
      <><strong>Feature</strong> &mdash; First-run informational banner for new users (dismissible, non-blocking)</>,
      <><strong>Feature</strong> &mdash; Clickwrap consent modal required before enabling Cloud Storage (checkbox + agreement links)</>,
      <><strong>Feature</strong> &mdash; ToS acceptance recorded in Firestore (<code>users/{'&#123;uid&#125;'}</code>) for returning-user version verification</>,
      <><strong>Improvement</strong> &mdash; Centralized version constants in <code>src/lib/version.ts</code> (APP_VERSION, TOS_VERSION, APP_ID)</>,
    ],
  },
  {
    version: '12.6',
    date: 'March 9, 2026',
    items: [
      <><strong>Improvement</strong> &mdash; Added copyright headers to all 117 human-authored source files (GNU GPL v3 attribution)</>,
      <><strong>Improvement</strong> &mdash; Strengthened LICENSE file with author attribution block and Section 7 additional terms (Attribution Preservation, UI Notice Preservation)</>,
    ],
  },
  {
    version: '12.5',
    date: 'March 9, 2026',
    items: [
      <><strong>Bug Fix</strong> &mdash; Drag-and-drop release reordering now persists to Firestore in cloud mode (was silently lost on reload because diff-based saves only checked content fields, not array position)</>,
      <><strong>Bug Fix</strong> &mdash; Drag-and-drop project reordering now persists to Firestore in cloud mode (added <code>order</code> field to project documents)</>,
    ],
  },
  {
    version: '12.4',
    date: 'March 8, 2026',
    items: [
      <><strong>Docs</strong> &mdash; Added Quick Start Guide section to the About tab with a downloadable PDF covering project creation, releases, chart reading, and snapshots</>,
    ],
  },
  {
    version: '12.3',
    date: 'March 8, 2026',
    items: [
      <><strong>Bug Fix</strong> &mdash; Cloud sync no longer replaces local data with empty cloud results &mdash; guards added to both initial load and real-time sync to prevent silent data loss</>,
      <><strong>Bug Fix</strong> &mdash; &ldquo;Skip &mdash; Connect Without Uploading&rdquo; replaced with &ldquo;Cancel&rdquo; that stays in local mode, preventing data loss when cloud has no data</>,
      <><strong>UX</strong> &mdash; Cancelling the upload prompt during re-sign-in now reverts stored mode to local instead of switching to cloud without data</>,
    ],
  },
  {
    version: '12.2',
    date: 'February 22, 2026',
    items: [
      <><strong>Security</strong> &mdash; Firebase error messages are now sanitized before display, preventing internal details (project IDs, collection paths) from leaking to the UI</>,
      <><strong>Security</strong> &mdash; Project <code>owner</code> field from Firestore is now sanitized with <code>sanitizeId()</code> to prevent injection of control characters or oversized strings</>,
      <><strong>Security</strong> &mdash; User profile data (displayName, email) is now sanitized with <code>sanitizeString()</code> before writing to Firestore (defense-in-depth)</>,
      <><strong>Security</strong> &mdash; Project names in error messages are now sanitized to prevent control character injection</>,
      <><strong>Tests</strong> &mdash; Added 10 new security tests: sanitizeFirebaseError (6), owner sanitization (2), StorageContext error handling (2). Total: 696 tests across 45 files</>,
    ],
  },
  {
    version: '12.1',
    date: 'February 22, 2026',
    items: [
      <><strong>Bug Fix</strong> &mdash; &ldquo;Skip &mdash; Connect Without Uploading&rdquo; now correctly connects to cloud without uploading local data (was triggering upload)</>,
      <><strong>Bug Fix</strong> &mdash; Skipping the upload prompt now persists the cloud mode preference (was re-prompting on every reload)</>,
      <><strong>Bug Fix</strong> &mdash; Fixed <code>as any</code> type cast in cloud storage service (now uses proper <code>FirestoreSnapshot</code> type)</>,
      <><strong>Refactor</strong> &mdash; Created shared <code>ConfirmDialog</code> component for inline and modal confirmation dialogs, reducing code duplication across StorageSection and ProjectsTab</>,
      <><strong>Tests</strong> &mdash; Added 47 new tests: ConfirmDialog (13), StorageSection (30), StorageContext (4). Total: 686 tests across 45 files</>,
    ],
  },
  {
    version: '12.0',
    date: 'February 22, 2026',
    items: [
      <><strong>Architecture</strong> &mdash; Cloud is now the source of truth: switching to local no longer downloads cloud data (one-way upload only)</>,
      <><strong>Feature</strong> &mdash; Existence-based dedup: re-uploading projects that already exist in the cloud are automatically skipped, preventing duplicates</>,
      <><strong>Feature</strong> &mdash; Post-upload cleanup dialog prompts users to clear local copies after successful cloud upload</>,
      <><strong>Feature</strong> &mdash; Smart re-sign-in: detects local projects on cloud mode restoration and prompts to upload or skip</>,
      <><strong>Feature</strong> &mdash; &ldquo;Download All Projects as JSON&rdquo; button in cloud mode for backup and portability</>,
      <><strong>UX</strong> &mdash; Sign-out no longer downloads data &mdash; flushes pending writes and switches to local mode cleanly</>,
      <><strong>Robustness</strong> &mdash; Network errors during upload are surfaced to the user instead of silently creating duplicate projects</>,
    ],
  },
  {
    version: '11.3',
    date: 'February 21, 2026',
    items: [
      <><strong>UX</strong> &mdash; Cloud storage radio button now disabled until user signs in (was showing an error after click)</>,
      <><strong>UX</strong> &mdash; Sign-in buttons moved into the Storage section with helper text &ldquo;Sign in to enable cloud storage and sharing&rdquo;</>,
      <><strong>Refactor</strong> &mdash; AccountSection merged into StorageSection for a more intuitive settings layout</>,
    ],
  },
  {
    version: '11.2',
    date: 'February 20, 2026',
    items: [
      <><strong>Security</strong> &mdash; Sharing functions now enforce owner-only access (prevents editors from adding/removing project members)</>,
      <><strong>Security</strong> &mdash; All user text inputs sanitized at point of entry via <code>sanitizeString()</code> (project names, release names, snapshot names, export attribution, Prepared By)</>,
      <><strong>Security</strong> &mdash; HTTP security headers added: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy</>,
      <><strong>UI</strong> &mdash; Share button now only visible to project owners in cloud mode</>,
      <><strong>UI</strong> &mdash; Export attribution inputs now have <code>maxLength</code> enforcement</>,
    ],
  },
  {
    version: '11.1',
    date: 'February 20, 2026',
    items: [
      <><strong>Bug Fix</strong> &mdash; export attribution now persists correctly in cloud mode (was lost on save/load)</>,
      <><strong>Bug Fix</strong> &mdash; &ldquo;Prepared By&rdquo; field can now be cleared to empty in cloud mode</>,
      <><strong>Bug Fix</strong> &mdash; changing export attribution now triggers cloud save</>,
      <><strong>Refactor</strong> &mdash; ChangelogTab converted to data-driven rendering (512 &rarr; ~50 LOC component + data file)</>,
      <><strong>Refactor</strong> &mdash; FirestoreGanttStorageService decomposed into focused modules (559 &rarr; ~280 LOC)</>,
      <><strong>Refactor</strong> &mdash; StorageContext switchMode logic extracted to standalone functions (217 &rarr; 105 LOC)</>,
      <><strong>Refactor</strong> &mdash; SettingsTab split into StorageSection, AccountSection, and ExportAttributionSection sub-components</>,
      '35 new tests across 2 new test files; total test count: 616 across 40 files',
    ],
  },
  {
    version: '11.0',
    date: 'February 20, 2026',
    items: [
      <><strong>Cloud Storage</strong> &mdash; optional Firebase/Firestore backend with Google and Microsoft SSO authentication</>,
      <><strong>Settings Tab</strong> &mdash; new tab for storage mode selection, account management, and export attribution</>,
      <><strong>Real-Time Sync</strong> &mdash; changes sync across devices and tabs in cloud mode via Firestore onSnapshot</>,
      <><strong>Project Sharing</strong> &mdash; share projects with team members as owner, editor, or viewer (cloud mode)</>,
      <><strong>Export Attribution</strong> &mdash; exported JSON now includes preparer name, identifier, and timestamp</>,
      <><strong>Academic Integrity</strong> &mdash; cloud projects track origin references and change logs (up to 50 entries per project)</>,
      'Local/cloud mode switching with automatic data migration in both directions',
      'Firestore security rules for project-level access control',
      'About page updated with dual-storage documentation',
      'All chart display settings are per-user (personal preferences, even on shared projects)',
    ],
  },
  {
    version: '10.0',
    date: 'February 20, 2026',
    items: [
      <><strong>Storage Abstraction Layer</strong> — internal refactoring to support future cloud storage, with zero functional changes</>,
      'Introduced StorageDriver and GanttStorageService interfaces for pluggable storage backends',
      'All data persistence now routes through a storage service instead of direct localStorage calls',
      'Added Firebase SDK (conditionally initialized, inactive until cloud mode is enabled in a future release)',
      'New StorageContext provides storage service to all components via React context',
      'Theme preference continues to use localStorage directly (unaffected by storage mode)',
      '37 new tests added (497 total, up from 459) covering storage driver, service, and context',
      'All 497 tests pass, production build succeeds, zero functional changes for users',
    ],
  },
  {
    version: '9.0',
    date: 'February 16, 2026',
    items: [
      <><strong>Import Warning Dialog</strong> — importing now shows a confirmation dialog when existing data would be replaced</>,
      <><strong>Customizable Completed Release Color</strong> — completed releases now use a configurable color instead of hardcoded green</>,
      <><strong>Completed Release Solid Bar</strong> — completed releases render as a single solid bar from start to late finish (no hatching, since there is no uncertainty for delivered releases)</>,
      <>New &ldquo;Completed&rdquo; color picker in Chart Settings (always visible)</>,
      'All 10 color presets updated with Completed Bar color (default: light green #90ee90)',
      <>Chart Settings color picker labels shortened for cleaner layout (e.g., &ldquo;Solid Bar&rdquo; instead of &ldquo;Solid Bar Color&rdquo;)</>,
      'Color picker grid now uses flexible layout to accommodate 5-6 pickers dynamically',
      'Backwards compatible: new completedBar field defaults gracefully for existing data',
    ],
  },
  {
    version: '8.0',
    date: 'February 13, 2026',
    items: [
      <><strong>Most Likely Finish Date</strong> — optional per-release date field rendered as a vertical line within the hatched bar</>,
      <>New optional date input on the Releases tab: &ldquo;Most Likely Finish Date (Optional)&rdquo;</>,
      'Validation ensures the Most Likely date falls between the Early and Late Finish dates',
      <>Toggle in Chart Settings: &ldquo;Show Most Likely Finish&rdquo; controls visibility for all releases</>,
      'Configurable line color via new color picker (only shown when toggle is on)',
      'Click-to-edit inline on the chart — same UX pattern as Start, Early, and Late dates',
      <>Editable legend entry: &ldquo;Most Likely Finish&rdquo; (shown when toggle on and at least one release has the date)</>,
      'Smart label suppression: ML date label hidden when too close to Start, Early, or Late labels (40px threshold)',
      'Line uses the existing Vertical Line Width setting for consistent appearance',
      'All 10 color presets updated with Most Likely Line color (defaults to hatched bar color per preset; red for Grayscale for visibility)',
      'Snapshots capture Most Likely data per-release, line color, and legend label',
      'Export/Import fully supports the new field with sanitization and validation',
      '35 new tests added (428 total, up from 393) — all passing',
      'Backwards compatible: all new fields are optional with defaults, no migration needed',
      <><strong>Post-release refactoring:</strong> 7 bug fixes (showTodayLine persistence, deprecated onKeyPress, dark mode preset buttons, empty label rejection, ML cross-validation), DRY improvements (shared validateReleaseDateChange, formatDateLocale utility), 19 additional tests (447 total)</>,
    ],
  },
  {
    version: '7.1',
    date: 'February 9, 2026',
    items: [
      <><strong>Codebase Refactoring</strong> — improved maintainability, readability, and test coverage with zero functional changes</>,
      'Eliminated ~140 lines of duplicated validation code across storage, export, and snapshot utilities (DRY)',
      'Wired up useChartCalculations hook as single source of truth for chart math (fixed stale constants)',
      'Reduced GanttChart props from 52 individual to 9 grouped props for cleaner component API',
      'Extracted ChartReleaseBar component from GanttChart (120 lines → self-contained, testable component)',
      'Extracted useEffectiveChartProps hook for snapshot vs live data resolution',
      'Fixed barrel export gap for useKeyboardShortcuts hook',
      'Added 66 new tests across 6 new test files: useSnapshots, SnapshotBar, ChartLegend, ChartSettings, ChartReleaseBar, useEffectiveChartProps',
      'Test suite expanded from 327 to 393 tests (28 test files)',
      'All 393 tests pass, production build succeeds, type-check clean',
    ],
  },
  {
    version: '7.0',
    date: 'February 9, 2026',
    items: [
      <><strong>Release Plan Snapshots</strong> — save read-only historical records of your release plan after each sprint review</>,
      'Chip navigation bar above the chart to toggle between Current and saved snapshots',
      <>One-click snapshot creation with optional custom name (defaults to today&apos;s date)</>,
      'Snapshots capture releases, chart colors, legend labels, project finish date, and Prepared By',
      'Historical snapshots are fully read-only — inline editing of names, dates, and legend labels is disabled',
      'Date Prepared is frozen to the snapshot timestamp for historical accuracy',
      'Read-only banner appears below the chart to avoid layout shift when toggling',
      'Delete old snapshots you no longer need (with confirmation)',
      'Snapshots cascade-delete when their parent project is deleted',
      'Export/Import now includes snapshots — share full history via JSON',
      'Snapshots stored in separate localStorage key for data isolation',
      'Added Prepared By field in Chart Settings with show/hide toggle',
      'Security: full validation and sanitization for all snapshot data on load and import',
      'Limits: 100 total snapshots, 50 per project, 2MB storage cap',
    ],
  },
  {
    version: '6.1',
    date: 'February 7, 2026',
    items: [
      <><strong>Row Spacing Control</strong> — new S/M/L setting to tighten or loosen space between release rows</>,
      'Defaults to Medium; Small tightens rows, Large matches previous spacing',
      'Bar Height now uses compact S/M/L labels to fit both controls on one row',
      'Independent of bar height — adjust spacing without changing bar size',
    ],
  },
  {
    version: '6.0',
    date: 'February 6, 2026',
    items: [
      <><strong>Click-to-Edit Dates on Chart</strong> — click any date label below a bar to edit it inline</>,
      'Date picker appears directly on the chart for quick date adjustments',
      'Validates date ordering in real-time (start < early finish ≤ late finish)',
      'Chart automatically rescales when dates change',
      'Same intuitive pattern as release name editing',
      <><strong>Configurable Bar Height</strong> — Small/Medium/Large options in Chart Settings</>,
      'Larger bars look better when displaying fewer releases',
    ],
  },
  {
    version: '5.7',
    date: 'February 6, 2026',
    items: [
      <><strong>Productivity Release</strong> — duplicate release, keyboard shortcuts, and dark mode</>,
      'Added Duplicate Release button — one-click release cloning with dates shifted forward',
      'Added keyboard shortcuts: Escape to cancel edits, Ctrl/Cmd+S to save forms, arrow keys for tab navigation',
      'Added Dark Mode with system preference detection (light/dark/system toggle)',
      'Theme persists to localStorage separately from app data',
      'All components updated with theme-aware styling',
    ],
  },
  {
    version: '5.6',
    date: 'February 3, 2026',
    items: [
      <><strong>Security Hardening Release</strong> — comprehensive input validation and sanitization</>,
      'Added sanitizeString() and sanitizeId() functions to remove control characters and limit lengths',
      'Added isValidHexColor() and sanitizeColor() for strict color input validation',
      'Enhanced data import with full sanitization of all string fields (projects, releases, labels)',
      'Added file size limit (1MB) and array limits (50 projects, 500 releases) to prevent DoS via imports',
      'Added date format validation on imported release dates (rejects invalid calendar dates)',
      'Added whitelist validation for display settings (font sizes, colors, line widths)',
      'Added whitelist validation for color preset names',
      'Enhanced localStorage loading with full data validation (defense-in-depth)',
      'All imported/loaded IDs now sanitized to alphanumeric + hyphens only (safe for SVG pattern IDs)',
      'npm audit: 0 vulnerabilities maintained',
    ],
  },
  {
    version: '5.5',
    date: 'February 2, 2026',
    items: [
      'Upgraded Next.js from 15.5.11 to 16.1.6 (major version upgrade)',
      'Turbopack is now the default bundler (faster builds)',
      'Removed ESLint bridge packages (@eslint/compat, @eslint/eslintrc, @eslint/js) — eslint-config-next@16 exports native flat config',
      'Simplified eslint.config.mjs to use native Next.js 16 flat config directly',
      'Removed obsolete eslint config block from next.config.js',
      'Refactored project auto-selection from useEffect to computed value (fixes react-hooks/set-state-in-effect lint rule)',
      'Removed unused useEffect import from main page',
      'npm audit: 0 vulnerabilities — fully JFrog scan ready',
      'All 288 tests pass, build succeeds, lint clean',
    ],
  },
  {
    version: '5.4',
    date: 'February 2, 2026',
    items: [
      'Upgraded Next.js from 14.2.35 to 15.5.11 (major version upgrade)',
      'Upgraded React from 18 to 19 and React DOM from 18 to 19',
      'Updated @types/react and @types/react-dom to v19',
      'Migrated Context.Provider to React 19 direct Context syntax',
      'Aligned eslint-config-next to 15.5.11 to match Next.js version',
      'Resolved all Next.js 14 CVEs (GHSA-h25m, GHSA-9g9p) by upgrading to 15.x',
      'All 288 tests pass on React 19 with zero code changes required',
    ],
  },
  {
    version: '5.3',
    date: 'February 2, 2026',
    items: [
      'Upgraded ESLint from v8 to v9 to resolve moderate security vulnerability (GHSA-p5wg)',
      'Upgraded eslint-config-next from 14.0.4 to 15.1.7 for ESLint 9 compatibility',
      'Migrated to ESLint flat config format (eslint.config.mjs) for forward compatibility',
      'Added ESLint bridge packages (@eslint/js, @eslint/eslintrc, @eslint/compat)',
      'Fixed 21 unescaped entity lint errors across JSX components',
      <>Changed lint command from &ldquo;next lint&rdquo; to &ldquo;eslint .&rdquo; for ESLint 9 support</>,
      'Reduced npm audit vulnerabilities from 5 to 1 (remaining: Next.js CVE that does not apply to Pages Router)',
    ],
  },
  {
    version: '5.2',
    date: 'February 1, 2026',
    items: [
      'Expanded automated test suite from 157 to 288 tests across 19 test files',
      'Added tests for useProjects hook: CRUD operations, form state, cascade delete (23 tests)',
      'Added tests for useReleases hook: CRUD operations, validation, toggle operations (27 tests)',
      'Added tests for ProjectsTab component: rendering, form, edit/delete, navigation, validation (20 tests)',
      'Added tests for ReleasesTab component: rendering, project selection, form, toggles (18 tests)',
      'Added tests for UI components: Tabs, DragHandle, ColorSwatchPicker, GrayscaleSwatchPicker, PresetButtonGroup (34 tests)',
      'Added tests for static pages: AboutTab and ChangelogTab (9 tests)',
    ],
  },
  {
    version: '5.1',
    date: 'January 29, 2026',
    items: [
      'Added automated test suite with 157 tests across 8 test files (Vitest + React Testing Library)',
      'Fixed date validation bug: invalid calendar dates (e.g., Feb 30, Month 13) are now rejected',
      'Fixed timezone inconsistency: date comparisons now use local timezone consistently',
      'Fixed potential ID collision by replacing Date.now() with unique ID generator',
      'Improved data import validation: projects and releases are now schema-validated on import',
      'Fixed chart rendering edge case when all release dates are identical',
      'Consolidated duplicate localStorage save effects in state management',
      'Removed unused useLocalStorage hook (dead code cleanup)',
      'Fixed date input placeholder styling: empty inputs show mm/dd/yyyy in light gray, entered values in dark color',
      'Copy chart as image button now excluded from captured images',
      <>Improved inline &ldquo;Releases for&rdquo; dropdown styling on Releases tab</>,
    ],
  },
  {
    version: '5.0',
    date: 'January 22, 2026',
    items: [
      'Complete architectural refactoring to Feature Modules pattern',
      'Extracted utilities, types, and components for better maintainability',
      'Reduced token usage for AI-assisted development by 75-85%',
      'Improved code organization with feature-based folder structure',
      'Created centralized context for state management',
      'All features work identically - zero functional changes for users',
    ],
  },
  {
    version: '4.4',
    date: 'January 21, 2026',
    items: [
      'Enhanced Chart Settings with configurable display options',
      'Added Release Name Font Size control: Small (14px), Medium (16px), or Large (18px)',
      'Added Date Label Font Size control: Small (9px), Medium (11px), or Large (13px)',
      'Added Date Label Color control: grayscale swatches from light gray to black for better contrast',
      <>Added Vertical Line Width control: Thin (2px), Medium (3px), or Thick (4px) for Today&apos;s Date and Project Finish Date lines</>,
      'Increased left margin space for release names and optimized chart layout',
      'All display settings persist to localStorage and survive export/import',
    ],
  },
  {
    version: '4.3',
    date: 'January 21, 2026',
    items: [
      'Added release visibility toggle: hide releases from chart while keeping them in the list',
      'Added completion status: mark releases as done to render them in green',
      <>Enhanced Releases tab with &ldquo;Show&rdquo; checkbox and &ldquo;Mark Done&rdquo; button for each release</>,
      'Completed releases display in light green (solid) and forest green (hatched)',
    ],
  },
  {
    version: '4.2',
    date: 'January 20, 2026',
    items: [
      'Added optional project finish date field (Projects tab)',
      <>Renamed &ldquo;Chart Color Settings&rdquo; to &ldquo;Chart Settings&rdquo;</>,
      'Moved chart display toggles to Chart Settings section (cleaner exported images)',
      'Added project finish date vertical line visualization (bright green by default)',
      'Added quarter labels (Q2, Q3, Q4) to timeline above vertical gridlines',
      'Enhanced Chart Settings with toggle controls and finish date color picker',
    ],
  },
  {
    version: '4.1',
    date: 'January 20, 2026',
    items: [
      <>Removed &ldquo;Gantt Chart:&rdquo; label prefix from chart display (project name only)</>,
      'Added collapsible color settings section (collapsed by default)',
      'Made legend labels editable with localStorage persistence',
      <>Enhanced About page formatting (bolded &ldquo;GanttApp&rdquo; in description)</>,
    ],
  },
  {
    version: '4.0',
    date: 'January 19, 2026',
    items: [
      'Revert from Firebase to localStorage for better data persistence',
      'While Firebase provided cloud storage, anonymous authentication sessions expired unpredictably',
      'localStorage puts users in control - data persists until they choose to clear their browser cache',
      'Export/Import feature provides reliable backup mechanism',
    ],
  },
  {
    version: '3.5',
    date: 'January 19, 2026',
    items: [
      'Add configurable chart colors with preset themes',
      <>Users can now customize solid bar, hatched bar, and today&apos;s line colors</>,
      'Includes preset color themes: Classic Blue, Ocean Green, Purple Haze, Sunset Orange, Ruby Red',
    ],
  },
  {
    version: '3.4',
    date: 'January 19, 2026',
    items: [
      'Add intelligent label hiding on Gantt chart to prevent overlapping date labels',
    ],
  },
  {
    version: '3.3',
    date: 'January 19, 2026',
    items: [
      'Add real-time validation for project names, release names, and date logic',
    ],
  },
  {
    version: '3.2',
    date: 'January 19, 2026',
    items: [
      'Add Change Log accessible via footer link',
    ],
  },
  {
    version: '3.1',
    date: 'January 18, 2026',
    items: [
      'Fix timezone bug in date display',
    ],
  },
  {
    version: '3.0',
    date: 'January 18, 2026',
    items: [
      'Initial release with Firebase integration',
      'Project and release management',
      'Gantt chart visualization with uncertainty ranges',
    ],
  },
  {
    version: '2.1',
    date: 'January 17, 2026',
    items: [
      'Add copyright footer and GNU GPL v3 license',
    ],
  },
  {
    version: '2.0',
    date: 'January 17, 2026',
    items: [
      'Add Export/Import functionality and copy chart as image',
    ],
  },
  {
    version: '1.0',
    date: 'January 17, 2026',
    items: [
      'Initial release with localStorage, Projects, Releases, and Gantt chart',
    ],
  },
];
