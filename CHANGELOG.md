# Change Log

## Version 16.7 (2026-04-20)
### SnapshotBar Mouse-Wheel Scroll + Snapshot Import Stale State

Two independent snapshot-bar fixes shipped together.

**Issue A — SnapshotBar horizontal mouse-wheel scroll:**
- On Windows with a standard vertical-wheel mouse, Chromium-family browsers did not reliably translate `deltaY` into horizontal scroll on containers whose only overflow axis is X. Users with many snapshots had no way to scroll back to newer chips without Shift-Wheel, a horizontal trackpad gesture, or clicking a partially-visible chip
- Fix: scoped native `wheel` listener on the `.snapshot-bar-scroll` viewport in `SnapshotBar.tsx`. When the container has horizontal overflow (`scrollWidth > clientWidth`) and the event has no horizontal component (`deltaX === 0`), redirects `deltaY` into `scrollLeft` and calls `preventDefault()` to stop the page from scrolling vertically
- Touchpad two-finger horizontal swipes (which emit real `deltaX`) are not intercepted — native horizontal scroll continues to handle them
- Uses a native `addEventListener('wheel', ..., { passive: false })` (not React's synthetic `onWheel`, which is passive by default and where `preventDefault()` is a no-op). Cleanup registered via `removeEventListener` in the effect return

**Issue B — Snapshot import stale state:**
- The import path in `applyImport` was calling `storage.saveSnapshots` directly, bypassing the `useSnapshots` hook entirely. Snapshots were persisted correctly but the in-memory `allSnapshots` state stayed stale, so the SnapshotBar UI did not reflect the imported snapshots until a page reload
- Fix: `ProjectsTab` now accepts an `onReplaceSnapshots` prop; `pages/index.tsx` passes `snapshotState.replaceAllSnapshots` (which was already built for exactly this purpose but had zero call sites). Storage and in-memory state now update atomically
- Orphan-snapshot fix: when the imported file has no `snapshots` key or an empty array, the code now explicitly clears existing snapshots (`replaceAllSnapshots([])`) rather than skipping the save. The import confirmation modal already authorizes replacement of all data including snapshots, so this aligns behavior with the modal text. Pre-v7.0 exports and legacy backups behave consistently

**Modified files:**
- Chart: `src/features/chart/SnapshotBar.tsx` (ref + wheel effect), `src/features/chart/__tests__/SnapshotBar.test.tsx` (+4 tests)
- Projects: `src/features/projects/ProjectsTab.tsx` (new `onReplaceSnapshots` prop, updated `applyImport`), `src/features/projects/__tests__/ProjectsTab.test.tsx` (+3 tests, updated `renderProjectsTab` default)
- Entry: `pages/index.tsx` (thread `snapshotState.replaceAllSnapshots` to `<ProjectsTab>`)
- Version and docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`

**Protected-file discipline:** `GanttChart.tsx`, `firestore-save-executor.ts`, `validation.ts`, `styles/globals.css` all have zero edits — verified via `git diff`.

**Tests:** 974 tests passing (up from 967 in v16.6), +7 net new. All gates green (tsc, test, lint, build).

---

## Version 16.6 (2026-04-19)
### Auth/Storage Security Audit Wave

**Security:**
- Centralized sign-out flow clears all in-memory AppData state (projects, releases, Export Attribution, legend labels, Prepared By, chart settings) on every sign-out path, including ToS-version-mismatch auto-signout. Closes the multi-account data-leak vector on shared browsers (findings A1-a, D4)
- Pending cloud writes are now cancelled (not flushed) at sign-out via new `cancelPendingSaves()` method, instead of committing stale edits with about-to-be-revoked credentials (A3)
- The switch-to-Cloud upload prompt now reads project count from AppDataContext in-memory state instead of directly from localStorage. Stale on-disk data from a previous user can no longer get silently uploaded to the current user's Firestore account (C3)
- ToS-version-mismatch auto-signout in AuthContext routes through the same centralized cleanup as user-initiated sign-out via a module-level callback registry (A6)
- Data-loss guard in AppDataContext now safely interacts with the centralized clear — previously it could preserve user A's data across a sign-out boundary (A1-b, C2)

**UX:**
- Header account pill gains a fourth state: **signed-in + local**. Avatar + first name + lock icon when the user is signed in but hasn't switched to Cloud. Clicking opens an account popover with "Switch to Cloud Storage" (navigates to Settings), "Sign Out", and "Cancel" (F2-d)
- Cloud→Local mode switch (while signed in with in-memory projects) now prompts: "Keep a local copy of your N cloud project(s)?" with **Keep Local Copy** and **Discard** buttons. Previously the switch silently persisted cloud data to localStorage (C4)
- Microsoft accounts whose display name comes back as "Last, First" now render their first name correctly in both signed-in pill states. Name-extraction logic extracted to `src/shared/utils/displayName.ts` as a shared single source of truth

**Fixes:**
- Concurrent sign-in popup collisions (`auth/cancelled-popup-request`) now show a clear message: "Another sign-in is already in progress. Please complete or cancel it first." (D1). Single-case surgical addition to `sanitizeFirebaseError` — 2 lines added, 0 deleted, no other edits to `validation.ts`
- Dead `ganttapp-has-uploaded-to-cloud` localStorage key removed. It was written but never read. A one-time migration `removeItem` runs during sign-out so existing v16.5 users get their browser cleaned up (E4)
- Terms of Service acceptance Firestore write now retries on next sign-in if the initial write fails. Previously a transient network error orphaned the user's local "accepted" state from a missing Firestore record, causing re-consent prompts in other SPERT Suite apps (TOS-WRITE-ORPHAN)

**Internal:**
- Two new module-level registries (`signOutCleanupRegistry`, `appDataResetRegistry`) bridge the AuthContext/StorageContext/AppDataContext provider layers without violating React's provider ordering. `AuthContext` can invoke `runSignOutCleanup()` from the ToS-failure path without importing `useStorage()`, and StorageContext's `performSignOutWithCleanup` can invoke `runAppDataReset()` without importing `useAppData()`
- New `cancelPendingSaves()` method on `GanttStorageService` interface. Local is a no-op; cloud clears the debounce timer and nulls pending data
- New `performSignOutWithCleanup()` on StorageContext. 8-step coordinated sequence: cancel pending cloud writes → clear in-memory state → dispose cloud service → reset storage mode key → swap to fresh local service → clear transition state → remove dead v16.5 key → firebase sign-out
- `clearAllData()` action on AppDataContext resets every state field; `isResettingRef` flag suppresses the save effect during the reset tick so cleared defaults are NOT written back to localStorage
- Save-executor error handler tightened: disposed service no longer re-queues `pendingData` on save error (A3-adjacent)

**Tests:** 967 tests passing (up from 931 in v16.5), +36 net new across 4 new test files and 3 modified. All gates green (tsc, test, lint, build). Protected files verified: `GanttChart.tsx` and `firestore-save-executor.ts` untouched; `validation.ts` shows exactly 2 added lines.

## Version 16.5 (2026-04-17)
### Hide SnapshotBar Scrollbar Chrome
- Fix: The horizontal scrollbar on the Gantt Chart's snapshot chip bar no longer renders as a gray bar overlaying the bottom of the chip buttons when a project has many snapshots. Scrolling by drag/wheel/keyboard still works unchanged; partially-visible chips at the right edge signal overflow
- Implementation: New `.snapshot-bar-scroll` CSS class in `styles/globals.css` applies `scrollbar-width: none` (Firefox) and `::-webkit-scrollbar { display: none }` (Chrome/Safari/Edge). Applied to the inner scroll viewport in `SnapshotBar.tsx`. Dropped the obsolete outer `height: 3rem` / `paddingBottom: 0.5rem` that v15.1 used to try to reserve space for the scrollbar
- Pattern: Matches the SPERT Scheduler v0.37.1 fix for the same class of issue on its scenario tab bar
- Tests: 914 tests pass (no new tests — visual CSS change only; existing `SnapshotBar.test.tsx` covers behavior)

## Version 16.4 (2026-04-17)
### Project Form Reflects Live Global Work Week + QRG Update
- Fix: The project form's Work Week selector now reflects the live global setting instead of a hardcoded Mon–Fri baseline when no project override exists. Changing Settings → Work Week (e.g. adding Saturday) now immediately shows as Mon–Sat on the Add Project form, not stale Mon–Fri
- API: New optional `fallbackDays` prop on `WorkWeekSelector`. Display priority is now `value ?? fallbackDays ?? [1,2,3,4,5]` — project override wins, else the caller-supplied live fallback, else the hardcoded default
- Wiring: `ProjectsTab` passes `fallbackDays={globalWorkDays}` so the project form's "no override" state always matches current global
- Docs: Updated `GanttApp_Quick_Reference_Guide.pdf` (repo root + `public/`) to the latest revision. The About tab links to the GitHub raw copy
- Tests: 4 new `WorkWeekSelector` fallback tests (fallback displayed, fallback preferred over Mon–Fri, value takes precedence, hardcoded fallback when both absent); 914 tests total, all passing

## Version 16.3 (2026-04-16)
### Work-Week Warnings Everywhere + Mon–Fri Default
- Default: `globalWorkDays` now initializes to `[1,2,3,4,5]` (Mon–Fri). First-time users and existing users whose stored data omits `globalWorkDays` receive the default automatically on first save. An explicitly-configured work week is preserved untouched
- Feature: Non-workday warnings now appear on **release list rows** (⚠ icon next to Start, Early, Late, Most Likely) with a hover tooltip
- Feature: Non-workday warnings now appear on **project list rows** (⚠ next to Finish Date) with a hover tooltip
- Feature: The **Project Finish Date** form input now shows an amber warning beneath it when the selected date falls outside the effective work week — parity with the release form
- Feature: **Chart date labels** (Start, Early, Late, Most Likely) render in amber bold when they fall on non-workdays, with an SVG `<title>` tooltip
- Feature: The **inline chart date editor** shows a non-workday warning beneath the input as you type, so you see the impact of an edit before saving
- Utility: New `DEFAULT_WORK_DAYS` constant exported from `validation.ts` — single source of truth for the Mon–Fri baseline, used as the initial state in `AppDataContext` and as the "Reset to default" target in Settings
- UX: Settings → Work Week description mentions the Mon–Fri default for new accounts; removed stale "(not persisted until you change it)" placeholder
- Threading: `workDays` prop added to `GanttChart` → `ChartReleaseBar`; `warning` prop added to `InlineDateEditor`
- Tests: 910 tests across 52 test files, all passing (2 test expectations updated for the new default behavior); TypeScript type-check clean (0 errors)

## Version 16.2 (2026-04-16)
### Default Legend Labels Editor + State-Model Refactor
- Feature: New "Default Legend Labels" section in Settings lets you customize the 5 global chart legend defaults (Solid Bar, Hatched Bar, Project Finish Date, Most Likely Finish, In Progress). Closes the v16.1 UX gap where globals were unreachable once any project existed
- UX: Settings inputs start empty with hardcoded defaults shown as HTML placeholders. Clearing an input reverts to the placeholder default — no explicit reset button
- UX: Chart legend scope hint updated to reference "Settings → Default Legend Labels" for global edits
- UX: Italic styling removed on overridden legend labels. The ↺ reset button is the sole visual indicator of an active project override — mixed-italic rows looked inconsistent
- UX: Per-project reset buttons and the scope hint are now excluded from the "Copy Chart as Image" capture via the existing `copy-image-button` pattern
- Data: State model refactor — uncustomized global labels are no longer stored literally. First-time users have no `legendLabels` entries in local/cloud storage until they customize. Existing customizations load and render identically to v16.1
- Types: `sanitizeLegendLabels` return type relaxed (all 5 fields optional); `AppData.legendLabels`, `FirestoreSnapshot.legendLabels`, `FirestoreUserSettings.legendLabels`, and `Snapshot.legendLabels` sub-fields now optional
- New constant: `DEFAULT_LEGEND_LABELS` exported from `validation.ts` — single source of truth for placeholders + rendering fallback
- Risk-1 mitigation: `handleSaveSnapshot` now builds `legendLabels` from `raw || DEFAULT_LEGEND_LABELS.key` so snapshots freeze the effective displayed label, never empty strings. Dedicated regression test in `useSnapshots.test.tsx`
- Wave 1 gate: `npx tsc --noEmit` enforced before the state-model refactor. Caught a third `legendLabels` type occurrence (Snapshot.legendLabels) the plan missed, and a latent test-wrapper typing issue in v16.1
- 908 tests across 52 test files, all passing (15 net new tests); TypeScript type-check clean (0 errors)

## Version 16.1 (2026-04-16)
### Per-Project Legend Label Overrides
- Feature: Each project can now override any of the five chart legend labels (Solid Bar, Hatched Bar, Project Finish Date, Most Likely Finish, In Progress). Global labels remain the baseline
- UX: Labels with project overrides render in italic with a ↺ reset button. One-line hint above the legend clarifies edit scope when a project is selected
- UX: Edits save to the current project when a project is selected; save globally when no project is selected. Edit boxes open with the effective value — project override if present, otherwise global
- Data: Per-project overrides persist in local and cloud storage; round-trip through JSON export/import; projects without overrides behave identically to v16.0
- Resolver: New `resolveLabel` utility — single source of truth for precedence (snapshot → project override → global). Used by both render path and edit UI so the two can never disagree
- Risk mitigation: `contentChanged` in `firestore-save-executor.ts` updated to compare `legendLabels` — prevents silent write-skip in cloud mode (same class as v12.5 reorder and v15.0 workDays bugs). 6 dedicated regression tests added
- 893 tests across 51 test files, all passing (49 net new tests); TypeScript type-check clean (0 errors)

## Version 16.0 (2026-04-16)
### Release Status (three-state) + Today's Date Label
- Feature: Replaced two-state completed toggle with three-state release status — Not Started, In Progress, and Complete — exposed via a segmented control in the release list
- Feature: Added a customizable In Progress bar color to Chart Settings and all 10 color presets (default: amber #f59e0b)
- Feature: Added today's date label above the Today vertical line on the Gantt chart, using the line's color and short-format date (e.g. "Apr 15")
- UX: In Progress legend entry appears on the chart when any release has in-progress status
- UX: The "In Progress" legend label is now editable in place, consistent with Solid Bar, Hatched Bar, Project Finish Date, and Most Likely Finish
- UX: Legend entries reorder left-to-right to match status progression: Completed → In Progress → Not Started (solid + hatched) → vertical lines
- UX: Chart legend wraps gracefully when many entries are visible (gap reduced, flex-wrap added)
- UX: Chart Settings color picker grid narrowed to fit the new In Progress swatch without adding a row
- Migration: Existing releases with `completed: true` automatically migrate to `status: 'complete'` on load at all four ingestion points (localStorage, Firestore, JSON import, snapshots). Snapshots migrate at read time — stored data is untouched until rewritten
- Risk mitigation: `releaseChanged` diff check updated to compare `status` instead of `completed` — without this, a status change in cloud mode wouldn't trigger a Firestore write (same class as v12.5 reorder / v15.0 workDays bugs); dedicated regression test added
- 844 tests across 51 test files, all passing (31 net new tests); TypeScript type-check clean (0 errors)

## Version 15.3 (2026-04-15)
### Security Audit Fixes
- Security: Sanitized Firestore-loaded snapshot names and release names in firestoreSnapshotToFlat() via sanitizeString(), matching existing project/release converter pattern
- Security: Replaced full error object logging with sanitized messages across 14 console.error() call sites (7 files); prevents Firestore paths and SDK internals from leaking to browser console
- Security: Added email format validation (@ check) in ShareDialog before Firestore lookup for immediate feedback on invalid input
- Audit scope: v15.0 work-week sanitization paths (6 ingestion points verified), v15.1 snapshot optimistic updates (sanitization chain verified), Firestore rules (document-level auth confirmed for new fields), general XSS/injection/secrets scan (no issues)

## Version 15.2 (2026-04-15)
### Refactoring & Label Fix
- Refactor: Extracted ReleaseFormFields component from ReleasesTab (506 → 360 LOC) for independent testability and reduced token cost
- UX: Unbolded parenthetical text in "Finish Date (Optional)" and "Work Week (Optional Override)" labels
- Code quality: Reviewed all post-v13.0 modules; audited all dependencies against 60-day stability window (no upgrades — all within window)
- 813 tests across 50 test files, all passing; TypeScript type-check clean (0 errors)

## Version 15.1 (2026-04-15)
### Snapshot Bar Fixes
- UX: Moved Save Snapshot and Delete Snapshot buttons to the left side of the snapshot bar so they are always visible without scrolling
- UX: Snapshots now sort newest-first so the most recent snapshot always appears immediately after "Current"
- Fix: Fixed horizontal scrollbar overlapping snapshot bar chips by adding padding for the scrollbar track
- Fix: Fixed cloud storage mode overwriting snapshots instead of accumulating them by using optimistic state updates (state-level bug — Firestore documents were always unique)
- Fix: Resolved all pre-existing TypeScript type-check errors in test files (missing ChartColors properties, spread argument types, type casts)
- 808 tests across 49 test files, all passing; TypeScript type-check clean (0 errors)

## Version 15.0 (2026-04-15)
### Work Week Configuration
- Feature: Added a global work-week setting in the Settings tab — pick which days of the week count as workdays using a toggleable 7-chip selector (S M T W T F S)
- Feature: Added a per-project work-week override in the Project form, falling back to the global default when not set
- UX: Release date fields in the Releases tab now show an amber warning when a date falls outside your work week; saves are still allowed — warnings are informational
- Component: New `WorkWeekSelector` shared component with accessible labels (aria-pressed, aria-label) and a "last chip disabled" invariant ensuring at least one day is always selected
- Data: Work-week data (`Project.workDays`, `AppData.globalWorkDays`) persists in both local and cloud storage and round-trips through JSON export/import
- Firestore: `workDays` field added to `ganttapp_projects/{projectId}`; `globalWorkDays` added to `ganttapp_settings/{uid}`. No security-rule changes required (document-level auth, not field-level)
- UX: Project form layout — work-week chips sit inline beside the finish date instead of on a separate row
- UX: Renamed "Project Finish Date" label to "Finish Date" and "Export" button to "Export All" for clarity
- Code quality: Fixed all pre-existing lint errors (8 issues across 6 files) — removed stale eslint directives, converted effect-based derived state to render-time derivation, replaced setState-in-effect with lazy initializers where SSR-safe

## Version 14.0 (2026-04-09)
- UX: Unified the header auth chip into a single click target. Clicking anywhere on the pill (avatar, name, or cloud icon) now opens an account popover when signed in to cloud storage
- UX: Account popover shows display name + email and exposes a Sign Out button directly from the header — no more navigating to Settings to sign out
- UX: Signed-out chip behavior unchanged: clicking anywhere on the pill opens the Settings tab to start the sign-in flow
- A11y: Chip is now a single `<button>` with `aria-haspopup`, `aria-expanded`, and a descriptive `aria-label`; Escape dismisses the popover
- Reliability: Sign Out uses a loading state with re-entry guards so the popover cannot be dismissed mid-await

## Version 13.7 (2026-04-02)
- UX: Added amber warning banner on every app load when using local storage mode, reminding users to export their data; dismissible per session via "Got it" button
- Settings: New "Notifications" section with a checkbox to permanently suppress the local storage warning banner (visible only in local storage mode)

## Version 13.6 (2026-03-31)
- Legal: Updated Terms of Service and Privacy Policy (effective March 31, 2026); triggers re-consent for Cloud Storage users
- Legal: Updated canonical legal document URLs to spertsuite.com
- UI: Updated consent UI text to SPERT Suite branding
- UI: Added License link to footer

## Version 13.5 (2026-03-24)
- UX: Inline edit form on Releases tab — clicking Edit shows the form below the release instead of at the top of the page
- Chart: New "Show Months" toggle in Chart Settings renders abbreviated month labels and thin vertical separators
- Chart: Renamed "Show Project Finish Date" to "Show Finish Date" in Chart Settings
- Export: JSON export filename prefix changed from "gantt-data" to "ganttapp-export"
- UI: Improved footer spacing between copyright row and legal links

## Version 13.4 (2026-03-20)
- Legal: Updated Terms of Service and Privacy Policy (effective March 20, 2026); triggers re-consent for Cloud Storage users

## Version 13.3.1 (2026-03-16)
- UX: Updated first-run banner text to clarify browsewrap agreement

## Version 13.3 (2026-03-11)
- Infrastructure: Pinned Node.js target to v22 LTS; added engines field, .nvmrc, updated @types/node

## Version 13.2 (2026-03-11)
- Security: Added sanitizeString() to inline chart editing (release names and legend labels)
- Security: Sanitized Firestore-loaded project and release names in converters
- Security: Removed user email interpolation from sharing error messages
- Security: Sanitized raw Firestore error in cloud mode-switch via sanitizeFirebaseError()
- Security: Added maxLength to project name, release name, and share email inputs
- Security: Applied sanitizeString() to share email and duplicate release name at point of entry

## Version 13.1 (2026-03-11)
- Replaced all remaining window.confirm() calls with styled ConfirmDialog component (project delete, release delete, member removal, snapshot delete)
- Updated dependencies: @types/react 19.2.14, @vitejs/plugin-react 5.1.4, eslint 9.39.4, firebase 12.10.0, firebase-tools 15.9.1
- Synced package.json version to 13.1.0

## Version 13.0 (2026-03-11)
- Added Terms of Service and Privacy Policy links to persistent footer (browsewrap notice)
- Added first-run informational banner for new users (dismissible, non-blocking)
- Added clickwrap consent modal required before enabling Cloud Storage (checkbox + links)
- Added ToS acceptance record in Firestore (users/{uid}) with version tracking
- Added returning-user ToS version check on auth state change (sign-out on mismatch)
- Centralized version constants in src/lib/version.ts (APP_VERSION, TOS_VERSION, APP_ID)
- Added legal/ directory with reference copies of ToS and Privacy Policy PDFs
- Added README.md with Legal section
- Synced package.json version to 13.0.0

## Version 11.0 (2026-02-20)
- Added Firebase Authentication with Google and Microsoft SSO (AuthContext)
- Added Firestore cloud storage backend (FirestoreDriver, FirestoreGanttStorageServiceImpl)
- Added StorageContext with local ↔ cloud mode switching and data migration
- Added Settings tab: storage mode selector, account management, export attribution
- Added real-time sync via Firestore onSnapshot with echo prevention (hasPendingWrites)
- Added project sharing with role-based access control (owner/editor/viewer) via ShareDialog
- Added Firestore security rules (firestore.rules)
- Added export attribution: name/identifier injected as _exportedBy in JSON exports
- Added academic integrity metadata: _changeLog and _originRef on cloud-stored projects
- Updated About page with dual-storage messaging (Local Storage default, Cloud Storage optional)
- Tab order: Projects, Releases, Gantt Chart, Settings, About
- Provider hierarchy: AuthProvider > StorageProvider > ThemeProvider > AppDataProvider
- 581 tests across 38 test files, all passing

## Version 10.0 (2026-02-18)
- Added storage abstraction layer: StorageDriver and GanttStorageService interfaces
- Added LocalStorageDriver and LocalGanttStorageService (refactored from direct localStorage)
- Added StorageContext providing pluggable storage to the component tree
- Added Firebase SDK (firebase ^12.9.0) with conditional initialization
- Added .env.local.example template for Firebase configuration
- All snapshot operations now async via GanttStorageService
- AppDataContext consumes useStorage() instead of direct localStorage calls
- Zero functional changes — all existing features work identically
- 497 tests across 32 test files, all passing

## Version 9.0 (2026-02-16)
- Added import safety dialog: confirmation shown after file parse, before data apply
- Added customizable completed release color (completedBar property in ChartColors)
- Completed releases render as single solid bar from startDate to lateFinishDate (no hatching)
- Early Finish and Most Likely labels hidden for completed releases
- Added darkenColor() utility for computed hatched bar colors
- Hatched Bar color picker swatch now displays with SVG hatched pattern
- Color picker labels renamed for clarity (Today → Today's Date, etc.)
- 459 tests across 28 test files, all passing

## Version 8.0 (2026-02-13)
- Added optional Most Likely Finish Date per release (vertical line in hatched bar)
- Added global toggle: Show Most Likely Finish (in Chart Settings)
- Added configurable Most Likely line color with color picker
- Added click-to-edit inline on chart for Most Likely date
- Added editable Most Likely legend entry
- Smart label suppression for Most Likely date (40px threshold)
- All 10 color presets updated with Most Likely line color
- Snapshots capture Most Likely data per-release
- Fixed showTodayLine toggle persistence to localStorage
- Fixed onKeyPress (deprecated) to onKeyDown in ProjectsTab
- Fixed dark mode colors in ChartSettings preset buttons
- Fixed saveLabelEdit() to reject empty/whitespace-only labels
- Added shared validateReleaseDateChange() and formatDateLocale() utilities
- 447 tests across 26 test files, all passing

## Version 7.1 (2026-02-09)
- Internal refactoring for maintainability — zero functional changes
- Extracted 5 shared sanitization functions into validation.ts (DRY)
- Updated useChartCalculations hook with correct constants and displaySettings parameter
- Reduced GanttChart from 52 individual props to 9 grouped props
- Extracted ChartReleaseBar component from GanttChart (~150 LOC)
- Extracted useEffectiveChartProps hook for snapshot vs live data resolution
- Added 66 new tests across 6 test files
- 393 tests across 22 test files, all passing

## Version 7.0 (2026-02-09)
- Added Release Plan Snapshots: save read-only historical records of release plans
- Chip navigation bar above chart to toggle between Current and saved snapshots
- One-click snapshot creation with optional custom name
- Snapshots capture releases, chart colors, legend labels, project finish date, Prepared By
- Historical snapshots are fully read-only (inline editing disabled)
- Delete old snapshots with confirmation dialog
- Cascade delete: project deletion removes all its snapshots
- Export/Import includes snapshots in JSON file
- Separate localStorage key (ganttAppSnapshots) for data isolation
- Limits: 100 total snapshots, 50 per project, 2MB import file size cap
- Added Prepared By field in Chart Settings with show/hide toggle
- Fixed quarter label (Q4) overlapping year label
- Fixed horizontal scrollbar on Windows Chrome/Edge
- 322 tests, all passing

## Version 6.1 (2026-02-07)
- Added Row Spacing control in Chart Settings with S/M/L options (20px, 25px, 30px)
- Row height formula changed from barHeight * 2 to barHeight + rowSpacing
- Bar Height labels changed to S/M/L for compact display
- 320 tests, all passing

## Version 6.0 (2026-02-06)
- Added click-to-edit dates directly on chart (inline date picker with validation)
- Added configurable Bar Height in Chart Settings (Small/Medium/Large)
- Compact horizontal layout for PresetButtonGroup controls
- 289 tests, all passing

## Version 5.7 (2026-02-06)
- Added Duplicate Release (one-click cloning with auto-shifted dates)
- Added keyboard shortcuts: Escape (cancel), Ctrl/Cmd+S (save), Arrow keys (tab navigation)
- Added dark mode with light/dark/system toggle (ThemeContext)
- Theme stored in separate localStorage key (gantt-theme)
- All components updated with theme-aware styling
- 288 tests, all passing

## Version 5.6 (2026-02-03)
- Added comprehensive input sanitization for all user-provided and imported data
- Added sanitizeString(), sanitizeId(), isValidHexColor(), sanitizeColor() to validation.ts
- Added file size limit (1MB), array limits (50 projects, 500 releases) on import
- Added validateLoadedData() defense-in-depth for localStorage
- npm audit: 0 vulnerabilities

## Version 5.5 (2026-02-02)
- Upgraded Next.js from 15.5.11 to 16.1.6 (major version upgrade)
- Turbopack is now the default bundler (faster builds)
- Removed ESLint bridge packages (@eslint/compat, @eslint/eslintrc, @eslint/js) — eslint-config-next@16 exports native flat config
- Simplified eslint.config.mjs to use native Next.js 16 flat config directly
- Removed obsolete eslint config block from next.config.js
- Refactored project auto-selection from useEffect to computed value (fixes react-hooks/set-state-in-effect)
- Removed unused useEffect import from main page
- npm audit: 0 vulnerabilities — fully JFrog scan ready
- All 288 tests pass, build succeeds, lint clean

## Version 5.4 (2026-02-02)
- Upgraded Next.js from 14.2.35 to 15.5.11 (major version upgrade)
- Upgraded React from 18 to 19 and React DOM from 18 to 19
- Updated @types/react and @types/react-dom to v19
- Migrated Context.Provider to React 19 direct Context syntax
- Aligned eslint-config-next to 15.5.11 to match Next.js version
- Resolved all Next.js 14 CVEs (GHSA-h25m, GHSA-9g9p) by upgrading to 15.x
- All 288 tests pass on React 19 with zero code changes required

## Version 5.3 (2026-02-02)
- Upgraded ESLint from v8 to v9 to resolve moderate security vulnerability (GHSA-p5wg)
- Upgraded eslint-config-next from 14.0.4 to 15.1.7 for ESLint 9 compatibility
- Migrated to ESLint flat config format (eslint.config.mjs) for forward compatibility
- Added ESLint bridge packages (@eslint/js, @eslint/eslintrc, @eslint/compat)
- Fixed 21 unescaped entity lint errors across JSX components
- Changed lint command from "next lint" to "eslint ." for ESLint 9 support
- Reduced npm audit vulnerabilities from 5 to 1 (remaining: Next.js CVE that does not apply to Pages Router)

## Version 5.2 (2026-02-01)
- Expanded automated test suite from 157 to 288 tests across 19 test files
- Added tests for useProjects hook: CRUD operations, form state, cascade delete (23 tests)
- Added tests for useReleases hook: CRUD operations, validation, toggle operations (27 tests)
- Added tests for ProjectsTab component: rendering, form, edit/delete, navigation, validation (20 tests)
- Added tests for ReleasesTab component: rendering, project selection, form, toggles (18 tests)
- Added tests for UI components: Tabs, DragHandle, ColorSwatchPicker, GrayscaleSwatchPicker, PresetButtonGroup (34 tests)
- Added tests for static pages: AboutTab and ChangelogTab (9 tests)

## Version 5.1 (2026-01-29)
- Added automated test suite with 157 tests across 8 test files (Vitest + React Testing Library)
- Fixed date validation bug: invalid calendar dates (e.g., Feb 30, Month 13) are now rejected
- Fixed timezone inconsistency: date comparisons now use local timezone consistently
- Fixed potential ID collision by replacing Date.now() with unique ID generator
- Improved data import validation: projects and releases are now schema-validated on import
- Fixed chart rendering edge case when all release dates are identical
- Consolidated duplicate localStorage save effects in state management
- Removed unused useLocalStorage hook (dead code cleanup)
- Fixed date input placeholder styling: empty inputs show mm/dd/yyyy in light gray, entered values in dark color
- Copy chart as image button now excluded from captured images
- Improved inline "Releases for" dropdown styling on Releases tab

## Version 5.0 (2026-01-22)
- Complete architectural refactoring to Feature Modules pattern
- Extracted utilities, types, and components for better maintainability
- Reduced token usage for AI-assisted development by 75-85%
- Improved code organization with feature-based folder structure
- Created centralized context for state management
- All features work identically - zero functional changes for users

## Version 4.4 (2026-01-21)
- Enhanced Chart Settings with configurable display options
- Added Release Name Font Size control: Small (14px), Medium (16px), or Large (18px)
- Added Date Label Font Size control: Small (9px), Medium (11px), or Large (13px)
- Added Date Label Color control: grayscale swatches from light gray to black for better contrast
- Added Vertical Line Width control: Thin (2px), Medium (3px), or Thick (4px) for Today's Date and Project Finish Date lines
- Display controls positioned horizontally for better visibility
- Increased left margin space for release names and optimized chart layout
- Legend line segments now match vertical line width setting
- All display settings persist to localStorage and survive export/import

## Version 4.3 (2026-01-21)
- Added release visibility toggle: hide releases from chart while keeping them in the list
- Added completion status: mark releases as done to render them in green
- Enhanced Releases tab with "Show" checkbox and "Mark Done" button for each release
- Completed releases display in light green (solid) and forest green (hatched)

## Version 4.2 (2026-01-20)
- Added optional project finish date field (Projects tab)
- Renamed "Chart Color Settings" to "Chart Settings"
- Moved chart display toggles to Chart Settings section (cleaner exported images)
- Added project finish date vertical line visualization (bright green by default)
- Added quarter labels (Q2, Q3, Q4) to timeline above vertical gridlines
- Enhanced Chart Settings with toggle controls and finish date color picker

## Version 4.1 (2026-01-20)
- Removed "Gantt Chart:" label prefix from chart display (project name only)
- Added collapsible color settings section (collapsed by default)
- Made legend labels editable with localStorage persistence
- Enhanced About page formatting (bolded "GanttApp" in description)

## Version 4.0 (2026-01-19)
- Revert from Firebase to localStorage for better data persistence
- While Firebase provided cloud storage, anonymous authentication sessions expired unpredictably
- localStorage puts users in control - data persists until they choose to clear their browser cache
- Export/Import feature provides reliable backup mechanism

## Version 3.5 (2026-01-19)
- Add configurable chart colors with preset themes
- Users can now customize solid bar, hatched bar, and today's line colors
- Includes preset color themes: Classic Blue, Ocean Green, Purple Haze, Sunset Orange, Ruby Red

## Version 3.0 (2026-01-18)
- Initial release with Firebase integration
- Project and release management
- Gantt chart visualization with uncertainty ranges

## Version 2.1 (2026-01-17)
- Add copyright footer and GNU GPL v3 license

## Version 2.0 (2026-01-17)
- Add Export/Import functionality and copy chart as image

## Version 1.0 (2026-01-17)
- Initial release with localStorage, Projects, Releases, and Gantt chart
