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

**Consequence:** Maintenance risk, in one direction only. **Mirror behaviour;
never mirror format.** The deviation this entry records is `owner` binding, and
mirroring is exactly right for that — and for any other shared-semantics change,
such as a new `Project` field both paths should copy or a new sanitisation step.
It is destructive only for the **name suffix format**, which is deliberately
different on the two paths and is pinned by tests on both sides. Changing either
format to match the other breaks whichever side you change.

**Format pins** — counts as of v0.28.20. ⚠️ Each carries its unit: lines and
occurrences are different rules and they do not always agree.

| pin | value |
|---|---|
| `'Source - Copy (1)'` in `useProjects.test.tsx` | **8** — lines and occurrences agree |
| `'Alpha (2)'` in `export.test.ts` | **1** — lines and occurrences agree |
| `- Copy (` in `useProjects.test.tsx` | ⚠️ **21 lines / 24 occurrences** |
| `- Copy (` in `useProjects.ts` | ⚠️ **4 lines / 5 occurrences** |
| `- Copy (` elsewhere in `src/` | `ProjectsTab.test.tsx` 1 · `useProjects.writeFailures.test.tsx` 1 · `changelog-data.tsx` 1 — lines and occurrences agree at each |

⚠️ **These figures moved in v0.28.20 and the v0.28.19 set is superseded** —
that release added the clone-length tests and the `buildCloneCandidateName`
doc comment. `useProjects.ts` **gained a rule disagreement it did not have**
(4/4 → 4 lines / 5 occurrences). That is the reason the unit is stated rather
than assumed: a count published without one silently becomes wrong when the
rules diverge, and nothing in the gate can see it.

**Full closure (future):** Extract a shared `cloneProjectContent(source, opts)`
helper carrying the shared behaviour, while leaving each caller its own suffix
format.

⚠️ **v0.28.20 is a worked example of the rule.** `cloneProject` adopted the
truncate-before-the-collision-check *behaviour* that `applyImportDecisions`
already had, and deliberately did **not** adopt its *reserve strategy*:
`export.ts` reserves a constant `MAX_SUFFIX_LEN = 5` sized for its worst case,
while `cloneProject` reserves the chosen suffix's own length so the common
`(1)` case loses no character. Behaviour mirrored, format not.

**Status:** Accepted as a deliberate split — not scheduled, and no target
version. The `owner` semantics that require the divergence are correct on both
paths, and the two suffix formats are intentionally different and separately
pinned. This entry is retained to record the deviation and to say which parts of
it may be mirrored, not to track outstanding work. It would reopen only if the
two paths were required to share a suffix format.

---

## SD-7 — `aria-busy` observability gap in `applyReplaceAll` path (pitfall #86)

`applyReplaceAll` calls `setApplying(true)` then immediately calls synchronous
`updateData()`, with no `await` before it. React batches both into the same
commit — `aria-busy` may never be painted or announced before the work
completes on the Replace-All path.

`applyMergeDecisions` has `await storage.loadSnapshots()` before the synchronous
work, providing a yield point; `aria-busy` is observable on that path.

**Consequence:** ⚠️ **None that can be observed.** This entry originally
promised that screen readers may miss an in-progress state announcement on
Replace-All. Measured against the DOM: `aria-busy` **is** committed on the
preview-confirm path, and applying the closure below produces a **byte-identical**
mutation sequence under an instrument proven sensitive at that line. There is no
in-progress announcement for a reader to miss — the string this entry promised
exists nowhere in `src/`, and the only live region in the import flow announces
the **result**, after the work has finished. The in-progress signal is `aria-busy`
itself, which is present and bound to the applying state.

⚠️ **How this entry came to describe nothing, in good faith:** it reasoned
forward from an intended design rather than backward from the DOM. The design it
described was coherent and the gap it predicted followed from it; the design was
simply never built. **That method is the defect**, and naming it is the reason to
keep this entry rather than delete it.

**Full closure:** `flushSync(() => setApplying(true))` from `react-dom` before
`updateData()` in `applyReplaceAll`. A description of what full compliance would
require — not a commitment that it is scheduled.

**Status:** Accepted as unobservable — not scheduled, and no target version.
There is no user-visible defect to close: the announcement whose absence this
entry predicted was never implemented, so the batching it describes has nothing
to suppress. This entry is retained to record the deviation and the reasoning
error that produced it, not to track outstanding work. It would reopen if an
in-progress announcement were added to the import flow, at which point the
batching would become observable.
