# Change Log

## Version 0.26.1 (2026-05-24)
### About page polish — QRG button label standardized across the SPERT® Suite

Renames the About tab QRG download button from `Download Quick Reference Guide (PDF)` to `Open Quick Reference Guide (PDF)` so the label matches the canonical convention used across the SPERT® Suite (Forecaster, MyScrumBudget, AHP, Story Map, Scheduler). The PDF target is unchanged — `/GanttApp_Quick_Reference_Guide.pdf`, still opens in a new tab.

## Version 0.26.0 (2026-05-21)
### Import hardening + refactor: `useImportState` hook, cloud guard, collision-safe copy, ARIA

A full retrograde pass on Smart Import (v0.24.0). The cloud-mode hydration race that could silently create duplicate projects is closed, the ID-conflict default reverts from contextual "Replace" back to the safer "Skip" per spec pitfall #22, both apply functions become permanently lock-resistant, the state machine is extracted to a dedicated `useImportState()` hook, the copy path becomes collision-safe up to 99 iterations, and the preview UI gains real screen-reader support.

#### Bug fixes

**Cloud mode (CRITICAL) — fast-paths now gated on local storage mode.** Both import fast paths (`ganttapp-project-export` with zero conflicts; full-workspace replace into an empty workspace) now check `storage.mode === 'local'` before firing. Without this gate, the post-sign-in hydration window — where `listAppData()` may briefly return an empty snapshot before Firestore data arrives — let a fast path apply against an apparently-empty workspace, then silently duplicate every project once hydration completed. Cloud mode now always shows the preview, even for conflict-free imports. One extra click; zero data risk. (Spec pitfall #69.)

**Default decisions — ID conflicts default to Skip.** v0.24.0 used a smarter default: ID-conflict + matching names → 'Replace' (round-trip backup case); ID-conflict + different names → 'Skip'. The "matching names" rationale doesn't hold for the user who exported a backup, did three weeks of work, then accidentally imported the old backup — defaulting to 'Replace' would silently lose three weeks of work. All ID conflicts now default to 'Skip' unconditionally per spec pitfall #22. Users who actually want to replace must click 'Replace' explicitly.

**Copy collision (pitfall #84).** Importing the same file twice via 'copy' previously produced two projects both named "Foo (2)" — indistinguishable in the project list. The new copy path iterates suffix `(2)`, `(3)`, `(4)`, …, `(99)` against a `usedNames: Set<string>` of in-batch and existing project names, so the second copy of "Foo" produces "Foo (3)", the third produces "Foo (4)", and so on. Each chosen name is reserved before the next iteration. The suffix length is capped at 5 chars (" (99)") and truncation respects `MAX_NAME_LENGTH`.

#### Reliability

**Apply functions are now lock-resistant.** Both `applyMergeDecisions` and `applyReplaceAll` use `try/finally { applyingRef.current = false; setApplying(false); }`. The `applyingRef` (`useRef(false)`) is a same-tick reentrancy guard: refs are read synchronously at call time, so rapid double-clicks before React commits the `applying` state can't slip a second apply through. A belt-and-suspenders `if (applying) return` UI guard is added to `handleConfirmMerge` and `handleConfirmReplaceAll`. Net effect: the UI cannot be permanently locked by an unexpected throw, and a double-click on Confirm produces at most one import. (Spec pitfalls #27, #53.)

**File-read re-entrancy guard.** A `readerPendingRef` blocks a second `handleImport` invocation while the first reader is still in flight. The `<input type="file">` is also disabled immediately on first pick (`disabled={applying}`), so the visual + ref guards align. Closes a race where rapid picks could start two parsers and apply twice. (Spec pitfall #48.)

#### UX

**Stale banner + stale preview cleared at file-pick entry.** When a new file is picked, `setImportBanner(null)` and `setImportPreview(null)` run before any processing. Previously, an AlertDialog from a prior failed pick (or a preview from an abandoned pick) could render over the new flow until parsing completed. (Spec pitfall #79.)

#### Refactor

**`useImportState()` hook (pitfall #59).** Created at `src/features/projects/hooks/useImportState.ts`. The hook owns all import state (`importPreview`, `importBanner`, `replaceAllPending`, `applying`, `fileInputRef`, `readerPendingRef`, `applyingRef`) and all handlers (`handleImport`, `handleConfirmMerge`, `handleConfirmReplaceAll`, `handleImportCancel`, `onModeChange`, `onDecisionChange`, `openReplaceAllConfirm`, `cancelReplaceAllConfirm`). ProjectsTab becomes a thin shell that consumes the hook and renders the JSX. The import state machine is now isolated, testable via `renderHook`, and ProjectsTab's import-related logic drops from ~270 LOC to ~25 LOC of hook composition + JSX wiring.

**`applyImportDecisions` signature (pitfall #28).** Added `conflicts: ImportConflict[]` as the 5th positional parameter. Callers now compute conflicts once at preview-build time and pass the result through; the function no longer re-runs `detectImportConflicts` internally. Internal naming: `resolvedAction` renamed to `resolvedOutcome` to clarify that the return includes the synthetic `'added'` classification (pitfall #26).

**`normalizeProjectName(name)` shared helper.** Trim, lowercase, NFC normalization extracted from inline call sites in `detectImportConflicts`. Used internally; exported for future consumers.

#### Accessibility — `ImportPreviewSection.tsx`

- Outer container: `role="region"` with `aria-labelledby={headingId}` pointing at the "Review import" heading.
- Heading: programmatic focus on mount via `useEffect` + `useRef`, `tabIndex={-1}` to keep it out of the Tab cycle.
- Escape key dismisses the preview, suppressed while `applying === true` so an in-flight apply isn't cancelled.
- Per-conflict containers: `role="radiogroup"` with `aria-labelledby` pointing at the conflict description (existing→incoming for ID conflicts, just-incoming for name conflicts).
- Action buttons (Confirm Merge / Replace All Data / Cancel): `aria-busy={applying}` so assistive tech announces the apply state.

#### Tests

New `useImportState.test.ts` with 21 `renderHook` cases covering: parse errors, fast paths + cloud guard, preview/decision flow, drift abort, applying-state lifecycle (success + failure paths), same-tick reentrancy guards (split into ref-based + state-based), `readerPendingRef`, decision-state management (Map clone, mode toggle preserves decisions), `handleConfirmReplaceAll` flow + double-click guard, Cancel returns to preview state intact. Plus 4 new collision tests in `export.test.ts` (collision-safe copy iteration). Test count: 1197 → 1220 (+23).

#### SPEC_DEVIATIONS.md — Level 4 deferred items documented

A new `docs/SPEC_DEVIATIONS.md` tracks the gaps between GanttApp's import implementation and the canonical Level 4 spec:
- **SD-1** — React Context closure boundary; concurrent-add not caught (target v0.27.0).
- **SD-2** — `selectedProjectId` non-atomic remap (target: Zustand migration).
- **SD-3** — Copy collision-safe naming. **Resolved in v0.26.0.**
- **SD-4** — Default 'Replace' for ID-same-name conflicts. **Reverted in v0.26.0** per pitfall #22.
- **SD-5** — Coarse-grain abort vs per-decision graceful fallback (target v0.27.0).
- **SD-6** — `cloneProject` not reused in copy path due to owner semantics (future helper extraction).
- **SD-7** — `aria-busy` observability gap on Replace-All path; needs `flushSync` (deferred).

**Note (cloud mode):** The import success banner reflects the in-memory merge result. Firestore commit completes within ~500 ms via the debounced auto-save. Banner counts are optimistic in cloud mode — if a Firestore write later fails, the in-memory result has already been shown. Acceptable trade-off; matches pre-v0.24.0 behavior. (Spec pitfall #51.)

**Modified Files:**
- New: `src/features/projects/hooks/useImportState.ts` (~330 LOC)
- New: `src/features/projects/__tests__/useImportState.test.ts` (21 tests)
- New: `docs/SPEC_DEVIATIONS.md`
- `src/shared/utils/export.ts` — `normalizeProjectName` exported; `applyImportDecisions` signature change (conflicts param); `resolvedAction` → `resolvedOutcome`; collision-safe copy via `usedNames` Set; `COPY_SUFFIX` constant deleted
- `src/shared/utils/__tests__/export.test.ts` — 17 call sites updated; 2 tests migrated; 4 new tests added
- `src/features/projects/ProjectsTab.tsx` — 9 functions + state declarations replaced with single `useImportState()` hook call; JSX prop wiring updated
- `src/features/projects/ImportPreviewSection.tsx` — heading ref + focus-on-mount; Escape key handler; role="region"+aria-labelledby; role="radiogroup" per conflict; aria-busy on action buttons
- `src/features/projects/__tests__/ProjectsTab.test.tsx` — "Smart ID-conflict defaults" test migrated to v0.26.0 contract (all ID conflicts default to 'skip')
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean (0 errors)
- Lint clean
- All 1220 tests pass
- Production build succeeds with Turbopack

---

## Version 0.25.0 (2026-05-10)
### UX: Releases tab right-side controls upgraded to the shared icon family

The per-release **Edit** and **Duplicate** text buttons on the Releases tab are replaced with the same icon button components used on the Projects tab — `PencilIconButton` (blue) and `CloneIconButton` (violet) — and the order is now **Edit, Duplicate (Clone), Delete**, matching the Projects tab. The existing `TrashIconButton` for Delete (already an icon since v17.1) stays put. A thin vertical divider sits to the left of the trio, separating the **Show** checkbox + **Status** dropdown (settings) from the icon actions.

**Why:** Visual consistency with the Projects tab. Once a user has seen the icons on Projects they immediately know what they do on Releases — the text buttons were redundant explanations after the first encounter. Tighter row, less visual noise, more horizontal space for the release name + dates.

**`PencilIconButton.active` prop (new).** The old Edit text button had a strong "this row is being edited" cue (solid blue background, white text, blue border) that stayed visible while the inline edit form was open. To preserve this affordance under the new icon, `PencilIconButton` gains an optional `active?: boolean` prop. When `true`, the button renders its hover state permanently (blue icon + blue tint background + blue ring) — the cue holds even when the cursor moves away. `disabled` overrides `active` (no visual on disabled buttons). Added by extending `isHoverActive` from `hover && !disabled` to `(hover || active) && !disabled`. Backwards-compatible: prop defaults to `false`, so all existing call sites (Projects tab edit pencil) are unchanged.

**Divider scope (Option A, agreed before coding).** On Projects, the divider separates a fixed-width share slot from the icons. On Releases there is no equivalent owner-only slot, so the divider sits directly to the left of the Edit icon and reads as **"settings | actions"** — separating Show + Status from the icon trio. No empty slot, no dead space. The divider markup matches Projects exactly: `1px × 20px`, `colors.border`, `margin: 0 4px`, `flexShrink: 0`, inside an inner flex container with `gap: '2px'` for tight icon spacing.

**Modified Files:**
- `src/shared/components/PencilIconButton.tsx` — new optional `active` prop; header bump to v0.25.0
- `src/shared/components/__tests__/PencilIconButton.test.tsx` — +2 tests for `active` (renders hover state at rest; disabled overrides active)
- `src/features/releases/ReleasesTab.tsx` — import `PencilIconButton` + `CloneIconButton`; replace Duplicate/Edit text buttons with icon buttons in Edit / Clone / Delete order; insert divider; wrap divider + 3 icons in inner flex `gap: '2px'`
- `src/features/releases/__tests__/ReleasesTab.test.tsx` — `getByText('Edit')` → `getByLabelText('Edit release')` (2 occurrences)
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`, `ARCHITECTURE.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All existing tests pass + 2 new (1195 → 1197 expected)
- Manual: hover any release row icon — Edit/Clone/Delete now render the same colored-tint background + matching colored ring as on Projects; click Edit → inline edit form opens AND the pencil stays blue (active state holds); click Cancel → pencil returns to gray

---

## Version 0.24.0 (2026-05-10)
### Smart Import with Per-Project Conflict Resolution

Replaces the prior binary import UX (replace-all confirmation OR additive merge-with-skip) with a per-project conflict resolution preview. The user picks a file, sees a full inline preview between the toolbar and the project list, makes per-project `skip` / `copy` / `replace` decisions on any conflicts, then confirms or cancels. The previous flow silently skipped any project whose ID matched an existing one — a surprise when round-tripping a backup with renames or hitting coincidental name collisions. The new flow surfaces every conflict and gives the user control.

**New utility surface in `src/shared/utils/export.ts`:**
- `ImportConflict` — `{ type: 'id' | 'name', incomingProject, existingProject }`. Emitted per conflicting incoming project.
- `ConflictAction` — `'skip' | 'copy' | 'replace'`.
- `ImportDecisionResult` — `{ added, skipped, copied, replaced, replacedIdMap }`.
- `detectImportConflicts(incoming, existing)` — first-insert-wins on name-map collisions preserves first-match semantics when two existing projects share a lowercased-trimmed name.
- `conflictsEqual(a, b)` — multiset equality on `(incomingId, type, existingId)` tuples; used by both stale-data guards.
- `applyImportDecisions(existing, incoming, existingSnapshots, decisions, idGenerator?)` — the replacement for `mergeImportedProjects`. Self-contained: recomputes conflicts internally so the caller does not pass them. Supports an optional deterministic `idGenerator` (defaults to `generateId`) for testability.

**Three-pass slot-preserving algorithm in `applyImportDecisions`:**
1. Pre-computation — iterate `incoming.appData.projects` in array order; build a `Map<existingSlotId, winningIncomingProject>`. **First-wins is determined by array order, not `decisions` Map insertion order.** Later replaces targeting a claimed slot are downgraded to `'skip'` and counted.
2. Slot substitution — iterate `existing.projects` in order; substitute incoming projects in place, copying `existingProject.owner` (or leaving undefined; never fabricated). Existing index is preserved, which avoids `executeFirestoreSave`'s `prevIndex !== index` reorder detection triggering spurious cloud writes.
3. Append — `'copy'` results, then `'added'` non-conflicting, both in incoming array order. New projects always land at the bottom of the workspace.

**Per-decision behavior:**
- `'skip'` (and the missing-key fallback for any conflict not in `decisions`) — omits the project, all its releases, and all its snapshots.
- `'copy'` — generates a new project ID via `idGenerator()`; truncates the name to `MAX_NAME_LENGTH - COPY_SUFFIX.length` and appends `COPY_SUFFIX = ' (2)'`. Releases get fresh IDs and the new `projectId`. Snapshots get a fresh `snapshot.id` and a new top-level `snapshot.projectId`; the embedded `snapshot.releases[]` array is left **entirely untouched** — it is a frozen historical record, and its embedded `projectId` values stay at the original (pre-copy) project ID. Confirmed safe: only `useEffectiveChartProps.ts` consumes `snapshot.releases` and only as a frozen render input — never joined against live `Project.id`. Owner is never set on copies.
- `'replace'` — slot-preserving; copies `existingProject.owner` onto the incoming record. ID conflicts produce no `replacedIdMap` entry (existing.id === incoming.id, no remap needed). Name conflicts produce `replacedIdMap.set(existingId, incomingId)` so the call site can rebind selection.

**Naming and cap divergences from `cloneProject` (intentional, documented inline):**
- `cloneProject` uses `" - Copy (1)"`, `" - Copy (2)"`, ..., `" - Copy (99)"`. Import-copy is unconditional `" (2)"` — accepts duplicate `"Foo (2)"` names silently.
- `cloneProject` enforces `MAX_SNAPSHOTS_TOTAL` and drops snapshots with an alert. `applyImportDecisions` bypasses the cap, consistent with the existing replace-all import path. Import is a bulk restore operation; the cap is intentionally bypassed.
- Snapshot dedup by ID applies only on the `'added'` path. `'replace'` does full slot substitution; no dedup needed.

**Workflow state machine in `ProjectsTab.tsx`:**
Three permitted state transitions, the only ways to move the import UI between states:
- `showPreview(state)` — clears banner, replaceAllPending, applying; sets preview.
- `showBanner(banner)` — clears preview, replaceAllPending, applying, file-input ref; shows banner.
- `clearImportFlow()` — clears preview and replaceAllPending; resets applying defensively (Cancel is disabled during apply, but the reset guarantees correctness if that disable is ever bypassed). Does NOT touch banner — preview and banner are mutually exclusive.

Banner dismiss is the only path that uses the raw setter directly, since dismissing a banner is not a flow transition.

**Two fast paths in `handleImport`:**
1. `ganttapp-project-export` with **zero conflicts** → applies immediately via `applyMergeDecisions`, no preview, success banner.
2. **Empty workspace** + replace-all-shape file (`ganttapp-all-projects` or `legacy`) AND `!appDataLoading` → applies via `applyReplaceAll`, no preview, no modal, success banner. The `!appDataLoading` gate prevents silent Replace-All against a workspace that is still loading.

All other imports show the inline preview between toolbar and project list (matching the v0.22.1 `InvitationSection` placement convention).

**Initial mode rationale per `_exportType`:**
- `ganttapp-project-export` → `'merge'` (single-project export has never had a replace-all path).
- `ganttapp-all-projects` → `'merge'` — intentionally new format introduced in v19.0; no established user habit to preserve; safe default; user can switch to Replace-All in one click.
- `legacy` → `'replace-all'` — every legacy file hits Replace-All today; defaulting to Merge would silently drop data for round-trip backup users who expect replacement.

**Smarter ID-conflict defaults** (populated synchronously inside `showPreview`, not via `useEffect`):
- `type: 'id'` AND lowercased-trimmed names match → `'replace'`. The dominant round-trip backup case: re-importing your own export. Eliminates the prior footgun where every round-tripped project was silently skipped.
- `type: 'id'` AND names differ → `'skip'`. Records have diverged (renamed locally or in the file); preserve the existing version.
- `type: 'name'` → `'copy'`. Coincidental name collision; keep both.

A `// TODO(v0.25.x)` flags adding a "select all → replace" affordance for the diverged-names case so round-trip users with renamed projects can replace in bulk.

**Dual stale-data guards:**
1. **Pre-async early-exit** in `handleConfirmMerge` — recomputes `detectImportConflicts(imported, data)` and compares against `importPreview.conflicts` via `conflictsEqual`. Catches the common non-cloud case cheaply, before any `await`.
2. **Authoritative post-`loadSnapshots` check** inside `applyMergeDecisions` — re-runs `detectImportConflicts` after the `await`, since that's where a real-time `onSnapshot` from cloud mode can fire and mutate `data`. `originalConflicts` is captured **before** `setApplying(true)` so the closure does not depend on stale `importPreview` state.

Both guards abort with the same banner text: `'The workspace changed while the preview was open. Please review your import again.'`. Fast Path 1 (no preview) gets a genericized variant: `'The workspace changed during import. Please try again.'`.

**Apply-state safety:**
- Confirm, Replace-All, Cancel, AND the mode selector are all `disabled` when `applying === true` inside `ImportPreviewSection`.
- Toolbar Import `<input type="file">` has `disabled={applying}`. Toolbar Import `<label>` has `aria-disabled={applying}` plus visual dimming. Both are required — `pointer-events: none` on the label is insufficient because keyboard activation can still fire the input.
- The Replace-All `ConfirmDialog` is gated on `replaceAllPending && importPreview !== null`, so it can never render without an active preview. On confirm, `imported` is captured before state mutation; `setReplaceAllPending(false)` runs synchronously so the modal disappears before the `await applyReplaceAll(imported)` begins.

**Preview UI per file type:**
- Green-tinted block lists non-conflicting projects with release counts and the line: *"New projects will be added at the bottom of your project list."*
- Amber-tinted block per conflict:
  - `type: 'id'` shows `Existing: "{name}" → Incoming: "{name}"` side-by-side, allowing the user to spot renames since export.
  - `type: 'name'` shows the incoming project name and the label `"Already exists — same name, different origin"`.
  - Three radio buttons with the labels: *"Keep existing, ignore imported"*, *"Add as a copy"*, *"Replace existing with imported"*.
- For `ganttapp-all-projects` and `legacy` files, a mode selector toggles between Merge and Replace All. Merge mode includes the hint: *"Workspace settings (colors, attribution) are not imported in Merge mode. Switch to Replace All to restore them."* Replace mode hides (not disables) the per-project conflict UI. Mode toggle does not reset per-project decisions.

**Banners:**
- Success banner uses `role="status"`, green tint, explicit Dismiss button, no auto-fade.
- Error banner uses `role="alert"`, red tint, explicit Dismiss button, no auto-fade.
- Error text is sanitized via `sanitizeFirebaseError` in catch paths. Specific strings: `'Invalid file format'` (parse failure), `'Error importing file'` (read failure).

**Radio id namespacing:** group `name="${idPrefix}-conflict-${incomingProject.id}"`; each radio `id="${idPrefix}-conflict-${incomingProject.id}-${action}"`; each `<label>` has matching `htmlFor`. `idPrefix` is derived from the parent `useId()` (`${baseFieldId}-import`). Tests verify pairing (shared `name` within group; `htmlFor`/`id` match) rather than exact `useId()` values, since `useId()` returns opaque strings like `:r5:`.

**Removed:**
- `mergeImportedProjects` from `export.ts` and its 9-test describe block.
- `applyImport`, `applyMergeImport`, `importConfirm`, `importMergeConfirm` from `ProjectsTab.tsx`.
- All `alert()` calls in the import flow (replaced by banners).

**Exports:**
- `MAX_NAME_LENGTH = 100` is now exported from `validation.ts` (was private). It is the generic max-name length used by `sanitizeString` as a default — applies to project names, release names, attribution, etc., not just projects. Consumed in `applyImportDecisions` to compute the truncation length.

**Modified Files:**
- `src/shared/utils/validation.ts` — export `MAX_NAME_LENGTH`
- `src/shared/utils/export.ts` — new types + `detectImportConflicts` + `conflictsEqual` + `applyImportDecisions`; `mergeImportedProjects` retired
- `src/features/projects/ImportPreviewSection.tsx` — new file (~270 LOC)
- `src/features/projects/ProjectsTab.tsx` — full import-flow rewrite as state machine; toolbar Import button gains apply-state disable
- `src/shared/utils/__tests__/export.test.ts` — `mergeImportedProjects` block removed; new tests for `detectImportConflicts` (6), `conflictsEqual` (6), `applyImportDecisions` (15)
- `src/features/projects/__tests__/ImportPreviewSection.test.tsx` — new file (14 tests)
- `src/features/projects/__tests__/ProjectsTab.test.tsx` — old `import warning dialog` and `import routing by _exportType` blocks replaced with new Smart Import flow tests (10 tests across Fast Paths, preview rendering, modal gate, confirm/cancel, smart defaults, Replace-All reset, invalid file)
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `CHANGELOG.md`, `ARCHITECTURE.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All tests pass: 1195 total (was 1161 before v0.24.0; net +34)
- Manual: empty workspace + ganttapp-all-projects → applies immediately with banner; non-empty + project-export with no conflicts → applies immediately; mixed conflicts → preview between toolbar and list, defaults populated correctly, decisions togglable; Merge mode shows settings hint; Replace mode hides conflict list; Replace All Data → ConfirmDialog modal → confirm applies; pick new file mid-modal → modal dismissed; Cancel clears preview and file input; during apply, Import button + label dim and disabled

---

## Version 0.23.1 (2026-05-10)
### UX: matching colored hover ring on Trash / Pencil / Export / Clone icon buttons

Visual-consistency patch on top of v0.23.0. The new `ShareIconButton` introduced the soft colored ring pattern (cyan `box-shadow: 0 0 0 1.5px rgba(6,182,212,0.5)` on hover/focus) and the four pre-existing per-tile icon buttons looked subdued by comparison — only their tinted background appeared on hover, no ring. This release adds the matching ring to each of them, in their own brand color:

- **TrashIconButton** — red ring `rgba(239, 68, 68, 0.5)`
- **PencilIconButton** — blue ring `rgba(0, 112, 243, 0.5)`
- **ExportIconButton** — green ring `rgba(16, 185, 129, 0.5)`
- **CloneIconButton** — violet ring `rgba(139, 92, 246, 0.5)`

Each transition string was extended from `'background 0.12s ease'` to `'background 0.12s ease, box-shadow 0.12s ease'` so the ring fades in alongside the background tint rather than snapping in. The icon stroke color, hover background, and disabled handling are unchanged from v0.23.0. Header version annotations bumped to `v0.23.1`.

**Modified Files:**
- `src/shared/components/TrashIconButton.tsx` — `boxShadow` + transition addition; header bump
- `src/shared/components/PencilIconButton.tsx` — same
- `src/shared/components/ExportIconButton.tsx` — same
- `src/shared/components/CloneIconButton.tsx` — same
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All existing tests pass (1161 baseline preserved)
- Manual: hover any per-tile icon — Share/Export/Edit/Clone/Delete now all render the same colored-tint background + matching colored ring, transitions in sync

---

## Version 0.23.0 (2026-05-10)
### UX: ShareIconButton + clickable project tile + 6-dot drag handle + 18×18 icon resize

This release introduces a borderless `ShareIconButton`, makes the project tile's middle region a clickable button (replacing the "View Releases" text button), upgrades the drag handle from 3 dots to a 6-dot 2×3 grid (matching the SPERT Suite convention), restructures the per-tile icon row to keep right-side icons pixel-aligned across owner/non-owner tiles, and shrinks every per-tile icon button from 20×20 to 18×18.

**ShareIconButton (new).** Models exactly on the v17.1 / v19.0 grayscale-at-rest icon-button pattern (`PencilIconButton`, `TrashIconButton`, `ExportIconButton`, `CloneIconButton`). Borderless, transparent background at rest, gray icon (`#9ca3af`); on hover/focus the icon turns cyan (`#06b6d4`), the background tints cyan (`#ecfeff` light / `rgba(6,182,212,0.15)` dark), and a soft cyan ring (`0 0 0 1.5px rgba(6,182,212,0.5)`) appears via `box-shadow`. Transition `background 0.12s ease, box-shadow 0.12s ease`. Glyph is a user-plus (person silhouette + crosshair plus sign).

**Clickable project tile.** The middle region of every project tile (project name + release-count + finish-date metadata) is now its own `<button>` that navigates to the Releases tab on click. While the cursor is over the clickable middle region, the **entire tile** tints faint teal (`#f0fdfa` light / `rgba(20,184,166,0.10)` dark — matched to the SPERT brand teal `#14b8a6`) — drag handle, share slot, divider, and icon buttons all included — so the affordance reads at a glance even though the icons themselves are not part of the click target. Move off the middle region (onto an icon, the handle, or the surrounding padding) and the tile returns to grayscale. Focus mirrors the same state for keyboard users. The button sits as a flex-1 sibling between the drag handle and the icon group, so click events on the icons cannot bubble into the tile click — no `stopPropagation` plumbing required. `aria-label="Open releases for {project.name}"` gives screen readers a clear action name. The "View Releases" text button has been deleted; the action lives entirely in the tile gesture now. Outer-tile `draggable={true}` + drag handlers preserved verbatim.

**6-dot drag handle.** `DragHandle` is now a 2×3 grid of 6 dots instead of a 3-dot vertical column. Matches the SPERT Suite (Story Map, Forecaster, CFD, AHP) convention. Component is a CSS grid with `gridTemplateColumns: 'repeat(2, 4px)'` and `gridTemplateRows: 'repeat(3, 4px)'`; `cursor: grab` retained.

**Drag source restricted to handle.** `draggable={true}` and the `onDragStart` / `onDragEnd` handlers moved off the outer tile and onto a wrapper around the 6-dot handle. The outer tile keeps `onDragOver` so it remains a valid drop target — you can still drop anywhere on a tile to reorder, but you can only *initiate* a drag from the handle. `setDragImage(tile, 12, height/2)` is called in `onDragStart` so the drag ghost shows the whole tile rather than just the tiny handle. Cursor map across the tile is now: `grab` only on the 6 dots → `default` on the surrounding padding → `pointer` on the clickable middle → `default` between divider and icons → `pointer` on each icon button. The wrapper carries `aria-label="Drag to reorder project"` for screen readers.

**ProjectsTab icon-row restructure.** The icon area on each project tile is now two sub-groups separated by a thin vertical divider (`1px × 20px`, `colors.border`). The left slot is a fixed-footprint container (`width: calc(18px + 0.7rem)`, `height: calc(18px + 0.7rem)`, `flexShrink: 0`) that renders `<ShareIconButton>` only when `isCloudMode && user && project.owner === user.uid`. When the gate is false the slot stays the same width but is empty, so the right group (Export, Edit, Clone, Delete) keeps the same x-position on every tile regardless of ownership or storage mode.

**18×18 icon resize.** All five icon buttons (`ShareIconButton`, `ExportIconButton`, `PencilIconButton`, `CloneIconButton`, `TrashIconButton`) now ship with `width="18" height="18"` on the `<svg>` element. `viewBox="0 0 24 24"` is unchanged in every case — stroke widths scale, not crop. Header version annotations bumped to `v0.23.0` on the four pre-existing files.

**Modified Files:**
- `src/shared/components/ShareIconButton.tsx` — NEW
- `src/shared/components/DragHandle.tsx` — 3 dots → 6 dots (2×3 grid); header bump
- `src/shared/components/__tests__/DragHandle.test.tsx` — assertion 3 → 6 dots
- `src/shared/components/TrashIconButton.tsx` — 20→18 + header bump
- `src/shared/components/PencilIconButton.tsx` — 20→18 + header bump
- `src/shared/components/ExportIconButton.tsx` — 20→18 + header bump
- `src/shared/components/CloneIconButton.tsx` — 20→18 + header bump
- `src/features/projects/ProjectsTab.tsx` — import `ShareIconButton`, replace text Share button with fixed-width share slot + divider + icon group; replace "View Releases" text button with clickable middle-region `<button>` (teal hover); `tileHoverId` state added
- `src/features/projects/__tests__/ProjectsTab.test.tsx` — navigation test retargeted to `aria-label="Open releases for Alpha"` (was: text "View Releases")
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All existing tests pass (1161 baseline preserved)
- Production build succeeds with Turbopack
- Manual: per-tile right-side icons stay pixel-aligned across local and cloud modes; ShareIconButton hover renders cyan icon + cyan tint + cyan ring together; project tile middle hovers teal and opens Releases tab on click; 6-dot handle visible to the left of the project name; ShareDialog opens unchanged on share-icon click

---

## Version 0.22.2 (2026-05-09)
### Security: app-side companion to the v0.22.2 Firestore rules audit (S1, S2, S3, S4, S5, S6, S7, S9)

This is the GanttApp client-side companion to the suite-wide `firestore.rules` deploy. No user-visible behavior changes; the entire release is defense-in-depth and identity-leak cleanup. Findings ID prefix `S` is from the v0.22.2 GanttApp security audit; rules-side changes (S1 rule layer, S2, S4) ship in `spert-landing-page` and deploy via Firebase Console / `firebase deploy --only firestore:rules`.

**S1 / S8 (HIGH) — legacy `shareProject()` deleted.** The pre-flag-on single-email Share path performed an unbounded `getDocs(collection('ganttapp_profiles'))` scan to resolve email→uid client-side. Combined with the prior `allow read: if isAuth()` rule on `ganttapp_profiles`, this permitted bulk profile enumeration by any authenticated SPERT user. Bulk invitations via the `sendInvitationEmail` Cloud Function are now the only email→share path. Companion rules tighten `ganttapp_profiles` to `get` + `limit(1)`-constrained `list`. Removals: `shareProject()` in `firestore-sharing.ts`, the corresponding method on `CloudGanttStorageService`, the `INVITATIONS_ENABLED === false` legacy panel in `ShareDialog`, the parent's `email`/`role`/`handleShare` legacy state, the `shareProject` describe blocks in `firestore-sharing.test.ts` and `firestore-gantt-storage-service.test.ts`, and the dead `FirestoreDriver` class + its test (V11).

**S2 (M5) — `ganttapp_projects` create rule binds `owner`.** Companion rules-only change. App code already wrote `owner: uid` on create; the rule layer now requires it (`request.resource.data.owner == request.auth.uid`), matching Story Map v0.29.2 / Forecaster / CFD / AHP.

**S3 Option A — `confirmKeepLocalCopy` strips cloud `owner` UID.** When a user retains their cloud projects locally on cloud→local switch, each project's `Project.owner` Firebase UID was previously persisted to `localStorage`. Subsequent browser users could read it after sign-out, cross-referencing identity across SPERT apps. Now stripped before `localService.saveAppData(...)` via destructure-and-spread. Round-trip preserved: re-upload via `projectToFirestoreMeta` re-binds `owner` from the current authenticated user.

**S4 (M4) — `ganttapp_projects` + releases + snapshots field allowlists.** Companion rules-only change. Three helper functions (`ganttAppProjectFields`, `ganttAppReleaseFields`, `ganttAppSnapshotFields`) match the converters in `firestore-converters.ts`. `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update. Closes the gap where any owner/editor could write arbitrary unknown fields.

**S5 — `Project.owner` UID stripped from JSON exports.** New `stripCloudIdentity()` helper in `export.ts` applied at all four export entry points (`exportData`, `exportAllProjects`, `exportSingleProject`, `exportSelectedProjects`). The cloud user's Firebase UID is no longer present in exported JSON files, where it could be cross-referenced if files are shared. The deliberate `_exportedBy` user attribution and `_storageRef` provenance metadata remain — only the per-project `Project.owner` field is stripped.

**S6 — `claimPendingInvitations` failure log no longer includes UID.** `console.error` in `AuthContext.tsx` previously logged `firebaseUser.uid` alongside the error code. Devtools / screenshares would otherwise expose the user's Firebase identity. Server-side Cloud Function logs include the authenticated UID via the request context, so triage doesn't lose anything.

**S7 — bare `AuthContext.signOut` deleted.** The exposed-but-unused `signOut` callback on the auth context value called `firebaseSignOut(auth)` directly, bypassing `performSignOutWithCleanup` (no cancelPendingSaves, no runAppDataReset, no storage swap, no localStorage cleanup). Verified zero live consumers via grep before deletion. All sign-out paths must now route through `StorageContext.performSignOutWithCleanup` — there is no longer an alternative.

**S9 — `subscribeToProject` permission-denied unsubscribe.** When a project owner removes a user mid-session, the user's `onSnapshot` listener fires a permission-denied error. Previously the listener kept retrying and remained in `this.unsubscribers`, occupying a slot. Now the error callback explicitly calls `unsubscribe()` and removes the entry on `permission-denied` only. Other error codes (`unavailable`, `deadline-exceeded`) remain transient and are left to the SDK's retry loop.

**Modified Files:**
- `src/shared/storage/firestore-sharing.ts` — deleted `shareProject()`; removed `setDoc` import
- `src/shared/storage/firestore-gantt-storage-service.ts` — removed `shareProject` from interface + class; hardened `subscribeToProject` error handler (S9)
- `src/shared/storage/index.ts` — removed `FirestoreDriver` and `shareProject` exports
- `src/shared/storage/firestore-driver.ts` — DELETED (dead code, V11)
- `src/shared/storage/__tests__/firestore-driver.test.ts` — DELETED
- `src/shared/storage/__tests__/firestore-sharing.test.ts` — removed `shareProject` describe block
- `src/shared/storage/__tests__/firestore-gantt-storage-service.test.ts` — removed `shareProject` describe block
- `src/features/projects/ShareDialog.tsx` — removed legacy single-email panel and the `INVITATIONS_ENABLED === false` branch; cleaned up parent state and unused imports
- `src/features/projects/__tests__/ShareDialog.test.tsx` — removed `shareProject` from mock factory
- `src/context/AuthContext.tsx` — deleted bare `signOut` from context (S7); removed UID from claim-failure log (S6)
- `src/context/__tests__/AuthContext.test.tsx` — removed `signOut` test
- `src/context/StorageContext.tsx` — strip `owner` UID in `confirmKeepLocalCopy` (S3 Option A)
- `src/shared/utils/export.ts` — added `stripCloudIdentity()` helper applied at four export entry points (S5)
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All existing tests pass (1175 baseline → reduced by deleted shareProject + FirestoreDriver tests; final count established at PR merge)
- Production build succeeds with Turbopack

---

## Version 0.22.1 (2026-05-09)
### Refactor: in-file InvitationSection extraction + small dedupe sweep + sanitization hardening

This is a focused patch release: one in-file decomposition, two small DRY extractions, five small bug/safety fixes, and two type-declaration version bumps. No behavioral changes for end users.

**ShareDialog.tsx — InvitationSection extracted in-file (Story Map v0.29.1 pattern).** The bulk-invitation flow (textarea + role select + send button + invalid-tokens chip + send-result chip + pending-invitations list + revoke confirm modal) is now defined as `InvitationSection` in the same file beneath the existing member-management code. Parent (`ShareDialog`) retains: `OwnerStatus` enum, `members` state, the members-loading `useEffect`, the legacy single-email panel JSX, the remove-member `ConfirmDialog`, and the shared error path for legacy share + remove-member operations. `InvitationSection` owns its own bulk-flow state — `bulkEmail`, `role`, `bulkSending`, `sendResult`, `bulkInvalidEmails`, `pendingInvites`, `pendingLoading`, `actionBusy`, `revokeConfirmToken`, plus a localized `inviteError` so a stale bulk-send error can't leak into the member-removal UX. Members refresh after a successful send is handled via the new `onMembersUpdate` prop, and the existing `Promise.allSettled` post-send refresh + per-resource console.warn (LESSONS-LEARNED §64) is preserved verbatim. The legacy single-email panel is deliberately NOT extracted — it is marked for deletion when `INVITATIONS_ENABLED` becomes permanent, and creating a file destined for deletion would be churn for no benefit.

**`triggerJsonDownload(payload, filename)` extracted in `export.ts`.** The four export entry points (`exportData`, `exportAllProjects`, `exportSingleProject`, `exportSelectedProjects`) each contained an identical 9-line `Blob` → `URL.createObjectURL` → `<a download>` → `URL.revokeObjectURL` block. Centralized in a single private helper at the top of the file. Single point of change for download UX (e.g., a future progress toast). No behavioral change.

**`listMemberProjects()` extracted in `FirestoreGanttStorageServiceImpl`.** The "constrained `where('members.${uid}', 'in', [...])` query + client-side defense-in-depth membership filter" preamble was duplicated across `loadAppData`, `loadSnapshots`, and `saveSnapshots` (all three carrying the v0.21.0 docstring rationale). Now a single private method; the docstring lives there. No behavioral change.

**Fix — `useInvitationLanding` cloud auto-flip rejection.** Previously `void switchMode('cloud').catch(() => {})` silently swallowed any flip failure, leaving the banner stuck in `pre_auth` indefinitely with no console signal. Now logs a `[useInvitationLanding] cloud auto-flip failed:` warning, consumes `SESSION_KEY` (symmetric with `dismiss()` and Effect 4's grace-timer path), then transitions the banner back to `idle`. Recovery is automatic on transient Firestore errors.

**Fix — `shareProject` `meta.members` null guard.** `meta.members[uid]` was accessed without first verifying `meta.members` exists. A malformed project document (missing the `members` field) would throw an unhandled `TypeError` instead of the friendly "Only the project owner can share projects." error. Now guards with `if (!meta.members || meta.members[uid] !== 'owner')`. Same friendly error message; no behavioral change for healthy documents.

**Fix — Firestore-input sanitization in `firestore-converters.ts`.** `userSettingsToAppData` (settings load path) and `firestoreSnapshotToFlat` (snapshot read path) previously cast `chartColors` and `chartDisplaySettings` from Firestore directly to their typed interfaces without sanitization. Now route both through the existing `sanitizeChartColors` / `sanitizeDisplaySettings` helpers from `validation.ts` — defense-in-depth against future Firestore schema drift, manually edited documents, or third-party tools writing to the same collections. Both helpers already returned defaults on malformed input; no new utility code.

**Refactor — `migrateReleaseStatus` signature.** Accepts `{ status?: unknown; completed?: unknown }` directly instead of `Record<string, unknown>`. Eliminates the two `data as unknown as Record<string, unknown>` double casts at the call sites in `firestore-converters.ts` (`firestoreReleasesToFlat` and `firestoreSnapshotToFlat`). Pure type-signature change; runtime behavior unchanged.

**Deps — type-only bumps.** `@types/react` `^19` → `^19.2.14` (released 2026-02-11); `@types/react-dom` `^19` → `^19.2.3` (released 2025-11-12). Both pre-60-day window. All other dependency updates (firebase, next, react, vitest, eslint-config-next, etc.) released within the 60-day window per repo policy and are intentionally held for v0.22.2+.

**Modified Files:**
- `src/features/projects/ShareDialog.tsx` — defined `InvitationSection` in-file; moved bulk-flow state, listPendingInvites useEffect, bulk handlers, and revoke ConfirmDialog into it; replaced flag-on render branch
- `src/shared/utils/export.ts` — added `triggerJsonDownload` helper; deduped 4 download blocks
- `src/shared/utils/validation.ts` — `migrateReleaseStatus` signature change
- `src/shared/utils/firestore-converters.ts` — applied sanitizers at 3 cast sites; dropped 2 double casts
- `src/shared/storage/firestore-gantt-storage-service.ts` — added `listMemberProjects()` private helper; deduped 3 preambles; added `QueryDocumentSnapshot` to firestore-type imports
- `src/shared/storage/firestore-sharing.ts` — added `meta.members` null guard in `shareProject`
- `src/shared/hooks/useInvitationLanding.ts` — replaced silent catch with logged-rejection + idle reset path (consumes `SESSION_KEY` first)
- `src/shared/storage/__tests__/firestore-sharing.test.ts` — +1 test for `members === undefined` guard
- `src/shared/hooks/__tests__/useInvitationLanding.test.ts` — new test file, +1 test for cloud auto-flip rejection branch
- Version + docs: `src/lib/version.ts`, `package.json` (with type-decl bumps), `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All 1173 existing tests pass; +2 targeted tests added (1175 total)
- Production build succeeds with Turbopack

---

## Version 0.21.1 (2026-05-05)
### UX: De-emphasize Export All / Import toolbar buttons

The Export All and Import buttons in the Projects toolbar were filled, high-contrast buttons with emoji + bold label. They are infrequently used (most users export at end of session, import only when restoring or transferring a workspace) and were the last toolbar elements still using the pre-v17.1 button style.

This release rebuilds them as grayscale icon+text buttons that adopt color only on hover/focus, matching the v17.1 trashcan and v19.0.0 per-tile icon button pattern:

- **At rest:** icon stroke + text in `#9ca3af`, transparent background, transparent 1px border (reserves space, no layout shift on hover), `0.4rem 0.75rem` padding, `0.4rem` icon-text gap, font-weight `500`
- **Export All hover/focus:** icon + text `#10b981`, 1px green border, soft green background fill (`#ecfdf5` light / `rgba(16, 185, 129, 0.15)` dark)
- **Import hover/focus:** icon + text `#0070f3` (GanttApp primary blue, same as `PencilIconButton`), 1px blue border, soft blue background fill (`#eff6ff` light / `rgba(0, 112, 243, 0.15)` dark)
- `transition: all 0.12s ease` on both, matching existing icon buttons

**Icons.** Export All reuses the exact SVG path from `ExportIconButton` (down-arrow-into-tray) at 18×18 instead of 20×20, since the icon is now paired with a text label. Import uses an inline up-arrow-into-tray glyph (`d="M21 15v4...M17 8l-5-5-5 5M12 3v12"`) — same tray, chevron points up, vertical bar terminates at the top — so the two read as a matched pair.

**Implementation.** Inline in `ProjectsTab.tsx`, not a new shared component. Two reasons: only two call sites ever; the Import button must remain a `<label>` wrapping a hidden file `<input>` so the native file picker opens without a click handler — awkward to model in a generic icon-button component. Hover state is two local `useState<boolean>` hooks (`exportAllHover`, `importHover`) with `onMouseEnter` / `onMouseLeave` / `onFocus` / `onBlur`, matching the inline hover pattern already used elsewhere in this file. Added `resolvedTheme` to the existing `useTheme()` destructure for the dark-mode hover-bg variant.

**A11y.** Both buttons gain `aria-label`s ("Export all projects as JSON", "Import projects from JSON") so screen reader users still get a clear action name as the visible styling becomes more subtle. Visible text labels ("Export All", "Import") preserved — existing test queries by visible text continue to work.

**No behavior changes.** Click handlers, file-picker behavior, the v19.0.0 toolbar position (between form card and tile list), and zero-projects centering (`justifyContent: data.projects.length === 0 ? 'center' : 'flex-end'`) all preserved.

**Modified Files:**
- `src/features/projects/ProjectsTab.tsx` — added `resolvedTheme` to `useTheme()` destructure, two `useState` hover hooks, replaced the two filled `<button>` / `<label>` JSX blocks with grayscale-on-rest / colored-on-hover icon+text variants
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`, `CLAUDE.md`

**Verification:**
- TypeScript type-check clean
- Lint clean
- All tests pass (cosmetic restyling — visible text labels unchanged, no new tests required)
- Production build succeeds with Turbopack

---

## Version 0.21.0 (2026-05-05)
### Fix: Cloud projects load again in multi-tenant Firestore

User reported all cloud project loads failing with `Permission denied` errors after multiple uids accumulated in the `ganttapp_projects` collection (Microsoft + Google profile sessions during v0.20.1 testing). Root cause: the Firestore `list` rule referenced `resource.data.members[request.auth.uid]`, which Firestore cannot evaluate for `list` operations (rules apply to query shape, not per-document). The unconstrained `getDocs(collection(...))` call worked when the user owned every project in the collection, broke as soon as any foreign-owned doc was present.

**App fix:** Three unconstrained collection queries in `firestore-gantt-storage-service.ts` (`loadAppData` line 116, `loadSnapshots` line 191, `saveSnapshots` line 223) now use a constrained `where('members.${uid}', 'in', ['owner', 'editor', 'viewer'])` clause. Server-side filter returns only the user's projects. Client-side membership check kept as defense-in-depth.

**Rules fix:** `ganttapp_projects/list` rule relaxed to `if isAuth()` only. Rules cannot validate dynamic field paths in `where()` clauses, so the suite-wide canonical pattern is to authenticate the list, then trust the constrained `where()` clause to filter results server-side. Matches the pattern adopted by SPERT-Story-Map in v0.14.3 and documented in `cloud-storage-guide/ARCHITECTURE.md` §6.5 + §7.

**Security tradeoff:** authenticated SPERT users could in principle issue an unconstrained `list` to see project metadata (name, owner, members map, finishDate, workDays, legendLabels). No release content or snapshot content is exposed (subcollection rules unchanged — still use `isMemberGet(projectId)`). This is the same security posture every other SPERT app's projects collection already operates under.

**Modified Files:**
- `src/shared/storage/firestore-gantt-storage-service.ts` — added `where` import; constrained queries in `loadAppData`, `loadSnapshots`, `saveSnapshots`
- `src/shared/storage/__tests__/firestore-gantt-storage-service.test.ts` — +1 regression test
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`, `CLAUDE.md`
- (Separate) `spert-landing-page/firestore.rules` — mirror PR after Console deploy

**Verification:**
- All 1166 tests pass (+1 net new)
- TypeScript type-check clean
- Production build succeeds with Turbopack
- Lint clean
- Manual post-deploy: Microsoft sign-in loads projects without console errors; Share button (v0.20.1 fix) appears on owned tiles

---

## Version 0.20.1 (2026-05-05)
### Fix: Share button on owned project tiles in cloud mode

Three related fixes for in-memory `Project.owner` handling, after a user reported the Share button missing on tiles for projects they verifiably owned in Firestore.

**Bug A — `addProject` doesn't seed `owner` (primary cause).** When a project is created in cloud mode, the in-memory `Project` had no `owner` field. Firestore wrote the owner correctly via `projectToFirestoreMeta`, but in-memory state stayed owner-less until the next full reload re-fetched the project. Between creation and reload, the Share button render condition `project.owner === user.uid` evaluated false. Fix: seed `owner` inline in the `newProject` literal when in cloud mode and signed in.

**Gap C — `cloneProject` propagates source's `owner` blindly.** `useProjects.cloneProject` used `...source` spread, so cloning a project shared *to* you carried the original owner's uid into the clone's in-memory state. Firestore overwrote it on save (via `existingMeta?.owner ?? uid`), but in-memory was wrong until reload. Fix: replace bare spread with explicit field copy that excludes `owner`, then conditionally re-add it bound to the current user.

**Bug B — `validateLoadedData` strips `owner` on localStorage round-trip (defense-in-depth).** The localStorage sanitizer dropped the `owner` field. Any path where cloud-mode data round-tripped through the local validator would lose ownership. Fix: preserve `owner` through `sanitizeId()` when present.

**Modified Files:**
- `src/features/projects/useProjects.ts` — added `useAuth()`, seed `owner` in `addProject` and `cloneProject`
- `src/shared/utils/storage.ts` — preserve `owner` field in `validateLoadedData`
- `src/lib/version.ts` — `APP_VERSION` → `0.20.1`
- `package.json` — version field
- `src/features/changelog/changelog-data.tsx` — new entry prepended
- `CHANGELOG.md`, `public/CHANGELOG.md` — new entry prepended
- `CLAUDE.md` — Current Version + this subsection
- `src/features/changelog/__tests__/ChangelogTab.test.tsx` — version-order assertion updated
- `src/features/projects/__tests__/useProjects.test.tsx` — +2 regression tests
- `src/shared/utils/__tests__/storage.test.ts` — +4 regression tests

**Verification:**
- All 1171 tests pass (up from 1165, +6 net new)
- TypeScript type-check clean (0 errors)
- Production build succeeds with Turbopack
- Lint clean

---

## Version 0.20.0 (2026-05-04)
### Versioning realignment with SPERT® Suite

GanttApp's versioning is being reset from `19.0.0` to `0.20.0` to align with the rest of the SPERT® Suite, which uses standard `0.x.x` semver because none of those apps have reached a true 1.0 yet (planned for 2027). GanttApp was the first app in the suite and predated the convention. This is a one-time deliberate jump with zero functional impact — no code or behavior changes ship in this release. The "20" preserves the "20th release" intuition (v19 was last).

All historical changelog entries below remain labeled under their original version numbers (v3.0 through v19.0.0) — we don't rewrite history.

**Going forward**, GanttApp follows standard pre-1.0 semver:
- **Patch** bumps (`0.20.1`) — bug fixes, security patches, copy/style tweaks, doc-only changes.
- **Minor** bumps (`0.21.0`) — new features, behavior changes, refactors that touch user-visible state.
- No MAJOR bump until the eventual 1.0 launch (planned 2027).

This is a behavior change from the prior habit of treating MAJOR as feature-level (e.g. v18.0.0, v19.0.0 were feature releases under the old convention).

**Modified Files:**
- `src/lib/version.ts` — `APP_VERSION` constant
- `package.json` — version field (and `package-lock.json` regenerated by `npm install`)
- `src/features/changelog/changelog-data.tsx` — new entry prepended
- `CHANGELOG.md`, `public/CHANGELOG.md` — new entry prepended
- `CLAUDE.md` — Current Version + new history subsection
- `src/features/changelog/__tests__/ChangelogTab.test.tsx` — assertion updated

**Verification:**
- All tests pass
- TypeScript type-check clean (0 errors)
- Production build succeeds with Turbopack
- Lint clean

---

## Version 19.0.0 (2026-05-04)
### Per-project export, clone, and merge import

User-facing release. Project tiles get three new icon buttons next to Delete: download (export single project), pencil (edit), and duplicate (clone). The clone copies the project, all releases, and all snapshots; if cloning snapshots would exceed the 100-snapshot workspace cap, the project + releases still clone and the user is told via `alert()` that snapshots were skipped.

Importing a single-project file (anything tagged `_exportType: 'ganttapp-project-export'`) now performs an additive merge instead of a full replace. Projects whose `id` collides with an existing one are skipped with a count reported to the user. Importing an Export-All file (`_exportType: 'ganttapp-all-projects'`) or a legacy file with no `_exportType` still triggers the existing replace-all confirmation dialog — behavior is unchanged for those.

A new **Export Projects** section in Settings lets the user pick one, several, or all projects via checkboxes, with an optional all-or-nothing "Include snapshots" toggle.

The Export All / Import buttons moved out of the page header row into a toolbar row between the project form and the project tile list. Import remains visible at zero projects (must be reachable for first-import); Export All is hidden at zero projects.

The local-storage warning banner's text and "Got it" button are now vertically centered.

**New shared icon-button components (3):**
- `src/shared/components/PencilIconButton.tsx` — blue (`#0070f3`) hover.
- `src/shared/components/ExportIconButton.tsx` — green (`#10b981`) hover.
- `src/shared/components/CloneIconButton.tsx` — violet (`#8b5cf6`) hover.

All three follow the v17.1 `TrashIconButton` pattern: grayscale `#9ca3af` at rest, theme-aware tinted hover background, hover via `useState` + `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur`, `disabled` prop suppresses hover.

**New export utility functions (`src/shared/utils/export.ts`):**
- `exportSingleProject(projectId, data, storage, options)` — downloads project + releases (+ optional snapshots) tagged `_exportType: 'ganttapp-project-export'`. Filename `ganttapp-{slug}-{YYYY-MM-DD}.json`.
- `exportSelectedProjects(projectIds, data, storage, options)` — same shape, batch variant. Filename `ganttapp-projects-export-{YYYY-MM-DD}.json`.
- `mergeImportedProjects(existing, incoming, existingSnapshots)` — partitions incoming projects by ID-collision, returns `{ mergedData, mergedSnapshots, skipped }`. Releases and snapshots filtered to accepted project IDs; snapshot dedup by ID.

**`ImportResult` type extended** with discriminator field `exportType: 'ganttapp-all-projects' | 'ganttapp-project-export' | 'legacy'` (set by `parseImportedData()` from `imported._exportType`). The `applyImport` (replace-all) call site uses it to route between the existing replace-all confirm dialog and the new merge confirm dialog.

**`cloneProject` added to `useProjects`:**
- Builds a unique name with `- Copy (N)` suffix (collision-checked against existing names).
- Inserts the clone immediately after the source in the project list.
- Selection stays on the original project — user does not lose their place.
- Snapshot block uses `storage.saveSnapshots([...existing, ...cloned])` (single batch write, not `Promise.all` of `addSnapshot` — would race on the cloud implementation).
- Pre-checks the 100-snapshot cap; if cloning snapshots would exceed it, project + releases still clone and the user gets an `alert()` saying snapshots were skipped.

**Settings → Export Projects section (new):**
- New file `src/features/settings/ExportProjectsSection.tsx`. Inline-styled (matches Settings convention).
- Per-project checkbox + release count. "Select all" / "Deselect all" toggle in the header row. "Include snapshots" toggle below the list.
- Disabled when no projects selected; disabled during in-flight export.
- Wired into `SettingsTab` after `ExportAttributionSection` and before `WorkWeekSection`.

**Refactor — snapshot-limits constants extracted:**
- `MAX_SNAPSHOTS_TOTAL = 100` and `MAX_SNAPSHOTS_PER_PROJECT = 50` were duplicated as private `const`s in both `local-gantt-storage-service.ts` and `firestore-gantt-storage-service.ts`. Extracted to `src/shared/storage/snapshot-limits.ts` and imported by all three call sites (the two storage services and `useProjects.cloneProject`). Single source of truth.

**Refactor — `ConfirmDialog` modal-mode `'primary'` variant:**
- Modal-mode rendering only handled `'danger'` vs default outline. Added a `'primary'` branch (`#0070f3` background, white text, no border) used by the new merge-import "Add Projects" CTA.
- Inline-mode rendering already handled `'primary'` (transparent bg, blue outline) since v12.1. Unchanged.

**Per-tile action group (final left-to-right order):**
```
[View Releases]  [Share — cloud only]  [⬇ Export]  [✏ Edit]  [⧉ Clone]  [🗑 Delete]
```

**Edit-pencil UX:**
- Click scrolls to top via `window.scrollTo({ top: 0, behavior: 'smooth' })`.
- 600 ms blue-glow highlight pulse on the form card via local `editHighlight` state + setTimeout.
- Keyboard (`tabIndex` is the wrapping `<button>`) and screen reader (`aria-label="Edit project"`) parity with the prior text button.

**Modified Files:**
- `pages/index.tsx` — version footer.
- `package.json`, `src/lib/version.ts` — version bump.
- `src/shared/components/LocalStorageWarningBanner.tsx` — `alignItems: 'flex-start'` → `'center'`.
- `src/shared/components/ConfirmDialog.tsx` — modal-mode `'primary'` branch.
- `src/shared/utils/export.ts` — extended `ImportResult`, three new export functions, slug helper.
- `src/shared/utils/index.ts` — re-export the three new functions.
- `src/shared/storage/local-gantt-storage-service.ts`, `src/shared/storage/firestore-gantt-storage-service.ts` — import snapshot caps from `snapshot-limits.ts`.
- `src/features/projects/useProjects.ts` — `cloneProject`.
- `src/features/projects/ProjectsTab.tsx` — toolbar repositioning, three new icon buttons per tile, `editHighlight`, `applyMergeImport`, merge confirm dialog.
- `src/features/settings/SettingsTab.tsx` — wire `<ExportProjectsSection>`.
- Version + docs: `src/features/changelog/changelog-data.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`, `CLAUDE.md`, `ARCHITECTURE.md`.

**New Files (10):**
- `src/shared/components/PencilIconButton.tsx`, `ExportIconButton.tsx`, `CloneIconButton.tsx`.
- `src/shared/storage/snapshot-limits.ts`.
- `src/features/settings/ExportProjectsSection.tsx`.
- Tests: `__tests__/PencilIconButton.test.tsx`, `__tests__/ExportIconButton.test.tsx`, `__tests__/CloneIconButton.test.tsx`, `src/features/settings/__tests__/ExportProjectsSection.test.tsx`, `src/shared/storage/__tests__/snapshot-limits.test.ts`.

**Verification:**
- All tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.

---

## Version 18.0.0 (2026-05-04)
### Bulk Invitations

Major feature release: bulk-invitation flow on the Share Project dialog. Project owners paste multiple email addresses, pick a role, and send invitations in one round-trip via the SPERT&reg; Suite Cloud Functions. Existing suite members are auto-added immediately; new users receive a branded invitation email and are auto-claimed on next sign-in.

**New on the Share Project dialog (cloud mode only):**
- Bulk email textarea — splits on commas, semicolons, and whitespace; lowercases and dedupes.
- Role selector — Editor or Viewer (the same two roles supported by single-email sharing).
- Result chip after sending — `Added N: ...`, `Invited N: ...`, `Skipped N: <email> (reason)`.
- Pending invitations list — shows recipient email, role, and `sent N/5` send-count. Per-row Resend (text button) and Revoke (trashcan icon with `ConfirmDialog`).
- Server-side caps enforced by Cloud Functions: 25 invitations / user / day; 5 resends per pending invitation.

**New `InvitationBanner` (mounted above `FirstRunBanner`):**
- Three states: `idle` (hidden), `pre_auth` (URL contains `?invite=<token>` or sessionStorage token survives reload), `claimed` (`spert:models-changed` event fired with one or more claimed models).
- Pre-auth state shows Google and Microsoft sign-in buttons. Sign-in routes through the existing `useSignInWithTosGate` hook (v17.0); Terms-of-Service consent flow cannot be bypassed.
- Claimed state shows "You've been added to: &lt;project list&gt;" and the projects appear in the project list automatically.

**Backend prerequisite (already deployed):**
- `spert-landing` Cloud Functions register `ganttapp` as a supported `appId`. Allowed origins: `https://ganttapp.spertsuite.com` (prod) and `http://localhost:3000` through `http://localhost:3010` (dev). From-line branded as "via GanttApp".

**Architecture changes:**
- `writeUserProfile` in `AuthContext` dual-writes `ganttapp_profiles/{uid}` + `spertsuite_profiles/{uid}` on every auth resolution. The cross-app `spertsuite_profiles` write enables `sendInvitationEmail`'s email→uid lookup. Microsoft AD "Last, First Middle" displayName format is denormalized to "First Middle Last" via the new `denormalizeLastFirst` helper (mirrors the server-side normalization in `mailHeaders.ts`).
- `setUserAndClaim` is the single exit point for every authenticated `onAuthStateChanged` callback path. It calls `writeUserProfile` (fire-and-forget), `setUser`, then `claimPendingInvitationsAndNotify`. The latter calls the `claimPendingInvitations` Cloud Function and dispatches a `spert:models-changed` window event with the array of newly-claimed models.
- `createUserProfile` deleted from `firestore-sharing.ts` and `FirestoreGanttStorageServiceImpl`. Two prior call sites (`StorageContext.tsx` mount-restore branch and `storage-mode-switch.ts` cloud upload) removed. Profile writes are no longer gated on cloud-mode switching.
- `removeProjectMember` renamed → `removeCollaborator`. Refactored to use `deleteField()` on the specific `members.{uid}` key with `merge: true`, rather than overwriting the full document. Race-safe under concurrent membership changes. Rename applies in both flag states; the flag-off Share input panel JSX is preserved byte-identical.
- `listPendingInvites(projectId)` query reuses the existing composite index `(inviterUid ASC, modelId ASC, createdAt DESC)` on `spertsuite_invitations`. Status filter (`status === 'pending'`) is applied in code, not in the query, to stay within the deployed index.

**Save-back guard for cross-app claim events:**
- `AppDataContext` listens for `spert:models-changed` events. When dispatched in cloud mode, the listener bumps a `reloadCounter` state, which is in the load effect's dependency array — triggering `loadAppData()` to refresh the project list with the newly-claimed project.
- A new `loadedDataRef` mechanism in the save effect short-circuits when `data === loadedDataRef.current`, ensuring the post-load save effect run does NOT write the just-loaded cloud data back to Firestore. Without this, every claim event would trigger a full Firestore write and risk clobbering concurrent collaborator edits on the just-claimed project. Covered by a CI-gated regression test (`src/context/__tests__/AppDataContext.spertModelsChanged.test.tsx`).

**Cloud Functions integration (`src/lib/firebase.ts`):**
- New `firebase/functions` import. Module-scoped `functionsInstance` initialized when `isFirebaseAvailable === true`. Region `us-central1`.
- Four typed callable getters: `getSendInvitationEmail`, `getClaimPendingInvitations`, `getRevokeInvite`, `getResendInvite`. Each returns `null` when Firebase is unavailable. The callable `appId` is hardcoded as the string literal `'ganttapp'`, distinct from `APP_ID` in `version.ts` (LESSONS-LEARNED §15).

**New utilities:**
- `src/lib/auth-name.ts` — `denormalizeLastFirst()` (mirrors `mailHeaders.ts`).
- `src/lib/invitation-errors.ts` — `mapInvitationError(err, context)` with `'send' | 'resend' | 'revoke'` discriminator. Required because Firebase HttpsError codes are a small enum (`resource-exhausted` means different things in send vs resend; LESSONS-LEARNED §13).
- `src/shared/utils/parseBulkEmails.ts` — splits on commas/semicolons/whitespace, lowercases, dedupes. Uses `Array.from(new Set(...))` rather than spread (`tsconfig` target is `es5`).
- `src/lib/feature-flags.ts` — `INVITATIONS_ENABLED` constant.

**New shared components:**
- `src/shared/components/AuthProviderLogos.tsx` — `GoogleLogo` and `MicrosoftLogo` SVGs extracted verbatim from `CloudStorageModal.tsx` so `InvitationBanner` can reuse them.
- `src/shared/components/InvitationBanner.tsx` — three-state banner driven by `useInvitationLanding`.
- `src/shared/hooks/useInvitationLanding.ts` — Pages Router-compatible hook (uses `window.location` / `history.replaceState`; no `<Suspense>` boundary needed because GanttApp does not use the App Router).

**Modified Files (16):**
- `pages/index.tsx` — mount `InvitationBanner` above `FirstRunBanner`.
- `src/context/AppDataContext.tsx` — `reloadCounter`, `loadedDataRef`, `spert:models-changed` listener.
- `src/context/AuthContext.tsx` — `firebaseAvailable` field, `writeUserProfile`, `claimPendingInvitationsAndNotify`, `setUserAndClaim` single-exit-point.
- `src/context/StorageContext.tsx` — removed `createUserProfile` mount-restore call.
- `src/context/storage-mode-switch.ts` — removed `createUserProfile` cloud-upload call.
- `src/features/projects/ShareDialog.tsx` — bulk send, pending list, Resend/Revoke handlers, two-boolean busy-state split (`bulkSending` vs per-invite `actionBusy`).
- `src/lib/firebase.ts` — `firebase/functions` integration + 4 callable getters.
- `src/shared/components/CloudStorageModal.tsx` — extracted logos imported from new `AuthProviderLogos.tsx`.
- `src/shared/storage/firestore-gantt-storage-service.ts` — interface + 4 cloud methods.
- `src/shared/storage/firestore-sharing.ts` — `removeCollaborator` (renamed + refactored), `listPendingInvites` (new), `createUserProfile` (deleted).
- `src/shared/storage/index.ts` — barrel export updated.
- `src/shared/types/firestore.ts` — `PendingInvite` type, `InvitationStatus` union.
- Tests: 4 new files + 4 updated files; 1076 → 1108 tests across 65+ files.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`.

**Verification:**
- All tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.
- CORS smoke-test from `https://ganttapp.spertsuite.com` and `http://localhost:3000` against all three new callables — all returned `HTTP/2 204` with correctly-echoed `access-control-allow-origin`.
- Composite index `(inviterUid ASC, modelId ASC, createdAt DESC)` on `spertsuite_invitations` already deployed.

**Manual verification (post-deploy, ongoing):**
- Resend dashboard delivery rate over the first 48 hours.
- `spertsuite_rate_limits` for unexpected 25/day cap hits.
- ToS consent flow with a brand-new Google account.

---

## Version 17.3.3 (2026-05-03)
### Form-Field Hygiene Residual Sweep

Closes the form-hygiene gaps not covered by v17.3.2. Goal: zero form-field-related entries in Chrome DevTools Issues panel.

**Rule 2 — `id` or `name` on every form control.** Every `<input>`, `<textarea>`, and `<select>` in the codebase now carries a `name` attribute. Stable, semantic camelCase names (e.g. `projectName`, `releaseTargetDate`, `showTodayLine`). 31 inputs and 3 selects touched.

**Rule 3 — Label association.** Every sibling-style `<label>` is now associated with its input via `htmlFor` + matching `id`. `id` values come from `useId()` (per-component instance, suffix-per-field) — collision-free across re-renders and concurrent instances. Pattern adopted in 5 files: `ProjectsTab.tsx` (project name + finish date), `ReleaseFormFields.tsx` (5 release-form fields), `DefaultLegendLabelsSection.tsx` (5 rows in `.map()` with per-row stable key), `ExportAttributionSection.tsx` (Name + Identifier), `ColorSwatchPicker.tsx` (Custom Color).

**Rule 4 — Orphan `<label>` cleanup.** `ProjectsTab.tsx` had a `<label>` for the Work Week section pointing at `WorkWeekSelector` (a custom button-group with no single form input). Converted to a styled `<span>` and added an inline comment explaining why.

**Rule 1 — `autoComplete` (one residual).** Added `autoComplete="name"` to the Export Attribution Name input (placeholder "e.g., Jane Smith" matches the personal-name pattern; user's own name; preemptive hygiene). The Identifier sibling stays free of `autoComplete` because its placeholder "e.g., student ID, email, or team name" is intentionally generic.

**Adjacent accessibility fixes (in passing).** Inputs that lack a surrounding `<label>` got `aria-label` so screen readers don't announce them as nameless edit fields:
- ChartSettings "Prepared By" text input.
- ShareDialog email input + role select.
- ReleasesTab project picker select + GanttChart project picker select.
- InlineDateEditor, InlineTextEditor, ChartLegend inline-edit input.

**Skipped (intentional, per the playbook's app-domain rule):**
- Project name, release name, default legend label rows, ChartLegend inline-edit, InlineTextEditor — text inputs collecting app-domain content (titles, labels), not categories the browser knows how to autofill.
- Export Attribution Identifier — intentionally generic format hint.
- All `type="date" | "checkbox" | "radio" | "color" | "file"` inputs — excluded from `autoComplete` by rule.

**No shared form wrapper exists.** Verified zero `Field`/`FormField`/`LabeledInput` components in `src/`. All forms compose `<label>` and `<input>` inline. Touching individual call sites was the right move; no refactor opportunity to propagate.

**Reuse callouts:**
- StorageSection's two radios share `name="storageMode"` (correct radio-group pattern). CloudStorageModal's two radios share `name="cloud-modal-storage-mode"` (same).
- ProjectsTab and ReleasesTab + GanttChart project pickers got distinct names (`releasesTabSelectedProject`, `chartTabSelectedProject`) — they live on different tabs and never coexist in a real `<form>`, so reuse would have been safe, but distinct names make a future `<form>`-wrapping refactor easier.

**Modified Files (15):**
- `src/features/projects/ProjectsTab.tsx` — `useId`, two label/input pairs, file-input `name`, orphan label → `<span>`.
- `src/features/releases/ReleaseFormFields.tsx` — `useId`, five label/input pairs.
- `src/features/releases/ReleasesTab.tsx` — project select `name` + `aria-label`, visibility-checkbox `name`.
- `src/features/settings/DefaultLegendLabelsSection.tsx` — `useId` + per-row `key` field on rows array, label/input pairs in `.map()`.
- `src/features/settings/ExportAttributionSection.tsx` — `useId`, two label/input pairs, `autoComplete="name"` on Name.
- `src/features/settings/TosConsentModal.tsx` — checkbox `name`.
- `src/features/chart/ChartSettings.tsx` — `name` on 5 checkboxes + `name`/`aria-label` on Prepared By text input.
- `src/features/chart/ChartLegend.tsx` — inline-edit input `name` + `aria-label`.
- `src/features/chart/GanttChart.tsx` — project select `name` + `aria-label`.
- `src/features/projects/ShareDialog.tsx` — email input `name` + `aria-label`, role select `name` + `aria-label`.
- `src/shared/components/ColorPickers/ColorSwatchPicker.tsx` — `useId`, label/color-input pair.
- `src/shared/components/InlineDateEditor.tsx` — `name` + `aria-label`.
- `src/shared/components/InlineTextEditor.tsx` — `name` + `aria-label`.
- `src/shared/components/LocalStorageWarningToggle.tsx` — checkbox `name`.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `public/CHANGELOG.md`.

**DevTools Issues panel verification checklist (post-deploy, manual):**
1. Visit `/` (Projects tab default). Open DevTools → Issues panel.
2. Click "Gantt Chart" tab — expand Chart Settings (click the heading).
3. Click "Releases" tab — pick a project; toggle the Show checkbox; click Edit on a release.
4. Click "Settings" tab — interact with Storage, Export Attribution, Default Legend Labels, Notifications.
5. Open ShareDialog (cloud mode only).
6. Open Cloud Storage modal from the header chip.
7. Confirm zero entries under "Form field element should have an id or name attribute", "No label associated with a form field", "Incorrect use of `<label for=FORM_ELEMENT>`", "Duplicate id on a page", and "autocomplete attribute valid value".

**Verification:**
- All 1043 tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.

---

## Version 17.3.2 (2026-05-03)
### Surface Cloud Errors + autoComplete Hygiene

Three-category bug-fix wave from a multi-app Statistical PERT® sweep.

**Cloud auto-save errors no longer silent.** `FirestoreGanttStorageServiceImpl.executeSave` previously logged failures with `console.error` and re-queued the data, but the user never saw that their last edit had failed to reach Firestore. The service now accepts an optional `onSaveResult(error: string | null)` callback. `StorageContext` wires it to a new `saveError` state, which renders in **Settings → Storage** using the same red-text pattern as `switchError` and `authError`. The error clears automatically after the next successful save (the same callback fires with `null` on success).

**`onSnapshot` listeners now have error callbacks.** Both call sites — `FirestoreGanttStorageServiceImpl.subscribeToProject` and `FirestoreDriver.onRemoteChange` — previously passed only a success callback. Permission revocations and network drops failed silently. Both now pass an error handler that logs via `sanitizeFirebaseError`; the project-level subscription additionally surfaces the message through the same `onSaveResult` channel as auto-save. GanttApp does not maintain a doc-keyed listener tracking map, so no entry needs to be removed for re-subscription; a full reconnect mechanism is deferred.

**Two `autoComplete` attributes added.**
- `ShareDialog.tsx` email input → `autoComplete="off"` (collects another user's email, not the signed-in user's — autofilling would be wrong; active browser-warning fix).
- `ChartSettings.tsx` "Prepared By" text input → `autoComplete="name"` (placeholder "Enter your name" matches the personal-name pattern; preemptive hygiene).

**Note on `FirestoreDriver`.** `FirestoreDriver` has no production caller — it is referenced only by its barrel export and test file. The error-handler addition is symmetric maintenance to keep the storage interface implementation consistent for any future use; the runtime risk reduction comes from the `subscribeToProject` site, which is the listener actually used by `AppDataContext`.

**Modified Files:**
- `src/shared/storage/firestore-gantt-storage-service.ts` — `onSaveResult` constructor parameter, `executeSave` calls callback on both success (`null`) and failure (sanitized message), `subscribeToProject` now passes an error callback.
- `src/shared/storage/firestore-driver.ts` — `onRemoteChange` now passes an error callback that logs via `sanitizeFirebaseError`.
- `src/context/storage-mode-switch.ts` — `switchToCloudMode` accepts and forwards `onSaveResult`.
- `src/context/StorageContext.tsx` — new `saveError`/`clearSaveError` exposed in context; stable `handleSaveResult` callback passed to both constructor sites; cleared in `performSignOutWithCleanup`.
- `src/features/settings/StorageSection.tsx` — new `saveError` prop; renders a red `<p>` "Cloud sync error: …" beneath the existing error rows.
- `src/features/settings/SettingsTab.tsx` — pulls `saveError` from `useStorage()` and forwards it.
- `src/features/projects/ShareDialog.tsx` — `autoComplete="off"` on email input.
- `src/features/chart/ChartSettings.tsx` — `autoComplete="name"` on Prepared By input.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`.

**Verification:**
- All tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.

---

## Version 17.3 (2026-05-01)
### Branded Favicon and Header Icon

New `spert-favicon-ganttapp.png` (192×192 PNG, teal `#0891b2` panels with rounded corners) replaces the legacy `favicon.ico` as the browser tab icon and now appears immediately to the left of the "GanttApp™" title in the header. A charcoal dark-mode variant (`spert-favicon-ganttapp-dark.png`) auto-swaps when the active theme is dark, driven by the existing `useTheme()` hook (`resolvedTheme === 'dark'`).

**Modified Files:**
- `public/spert-favicon-ganttapp.png` — new branded favicon (moved from repo root).
- `public/spert-favicon-ganttapp-dark.png` — new charcoal dark-mode variant (generated by replacing near-black pixels with `#2a2a2a` so the center mark stays legible against dark backgrounds).
- `pages/index.tsx` — replaced `<link rel="icon" href="/favicon.ico" />` with `<link rel="icon" type="image/png" href="/spert-favicon-ganttapp.png" />`; wrapped `<h1>` in a flex row containing the new `<img>` icon, sized 28×28 with `borderRadius: '11%'` to match the baked-in corner radius.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`, `CHANGELOG.md`, `public/CHANGELOG.md`.

**Verification:**
- All tests pass.
- TypeScript type-check clean (0 errors).
- Production build succeeds with Turbopack.
- Lint clean.

---

## Version 17.2 (2026-04-28)
### Lighter Default Trashcan Color

Lightened the default `TrashIconButton` color from theme-aware `colors.textSecondary` (`#666` in light mode, `#a0aec0` in dark) to a hardcoded soft gray `#9ca3af` across both themes. The previous shade read too dark in the project / release row next to the blue **Edit** and **View Releases** buttons; the lighter gray matches the standardized SPERT® Suite trashcan look. Hover/focus state (red `#ef4444` icon + soft red background tile) is unchanged.

**Modified Files:**
- `src/shared/components/TrashIconButton.tsx` — `iconColor` now uses a hardcoded `#9ca3af` instead of `colors.textSecondary`. Removed the now-unused `colors` destructure from `useTheme()`.
- `src/shared/components/__tests__/TrashIconButton.test.tsx` — updated default-stroke assertion from theme-derived to hardcoded `#9ca3af`.
- `src/features/changelog/__tests__/ChangelogTab.test.tsx` — version-order expectation updated.
- Version + docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`.

**Verification:**
- All tests pass
- TypeScript type-check clean (0 errors)
- Production build succeeds with Turbopack
- Lint clean

---

## Version 17.1 (2026-04-28)
### Trashcan Icon for Destructive List Actions

Replaced the text **Delete** button on the Projects and Releases tabs, the **Remove** button in the project sharing dialog, and the snapshot delete button in the SnapshotBar with a single shared icon button. The trashcan is grayscale by default and turns red — with a soft red background tile — on hover or keyboard focus. Destructive actions now have a lower visual weight, matching the standardized SPERT® Suite look.

**New shared component:**
- `src/shared/components/TrashIconButton.tsx` — borderless icon button. Inline 20px SVG trashcan (Heroicons-style outline). Default color is theme-aware (`colors.textSecondary`); hover/focus color is `#ef4444` with a soft red background tile (`#fef2f2` light, `rgba(239,68,68,0.15)` dark). Hover state uses `useState` + `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur`, matching the codebase's existing inline-style hover pattern (no new CSS). Props: `onClick`, `ariaLabel?`, `title?`, `disabled?`. Disabled state: 50% opacity, no hover transition.

**Call sites migrated (4):**
- `src/features/projects/ProjectsTab.tsx` — project Delete button (`aria-label="Delete project"`)
- `src/features/releases/ReleasesTab.tsx` — release Delete button (`aria-label="Delete release"`)
- `src/features/projects/ShareDialog.tsx` — member Remove button (`aria-label="Remove member"`)
- `src/features/chart/SnapshotBar.tsx` — Delete Snapshot button, replacing the previous emoji 🗑️ in a chip pill (`aria-label="Delete snapshot"`)

`ConfirmDialog` flows are unchanged at all four call sites — the second-tier safety net stays in place.

**Test updates:**
- New: `src/shared/components/__tests__/TrashIconButton.test.tsx` — 7 tests (renders SVG, default + custom aria-label/title, fires onClick, hover changes icon color, hover shows red background tile, disabled state)
- `src/features/projects/__tests__/ProjectsTab.test.tsx` — `getByText('Delete')` → `getByRole('button', { name: 'Delete project' })` for the row button. ConfirmDialog's "Delete" button still queried by text (now unambiguous)
- `src/features/releases/__tests__/ReleasesTab.test.tsx` — same migration with `name: 'Delete release'`
- `src/features/projects/__tests__/ShareDialog.test.tsx` — `getByText('Remove')` → `getByRole('button', { name: 'Remove member' })`
- `src/features/chart/__tests__/SnapshotBar.test.tsx` — unchanged (uses `getByTitle('Delete this snapshot')`, which the new component preserves)

**Verification:**
- All tests pass
- TypeScript type-check clean (0 errors)
- Lint clean
- Production build succeeds with Turbopack
- Manual preview confirmed: grayscale → red-on-hover with pink tile background; ConfirmDialog still gates every action; light + dark mode both render correctly

---

## Version 17.0 (2026-04-26)
### Cloud Storage Modal

Standardized SPERT&reg; Suite Cloud Storage modal triggered by the header auth chip. Replaces the prior in-chip `ConfirmDialog` popover and the Settings-tab detour for sign-in. One dialog handles all three valid auth × storage states with sign-in, mode switching, Export Attribution, and the local-storage notification toggle. Settings tab retains its full cloud-storage section as a secondary entry point.

**New shared components and hook:**
- `src/shared/components/CloudStorageModal.tsx` — three-state modal (signed-out + local, signed-in + local, signed-in + cloud). Hand-rolled shell mirroring `TosConsentModal` (position fixed, backdrop, role=dialog, Escape, backdrop click, × button). Renders a `UploadConfirmFlow`, `<ExportAttributionSection>`, and `<LocalStorageWarningToggle alwaysVisible>` inside one card
- `src/shared/components/UploadConfirmFlow.tsx` — extracts the radio-click upload-confirm + post-upload cleanup-confirm pair from `StorageSection`. Imperative `requestCloudSwitch()` handle on a forwarded ref so both `StorageSection` and `CloudStorageModal` get identical behavior
- `src/shared/components/LocalStorageWarningToggle.tsx` — extracts the Notifications checkbox + `ganttapp-suppress-local-warning` write from `SettingsTab`. Optional `alwaysVisible` prop so the modal renders it regardless of storage mode while Settings retains the local-only behavior
- `src/shared/hooks/useSignInWithTosGate.ts` — encapsulates the load-bearing localStorage flag sequencing for ToS consent (`spert_tos_accepted_version` then `spert_tos_write_pending` then `signInWithPopup`). Optional `normalizeError` callback so the modal can silence `auth/popup-closed-by-user` and customize `auth/popup-blocked`. Placed in `src/shared/hooks/` rather than `src/features/settings/` because it's consumed by both a feature and a shared component — keeps the modal from importing from a feature folder

**Display-name normalization:**
- `normalizeDisplayName(displayName)` added to `src/shared/utils/displayName.ts`. Microsoft Entra ID returns "Last, First MI"; the helper returns "First MI Last". Used by the modal's identity card. Existing `getFirstName` / `getInitial` are unchanged.

**Sign-in error normalization in the modal:**
- `auth/popup-closed-by-user` — silent (no message)
- `auth/cancelled-popup-request` — silent
- `auth/popup-blocked` — "Allow pop-ups in your browser to sign in."
- All others fall through to `sanitizeFirebaseError`

**Auth chip rewire:**
- `StorageStatusChip` prop renamed `onSettingsClick` → `onOpenModal`. All three visual variants now route to the modal — single click target. Removed: `popoverOpen`, `signingOut`, `error` state, the Escape `useEffect`, both `ConfirmDialog` popover blocks, and the chip's direct call to `performSignOutWithCleanup`. Sign-out now lives inside the modal's identity card

**Settings refactor (single source of truth):**
- `SettingsTab` consumes `useSignInWithTosGate` instead of owning the gate inline. Notifications block replaced with `<LocalStorageWarningToggle colors={colors} />` (still local-mode-only by default)
- `StorageSection` consumes the new `<UploadConfirmFlow>` via a ref. Removed: inline `showUploadConfirm` / `showCleanupConfirm` / `statusMessage` state and matching `ConfirmDialog` blocks. Re-sign-in upload prompt and cloud→local keep/discard prompt remain as-is — those are global-context flows

**Layout integration:**
- `pages/index.tsx` hoists `cloudModalOpen` state at the `AppContent` level, passes `onOpenModal` to the chip, and renders `<CloudStorageModal>` after `<LocalStorageWarningBanner>`. The modal is rendered unconditionally and bails on `open=false` to avoid mount/unmount churn

**UX polish:**
- Export Attribution placeholders updated: name field shows "e.g., Jane Smith"; identifier placeholder typo fixed ("e.g," → "e.g.,"). Both Settings and modal pick up the change automatically (single component reuse)
- Modal's "Keep using local storage" secondary button (State 2 only) closes the modal without any storage-mode mutation — gives just-signed-in users a clear "leave me on local" affordance

**Modified files:**
- Auth chip: `src/shared/components/StorageStatusChip.tsx`
- Settings: `src/features/settings/SettingsTab.tsx`, `src/features/settings/StorageSection.tsx`, `src/features/settings/ExportAttributionSection.tsx`
- Entry: `pages/index.tsx`
- Utils: `src/shared/utils/displayName.ts`
- Version and docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`

**Protected files:** `GanttChart.tsx`, `firestore-save-executor.ts`, `validation.ts`, `styles/globals.css` — zero edits.

---

## Version 16.8 (2026-04-21)
### Snapshot Freezes Project-Override Labels

Small fix. When a user customized legend labels while a project was selected, v16.1 wrote the edit to that project's `legendLabels` override instead of to global state. The live chart rendered the override correctly (via `resolveLabel` in `useEffectiveChartProps`), but the snapshot-save path in `pages/index.tsx` `handleSaveSnapshot` pulled from the raw global label state and ignored project overrides. Result: snapshots froze the global baseline instead of what was displayed on screen.

**Fix:**
- `handleSaveSnapshot` now threads `selectedProject?.legendLabels` through `resolveLabel(key, projectLabels, globalOrDefault)` for all 5 keys. This is the same precedence the live chart uses, so snapshots now freeze exactly what the user sees
- Preserves v16.2 Risk 1 behavior: if both the project override and the global raw state are empty, the hardcoded `DEFAULT_LEGEND_LABELS` value still wins
- Dependency array updated to include `selectedProject?.legendLabels`

**Modified files:**
- Entry: `pages/index.tsx` — `handleSaveSnapshot` uses `resolveLabel`
- Tests: `src/features/chart/__tests__/useSnapshots.test.tsx` — new regression test alongside the existing v16.2 Risk 1 test, exercising the exact `resolveLabel(key, projectLabels, globalRaw || DEFAULT)` computation
- Version and docs: `src/lib/version.ts`, `package.json`, `src/features/changelog/changelog-data.tsx`, `src/features/changelog/__tests__/ChangelogTab.test.tsx`

**Protected files:** `GanttChart.tsx`, `firestore-save-executor.ts`, `validation.ts`, `globals.css` — zero edits.

**Tests:** 975 pass (974 + 1). All gates green (tsc, test, lint, build). Manually verified in preview: project with `legendLabels: { solidBar: "Custom Build Phase", mostLikelyLine: "Custom Target Date" }` produces a snapshot that freezes those custom labels, and viewing the snapshot renders `Custom Build Phase` in the legend.

---

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
