# GanttApp — Smart Import Spec Deviations

Documents deliberate architectural departures from the Level 4 import spec
defined in `~/Documents/SPERT Documentation/robust-import-guide/`. Each entry
explains the pattern not implemented, the behavioral consequence, and the partial
mitigation in place (if any).

**Not every entry names a target version.** Some deviations are accepted rather than
scheduled; those carry a `**Status:**` line saying so. A `**Full closure (vX):**` line is a
description of what full compliance would require — it is **not** a commitment that it landed
in that version. Where a named version has shipped without the work, the line is corrected to
say so rather than left to read as a delivered promise.

---

## SD-1 — React Context closure boundary (pitfall #57)

`applyMergeDecisions` reads `data` from the React Context render closure. In
cloud mode, a peer's `onSnapshot` can fire and mutate the workspace between
preview-open and Confirm. `conflictsEqual` detects concurrent DELETES (the
re-check inside `applyMergeDecisions` after `await loadSnapshots()` runs against
the closure's stale `data` but compares against the originally-captured
conflicts, so a deleted target shows up as a diff). It does NOT detect
concurrent ADDS — a peer adding a same-named project does not change the
conflict set the user is acting on.

Closure staleness also applies within a single user session if a new file is
picked while an apply is in flight — the new file's conflict detection uses the
pre-apply data closure rather than the just-merged state.

**Consequence:** In cloud mode, a peer adding a same-named project between
preview-open and Confirm may produce a duplicate name without triggering
drift-abort.

**Mitigation:** Delete window is closed. Add window is bounded to milliseconds
in practice.

**Full closure (not yet scheduled):** Re-read from storage at apply time inside
`applyMergeDecisions` instead of relying on the render closure.

**Status:** Open. A previous revision of this entry named v0.27.0 as the target; v0.27.0
shipped without it and the repo is now past it. `applyMergeDecisions` still reads `data`
from the render closure. The date has been removed rather than moved — this deviation is
open, not scheduled.

---

## SD-2 — `selectedProjectId` remap not atomic with `updateData` (pitfall #42 analog)

When `applyMergeDecisions` finishes, two React state updates happen in sequence:
`updateData(mergedData)` then `setSelectedProjectId(newId)` (if a name-conflict
replace remapped the active project). React 18 auto-batching produces one
render; no subscriber observes the intermediate state.

**Consequence:** Theoretical for the current architecture.

**Full closure:** Zustand migration; atomic store action that updates both.

**Status:** Accepted as theoretical — not scheduled, and no target version. React's
auto-batching means no subscriber can observe the intermediate state, so there is no
user-visible defect to close. This entry is retained to record the deviation, not to
track outstanding work. It would reopen only if the two updates stopped being batched.

---

## SD-3 — Import-copy `' (2)'` suffix was non-collision-safe (pitfall #84)

**Status:** Resolved in v0.26.0 — Phase 7c. Collision-safe `(2)`, `(3)`, …
iteration via `usedNames: Set<string>` reservation.

---

## SD-4 — REMOVED

~~Default 'replace' for ID-same-name conflicts.~~

This deviation was considered during v0.24.0 design ("round-trip backup"
rationale) but **reverted in v0.26.0**. All ID conflicts now default to
`'skip'` per pitfall #22. Matching names is not evidence the import is newer
than the workspace; a user who exported a backup, did more work, then
accidentally imported the older file would silently lose the newer work if
`'replace'` were the default.

---

## SD-5 — Layer 2 uses coarse-grain abort, not per-decision graceful fallback (pitfall #77)

`conflictsEqual` aborts the entire import if any conflict tuple changes between
preview-open and Confirm. The spec's graceful approach is per-decision
re-validation: for a name-conflict 'replace', re-check at apply time whether the
same project still holds the conflicting name; if a different project does, fall
back to 'add' rather than clobbering the unrelated project.

**Consequence:** Workspace change between preview and Confirm produces a full
abort (error banner + retry) rather than graceful per-decision fallback.
Data-safe — no wrong project is clobbered, only a UX regression.

**Full closure (not yet scheduled):** Per-decision re-validation in `applyMergeDecisions`.

**Status:** Open. As with SD-1, a previous revision named v0.27.0; that version shipped
without the work. Coarse-grain abort is still what runs.

---

## SD-6 — Import-copy path does not use `cloneProject` utility (pitfall #83)

`cloneProject` in `useProjects.ts` rebinds `owner` to the current user — correct
for the explicit clone action (the cloning user becomes the owner). Import-copy
must NOT bind an owner, because exported files strip the UID and an imported
copy should land owner-less until the next cloud upload. Using `cloneProject`
would silently inject the wrong UID.

A shared `cloneProjectContent(source, opts)` helper with an `owner?: string`
option would close the gap, but the refactor is non-trivial and out of scope
for the retrograde.

**Consequence:** Maintenance risk — clone-logic changes in `cloneProject` may
need to be mirrored manually in `applyImportDecisions`.

**Full closure (future):** Extract shared helper.

---

## SD-7 — `aria-busy` observability gap in `applyReplaceAll` path (pitfall #86)

`applyReplaceAll` calls `setApplying(true)` then immediately calls synchronous
`updateData()`, with no `await` before it. React batches both into the same
commit — `aria-busy` may never be painted or announced before the work
completes on the Replace-All path.

`applyMergeDecisions` has `await storage.loadSnapshots()` before the synchronous
work, providing a yield point; `aria-busy` is observable on that path.

**Consequence:** Screen readers may miss the "Applying…" state announcement on
Replace-All.

**Full closure:** `flushSync(() => setApplying(true))` from `react-dom` before
`updateData()` in `applyReplaceAll`. Deferred — not in current retrograde scope.
