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
      <><strong>Feature</strong> &mdash; ToS acceptance recorded in Firestore (<code>users/{'{uid}'}</code>) for returning-user version verification</>,
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
