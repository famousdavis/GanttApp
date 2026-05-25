# GanttApp Architecture

This document describes the technical architecture of GanttApp, a browser-based Gantt chart application for visualizing release date uncertainty.

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (Pages Router) | 16.1.6 |
| UI Library | React | 19 |
| Language | TypeScript | 5 |
| Bundler | Turbopack (default in Next.js 16) | - |
| Storage (default) | Browser localStorage | - |
| Storage (optional) | Firebase Firestore | ^12.9.0 |
| Auth (optional) | Firebase Auth (Google/Microsoft SSO) | ^12.9.0 |
| Chart Export | html2canvas | 1.4.1 |
| Testing | Vitest + React Testing Library | 4.0.18 |
| Linting | ESLint 9 (flat config) | 9.17.0 |
| Hosting | Vercel (serverless) | - |

## Directory Structure

```
GanttApp/
├── pages/
│   ├── index.tsx              # Main app entry + orchestration
│   ├── _app.tsx               # Provider hierarchy (Auth > Storage > Theme > AppData)
│   └── index-old.tsx          # Pre-refactor backup (reference only)
│
├── src/
│   ├── context/
│   │   ├── AppDataContext.tsx  # Global state provider + storage sync
│   │   ├── AuthContext.tsx     # Firebase Auth provider (v11.0)
│   │   ├── StorageContext.tsx  # Storage mode switching (v10.0/v11.0)
│   │   └── ThemeContext.tsx    # Dark mode theme provider
│   │
│   ├── features/              # Feature-based modules
│   │   ├── about/
│   │   │   └── AboutTab.tsx
│   │   ├── changelog/
│   │   │   └── ChangelogTab.tsx
│   │   ├── chart/
│   │   │   ├── GanttChart.tsx        # SVG chart component
│   │   │   ├── ChartReleaseBar.tsx   # Per-release bar rendering (v7.1)
│   │   │   ├── ChartLegend.tsx       # Legend with editable labels
│   │   │   ├── ChartSettings.tsx     # Display/color settings panel
│   │   │   ├── SnapshotBar.tsx       # Snapshot chip navigation bar
│   │   │   ├── useSnapshots.ts       # Snapshot state management hook
│   │   │   ├── useChartEditing.ts    # Inline editing state hook
│   │   │   ├── useChartCalculations.ts
│   │   │   └── useEffectiveChartProps.ts # Snapshot vs live data resolver (v7.1)
│   │   ├── projects/
│   │   │   ├── ProjectsTab.tsx
│   │   │   ├── ImportPreviewSection.tsx # Smart Import preview (v0.24.0)
│   │   │   ├── ShareDialog.tsx       # Project sharing modal (v11.0)
│   │   │   └── useProjects.ts
│   │   ├── releases/
│   │   │   ├── ReleasesTab.tsx
│   │   │   └── useReleases.ts
│   │   └── settings/
│   │       ├── SettingsTab.tsx        # Storage mode, auth, export attribution (v11.0)
│   │       └── ExportProjectsSection.tsx # Settings export-projects picker (v19.0)
│   │
│   ├── lib/
│   │   └── firebase.ts               # Conditional Firebase init (v11.0)
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── ColorPickers/
│   │   │   │   ├── ColorSwatchPicker.tsx
│   │   │   │   ├── GrayscaleSwatchPicker.tsx
│   │   │   │   ├── PresetButtonGroup.tsx
│   │   │   │   └── index.ts
│   │   │   ├── DragHandle.tsx               # 6-dot grab handle (v0.23.0)
│   │   │   ├── InlineDateEditor.tsx
│   │   │   ├── InlineTextEditor.tsx
│   │   │   ├── TrashIconButton.tsx          # Destructive list action (v17.1, 18×18 v0.23.0)
│   │   │   ├── PencilIconButton.tsx         # Edit list action (v19.0, 18×18 v0.23.0, active prop v0.25.0)
│   │   │   ├── ExportIconButton.tsx         # Per-project export (v19.0, 18×18 v0.23.0)
│   │   │   ├── CloneIconButton.tsx          # Per-project clone (v19.0, 18×18 v0.23.0)
│   │   │   ├── ShareIconButton.tsx          # Per-project share, owner+cloud only (v0.23.0)
│   │   │   └── Tabs.tsx
│   │   ├── hooks/
│   │   │   ├── useDragAndDrop.ts
│   │   │   └── useKeyboardShortcuts.ts
│   │   ├── storage/                   # Storage abstraction layer (v10.0/v11.0)
│   │   │   ├── index.ts              # Barrel exports
│   │   │   ├── snapshot-limits.ts            # Shared snapshot caps (v19.0)
│   │   │   ├── local-storage-driver.ts      # LocalStorageDriver
│   │   │   ├── local-gantt-storage-service.ts # LocalGanttStorageService
│   │   │   ├── firestore-driver.ts          # FirestoreDriver (v11.0)
│   │   │   └── firestore-gantt-storage-service.ts # Cloud service (v11.0)
│   │   ├── types/
│   │   │   ├── models.ts      # Core data models (Project, Release, etc.)
│   │   │   ├── app.ts         # App-level types (AppData, TabType)
│   │   │   ├── firestore.ts   # Firestore document types (v11.0)
│   │   │   ├── storage.ts     # StorageDriver, GanttStorageService (v10.0)
│   │   │   ├── snapshots.ts   # Snapshot type definition
│   │   │   └── index.ts       # Re-exports
│   │   └── utils/
│   │       ├── colors.ts      # Color constants, presets, defaults
│   │       ├── dates.ts       # Date parsing, formatting, ID generation
│   │       ├── export.ts      # JSON export/import + Smart Import logic (v0.24.0)
│   │       ├── firestore-converters.ts # Flat AppData ↔ Firestore translation (v11.0)
│   │       ├── snapshots.ts   # Snapshot CRUD, validation, localStorage
│   │       ├── storage.ts     # localStorage wrapper with validation
│   │       ├── theme.ts       # Theme color constants
│   │       ├── validation.ts  # Input validation + security sanitization
│   │       └── index.ts       # Re-exports
│   │
│   └── test/
│       ├── setup.ts           # Test configuration
│       ├── ThemeWrapper.tsx    # Test utility for themed components
│       └── FullWrapper.tsx    # Test utility with all providers (v10.0)
│
├── styles/
│   └── globals.css            # Global styles + date input styling
│
├── public/
│   └── favicon.ico
│
├── firestore.rules            # Firestore security rules reference (v11.0)
├── .env.local.example         # Firebase config template (v11.0)
├── eslint.config.mjs          # ESLint 9 flat config
├── vitest.config.ts           # Vitest test configuration
├── tsconfig.json              # TypeScript configuration
├── next.config.js             # Next.js configuration
└── package.json
```

## Provider Hierarchy (v11.0)

```
AuthProvider > StorageProvider > ThemeProvider > AppDataProvider
```

- **AuthProvider** (outermost): Wraps `onAuthStateChanged`. No dependencies on other providers.
- **StorageProvider**: Uses `useAuth()` for cloud mode switching and session restoration. Provides `storage`, `mode`, `switchMode()`, `isSwitching`, `switchError`.
- **ThemeProvider**: Dark mode theme, independent of storage.
- **AppDataProvider** (innermost): Uses `useStorage()` for all data load/save. Has `[storage]` in its load `useEffect` dependency array — switching the storage instance automatically triggers data reload.

## Data Flow

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              Browser                                       │
│                                                                            │
│  ┌──────────────────┐         ┌──────────────────────────┐                │
│  │   localStorage    │         │   Firebase Firestore      │               │
│  │  (default mode)   │◄───┐   │   (cloud mode, optional)  │◄──┐          │
│  └──────────────────┘    │   └──────────────────────────┘   │          │
│                           │                                   │          │
│  ┌────────────────────────┴───────────────────────────────────┴──────┐  │
│  │              Storage Abstraction Layer (v10.0)                      │  │
│  │                                                                     │  │
│  │  StorageDriver (I/O)         GanttStorageService (app logic)       │  │
│  │  ├── LocalStorageDriver      ├── LocalGanttStorageService          │  │
│  │  └── FirestoreDriver         └── FirestoreGanttStorageServiceImpl  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│         ▲                                      │                          │
│         │ save                                 │ load                     │
│         │                                      ▼                          │
│  ┌─────────────────────────────────────────────────────────┐             │
│  │              AppDataContext (Provider)                    │             │
│  │  State: data, chartColors, displaySettings,              │             │
│  │         legendLabels, toggles, preparedBy,               │             │
│  │         exportAttribution                                │             │
│  │  Cloud: real-time sync via onSnapshot (v11.0)            │             │
│  └─────────────────────────────────────────────────────────┘             │
│         │                                                                  │
│         │ useAppData() hook                                                │
│         ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────┐             │
│  │  index.tsx (Orchestration)                                │             │
│  │  - useSnapshots() → effective props (live vs snapshot)   │             │
│  │  - useChartEditing() → inline edit state                 │             │
│  └─────────────────────────────────────────────────────────┘             │
│         │                                                                  │
│         ▼                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ProjectsTab│ │ReleasesTab│ │GanttChart│ │ Settings │ │ AboutTab │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└───────────────────────────────────────────────────────────────────────────┘
```

## Core Data Models

```typescript
// Per-project legend label overrides (v16.1). Absent keys fall through to the global AppData.legendLabels.
interface ProjectLegendLabels {
  solidBar?: string;
  hatchedBar?: string;
  finishDateLine?: string;
  mostLikelyLine?: string;
  inProgress?: string;
}

// Project - a container for releases
interface Project {
  id: string;           // Unique ID (timestamp-based)
  name: string;         // Display name (max 100 chars)
  finishDate?: string;  // Optional YYYY-MM-DD
  workDays?: number[];  // Optional per-project work-week override (v15.0). Array of 0=Sun..6=Sat. Undefined = use global default.
  legendLabels?: ProjectLegendLabels;  // v16.1 — per-project overrides. Precedence: snapshot → project override → global. Resolved via resolveLabel() in validation.ts.
}

// Release status (v16.0 — replaces v9.0 completed boolean)
type ReleaseStatus = 'not-started' | 'in-progress' | 'complete';

// Release - a time-boxed work item
interface Release {
  id: string;
  projectId: string;           // Foreign key to Project
  name: string;
  startDate: string;           // YYYY-MM-DD
  earlyFinishDate: string;     // YYYY-MM-DD (optimistic)
  lateFinishDate: string;      // YYYY-MM-DD (pessimistic)
  hidden?: boolean;            // Hide from chart
  status?: ReleaseStatus;      // v16.0 — undefined treated as 'not-started' at render. In-progress uses split-bar in inProgressBar color; complete renders as single solid bar in completedBar color. Legacy completed:true auto-migrates to status:'complete' at read time via migrateReleaseStatus() in validation.ts
  mostLikelyFinishDate?: string; // Optional YYYY-MM-DD, >= early and <= late (v8.0)
}

// Snapshot - frozen historical release plan record (v7.0)
interface Snapshot {
  id: string;                  // Unique ID
  projectId: string;           // Which project this belongs to
  timestamp: string;           // ISO 8601 — frozen as Date Prepared
  name: string;                // User label or auto-generated date
  releases: Release[];         // Deep copy of releases at snapshot time
  projectFinishDate?: string;
  chartColors?: ChartColors;
  legendLabels?: { solidBar?: string; hatchedBar?: string; finishDateLine?: string; mostLikelyLine?: string; inProgress?: string };  // v16.2: all fields optional
  preparedBy?: string;
}

// Chart color customization
interface ChartColors {
  solidBar: string;       // Hex color for solid bar
  hatchedBar: string;     // Hex color for hatched bar
  todayLine: string;      // Hex color for today line
  finishDateLine: string; // Hex color for finish date line
  mostLikelyLine: string; // Hex color for most likely line (v8.0)
  completedBar: string;   // Hex color for completed release bar (v9.0)
  inProgressBar: string;  // Hex color for in-progress release bar (v16.0)
}

// Display settings
interface ChartDisplaySettings {
  releaseNameFontSize: '14' | '16' | '18';
  dateLabelFontSize: '11' | '13' | '15';
  dateLabelColor: '#999' | '#666' | '#333' | '#000';
  verticalLineWidth: '2' | '3' | '4';
  barHeight: '30' | '40' | '50';
  rowSpacing: '20' | '25' | '30';
}

// Export attribution (v11.0)
interface ExportAttribution {
  name: string;
  identifier: string;
}

// Top-level app data structure
interface AppData {
  projects: Project[];
  releases: Release[];
  chartColors?: ChartColors;
  activePreset?: string;
  legendLabels?: {
    solidBar?: string;            // v16.2: optional (empty/absent = use DEFAULT_LEGEND_LABELS.solidBar)
    hatchedBar?: string;          // v16.2: optional (same)
    finishDateLine?: string;
    mostLikelyLine?: string;      // v8.0
    inProgress?: string;          // v16.0
  };
  // v16.2: DEFAULT_LEGEND_LABELS constant in validation.ts is the single source of truth
  // for the 5 hardcoded defaults. Used as HTML placeholder in Settings inputs AND as the
  // `||` fallback at every consumption point (useEffectiveChartProps, useChartEditing,
  // handleSaveSnapshot). First-time users have no legendLabels entries in storage at all —
  // the field is stripped by AppDataContext when the payload is empty.
  showTodayLine?: boolean;        // v8.0 (persisted, was transient)
  showFinishDateLine?: boolean;
  showMostLikelyLine?: boolean;   // v8.0
  chartDisplaySettings?: ChartDisplaySettings;
  preparedBy?: string;
  showPreparedBy?: boolean;
  exportAttribution?: ExportAttribution; // v11.0
  globalWorkDays?: number[];  // Optional global work-week setting (v15.0). Same encoding as Project.workDays. Undefined = feature not configured.
}
```

## Storage Architecture (v10.0/v11.0)

### Two-Layer Abstraction

```
┌──────────────────────────────────────────────────────────────┐
│  GanttStorageService (app logic)                              │
│  loadAppData, saveAppData, loadSnapshots, saveSnapshots,     │
│  addSnapshot, deleteSnapshot, deleteSnapshotsForProject      │
├──────────────────────────────────────────────────────────────┤
│  StorageDriver (raw I/O)                                      │
│  load<T>, save<T>, remove, onRemoteChange                    │
└──────────────────────────────────────────────────────────────┘
```

- **StorageDriver**: Thin I/O wrapper. `LocalStorageDriver` wraps `window.localStorage`. `FirestoreDriver` wraps Firestore SDK.
- **GanttStorageService**: App-level operations. Translates between flat `AppData` and storage backend. `LocalGanttStorageService` uses validation/sanitization. `FirestoreGanttStorageServiceImpl` adds debouncing, diff-based writes, real-time subscriptions.

### CloudGanttStorageService (v11.0)

Extends `GanttStorageService` with cloud-specific methods:

```typescript
interface CloudGanttStorageService extends GanttStorageService {
  subscribeToProject(projectId, callback): () => void;
  shareProject(projectId, targetEmail, role): Promise<void>;
  removeProjectMember(projectId, targetUid): Promise<void>;
  getProjectMembers(projectId): Promise<{ uid, role, email? }[]>;
  createUserProfile(displayName, email): Promise<void>;
  flushPendingWrites(): Promise<void>;
  dispose(): void;
}
```

Key behaviors:
- **Write debouncing**: 500ms `setTimeout` with coalescing; structural mutations bypass debounce
- **Diff-based saves**: In-memory `lastSavedState` cache — only writes changed data via batch writes
- **beforeunload handler**: Flushes pending writes on tab close. Removed on `dispose()`.
- **Real-time sync**: `subscribeToProject()` returns `onSnapshot` unsubscribe function. Echo prevention via `snapshot.metadata.hasPendingWrites`.

### localStorage Keys

| Key | Content | Purpose |
|-----|---------|---------|
| `ganttAppData` | AppData (live) | Current projects, releases, settings |
| `ganttAppSnapshots` | Snapshot[] | All historical snapshots across projects |
| `gantt-theme` | Theme preference | Light/dark/system |
| `ganttapp-storage-mode` | `"local"` or `"cloud"` | Storage mode preference (v11.0) |

### Firestore Structure (Cloud Mode)

```
ganttapp_projects/{projectId}/   ← one document per project (name, owner, members, finishDate, workDays, _originRef, _changeLog)
  releases/{releaseId}           ← one doc per release with explicit `order` field
  snapshots/{snapshotId}         ← embedded releases array (same shape as local)
ganttapp_profiles/{uid}          ← displayName, email, createdAt, lastLogin
ganttapp_settings/{uid}          ← chartColors, displaySettings, toggles, legendLabels, preparedBy, globalWorkDays
```

Top-level collections use underscore-separated names (`ganttapp_projects`, not `ganttapp/projects`) because Firestore's `doc()` requires an even number of path segments.

### Firestore Security Rules

Defined in `firestore.rules` (repo root). Key rules:
- Projects: `allow list` for all authenticated users (client-side membership filtering); `allow get/update/delete` gated on `members` map
- Subcollections (releases, snapshots): derived from parent project's `members` via `get()`
- User profile (`ganttapp_profiles`): readable by any authenticated user, writable only by owner
- User settings (`ganttapp_settings`): readable and writable only by owner

### Key Firestore Patterns

- **2-phase batch commit:** Parent project documents must be committed before subcollection documents because security rules use `get()` on the parent. See `StorageContext.switchMode()` (3 phases) and `executeSave()` (2 phases).
- **Conditional spread for optional fields:** Firestore rejects explicit `undefined` — use `...(value && { field: value })` in converters.
- **Memory cache:** Uses `memoryLocalCache()` (not persistent) to avoid stale security rule cache in IndexedDB.

### Sign-Out Cleanup Sequence (v16.6, extended v0.27.0)

`StorageContext.performSignOutWithCleanup` runs these steps synchronously (1–7) before the one async step (8). All steps are individually idempotent so the externally-revoked path (`onAuthStateChanged(null) → runSignOutCleanup` — v0.27.0) and a concurrent user-initiated sign-out can both invoke this safely.

1. `cancelPendingSaves` on the cloud service (discard, don't flush) — cloud mode only.
2. `runAppDataReset()` — clears in-memory AppData state; sets `isResettingRef` to suppress the save effect.
3. `dispose()` on the cloud service — cloud mode only. `dispose()` has an `if (this.disposed) return` guard so double-dispose is a no-op.
4. **(v0.27.0, F1/F3/E2-gap)** `clearLocalProjectData()` — cloud mode ONLY. Removes `ganttAppData` and `ganttAppSnapshots` from `localStorage`. Closes the cross-user data leak where `switchToCloudMode` would otherwise read stale localStorage on the next user's sign-in and upload the previous user's data into the new user's Firestore account. **Must NOT be called in local mode** — destroys the user's only data copy.
5. Reset `STORAGE_MODE_KEY` to `'local'`.
6. `setStorage(new LocalGanttStorageService())` — triggers the `[storage]` load effect in `AppDataContext`.
7. Clear stale transition state (isSwitching, switchError, saveError, uploadResult, needsUploadPrompt); remove the v16.5 dead localStorage key.
8. `firebaseSignOut(auth)` — the only async step.

### Real-Time Subscription Sentinel (v0.27.0, I1)

`AppDataContext` carries a `useRef<Set<string>>` named `seenFirstSnapshotRef` at provider scope. The data-loss guard in the `subscribeToProject` callback (which blocks an empty-releases snapshot from wiping a non-empty in-memory release list) now fires **only on the first snapshot per project per cloud session**. Without this, the guard would block every empty snapshot, indefinitely preventing legitimate collaborator deletions from propagating.

Three correctness requirements (all required):
- Sentinel must be at provider scope, not inside the subscription effect closure — a per-effect sentinel would reset on every projectIds change and miss the second-snapshot case.
- Sentinel mutation must happen **before** `setData` — React StrictMode invokes updaters twice; the mutation outside the updater keeps the updater pure regardless of double-invocation.
- A separate effect keyed on `[storage]` clears the sentinel on every new cloud session (storage swap).

### `ganttapp:project-revoked` Event (v0.27.0, I2)

App-scoped `CustomEvent` dispatched **only** by `FirestoreGanttStorageServiceImpl` when an `onSnapshot` listener fires with `code === 'permission-denied'` (the project owner removed this user). The driver:

1. Prunes the revoked project from `lastSavedState` and `pendingData` **before** dispatching — otherwise the next `executeFirestoreSave` diff treats the project as "removed" and re-attempts subcollection writes, hitting permission-denied again, looping forever.
2. Dispatches `new CustomEvent('ganttapp:project-revoked', { detail: { projectId } })`.

Handlers:
- `AppDataContext` listens (gated on `storage.mode === 'cloud'`) and removes the project and its releases from in-memory state.
- `useSnapshots` listens (ungated — driver is sole dispatcher; ungated keeps the hook free of `useStorage` dependency cascade) and removes snapshots for the project.

Known limitation: an in-flight `executeSave` that already started writing to the revoked project's subcollections will produce one permission-denied toast before the pruned state takes effect.

### Save-Side and Real-Time UID Guards (v0.27.0, I1a)

The driver imports `auth` from `src/lib/firebase` and checks `auth?.currentUser?.uid !== this.uid` at four points:
- `subscribeToProject` success callback (discard stale data after user switch)
- After each async boundary in `loadAppData` (returns `null`)
- After each async boundary in `loadSnapshots` (returns `[]`)
- At the top of `executeSave` and in the catch-block re-queue branch (prevents an infinite save-fail loop when a pending save would otherwise fire under the new user's auth token)

### `useBufferedField` Hook (v0.27.0, A3)

Shared hook in `src/shared/hooks/useBufferedField.ts` for controlled text inputs that write to cloud storage. Commits on **blur, Enter, or unmount** (if focused AND draft differs from stored value). Escape reverts and clears focus. Refs (kept current via a render-effect, not direct assignment during render — `react-hooks/refs`) hold the latest values for the unmount-cleanup, which has empty deps to avoid re-registering on every render.

In use at:
- `ChartSettings.tsx` — Prepared By
- `DefaultLegendLabelsSection.tsx` — 5 default legend labels (via a `BufferedLabelInput` sub-component)
- `ExportAttributionSection.tsx` — Name + Identifier

Explicitly NOT used at: inline chart label editors (`ChartLegend.tsx`, `useChartEditing.ts`, `InlineTextEditor.tsx`) — these are per-project and shared with collaborators; they need different conflict-resolution semantics (deferred to a future pass).

## Snapshot Architecture (v7.0)

Snapshots provide read-only historical records of release plans, stored separately from live data.

### Effective Props Pattern

`useEffectiveChartProps` computes "effective" props depending on whether a snapshot is active:

```
effectiveReleases   = activeSnapshot?.releases          ?? visibleReleases
effectiveColors     = activeSnapshot?.chartColors        ?? chartColors
effectiveLabels     = activeSnapshot?.legendLabels       ?? currentLabels (incl. mostLikelyLine)
effectivePreparedBy = activeSnapshot?.preparedBy         ?? preparedBy
effectiveFinishDate = activeSnapshot?.projectFinishDate  ?? project.finishDate
datePreparedOverride = activeSnapshot ? formatTimestamp(snapshot.timestamp) : undefined
readOnly             = isViewingSnapshot
```

GanttChart receives the same props regardless of data source. It does not know whether data comes from live state or a snapshot.

### Read-Only Mode

When `readOnly=true`:
- All inline editing disabled (release names, dates, legend labels)
- Cursor changes from pointer to default on editable elements
- Read-only banner displayed below the chart (not above, to prevent layout shift)
- Chart Settings remain functional (display settings are view preferences, not data)

### Snapshot Lifecycle

```
Save: Current view → window.prompt() → structuredClone(releases) → addSnapshot() → storage
View: Click chip → setActiveSnapshotId → effective props swap → chart re-renders
Delete: Click trash → window.confirm() → deleteSnapshot() → reset to Current
Cascade: Delete project → deleteSnapshotsForProject() → all project snapshots removed
Export: loadSnapshots() → included in JSON alongside AppData
Import: parseImportedData() → validateSnapshot() each → saveSnapshots()
```

### Smart Import Flow (v0.24.0)

```
File picked → readFileAsText → parseImportedData → detectImportConflicts
                                                          │
                ┌─────────────────────────────────────────┼──────────────────────────┐
                │                                         │                          │
       Fast Path 1                              Fast Path 2                Show preview
  (project-export, 0 conflicts)         (replace-all shape, empty WS)      (all other cases)
                │                          AND !appDataLoading                       │
                │                                         │                          │
                ▼                                         ▼                          │
         applyMergeDecisions(_,_,[])            applyReplaceAll(imported)            │
                │                                         │                          │
                │                                         │                          ▼
                │                                         │              ImportPreviewSection
                │                                         │              (between toolbar + list)
                │                                         │                          │
                │                                         │              User edits decisions, clicks
                │                                         │              Confirm Merge / Replace All Data
                │                                         │                          │
                │                                         │                          ▼
                │                                         │              handleConfirmMerge —
                │                                         │              pre-async early-exit guard
                │                                         │              (detectImportConflicts +
                │                                         │              conflictsEqual vs preview)
                │                                         │                          │
                │                                         │              ┌───────────┴───────────┐
                │                                         │              │                       │
                │                                         │              │                Replace All Data
                │                                         │              │              → ConfirmDialog modal
                │                                         │              │              → confirm captures
                │                                         │              │                imported, sets
                │                                         │              │                replaceAllPending=false,
                │                                         │              │                applyReplaceAll
                │                                         │              ▼                       │
                │                                         │      applyMergeDecisions             │
                │                                         │      → setApplying(true)             │
                │                                         │      → loadSnapshots                 │
                │                                         │      → POST-AWAIT GUARD              │
                │                                         │        (authoritative; catches       │
                │                                         │         onSnapshot mid-await)        │
                │                                         │      → applyImportDecisions          │
                │                                         │        (3-pass slot-preserving)      │
                │                                         │      → updateData                    │
                │                                         │      → onReplaceSnapshots            │
                │                                         │      → replacedIdMap → rebind sel    │
                │                                         │      → showBanner(success)           │
                │                                         │                                      │
                ▼                                         ▼                                      ▼
                            showBanner({ kind: 'success' | 'error' })
                            (role="status" / role="alert", explicit dismiss, no auto-fade)
```

State machine has three permitted transitions: `showPreview`, `showBanner`, `clearImportFlow`. Banner dismiss uses the raw setter directly (not a flow transition). `importPreview` and `importBanner` are mutually exclusive. During apply: Confirm, Replace-All, Cancel, mode selector, toolbar Import label + input are all disabled.

`applyImportDecisions(existing, incoming, existingSnapshots, decisions, idGenerator?)` is the v0.24.0 replacement for `mergeImportedProjects`. Self-contained: recomputes conflicts internally. Slot-preserves on `'replace'` (avoids cloud reorder rewrites). `'copy'` regenerates project + release IDs and top-level snapshot IDs but leaves embedded `snapshot.releases[]` untouched (frozen historical record). Missing decisions key → `'skip'` (safe-by-default).

## Security Architecture

### Input Validation Pipeline

```
User Input / Import File
         │
         ▼
┌─────────────────────┐
│   Type Validation   │  typeof checks, Array.isArray()
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  Format Validation  │  Regex patterns, date ranges
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│    Sanitization     │  Control char removal, length limits
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Whitelist Validation│  Preset names, settings values
└─────────────────────┘
         │
         ▼
    Validated Data
```

### Security Functions (validation.ts)

| Function | Purpose |
|----------|---------|
| `sanitizeString(str, maxLen)` | Remove control chars, trim, limit length |
| `sanitizeId(id)` | Restrict to alphanumeric + hyphens (SVG-safe) |
| `isValidHexColor(color)` | Validate hex color format |
| `sanitizeColor(color, default)` | Return valid color or default |
| `isValidDateFormat(date)` | Validate YYYY-MM-DD in 2000-2050 range |
| `validateReleaseDateChange(release, dateType, newDate)` | Shared date cross-validation (v8.0) |
| `getMostLikelyDateError(early, late, ml)` | Most Likely date form validation (v8.0) |
| `sanitizeRelease(rel)` | Full release sanitization incl. ML date (v7.1) |
| `sanitizeChartColors(colors)` | Chart colors sanitization with defaults incl. completedBar (v7.1/v9.0) |
| `sanitizeLegendLabels(labels)` | Legend labels sanitization (v7.1) |
| `sanitizeExportAttribution(attr)` | Export attribution sanitization (v11.0) |

### Import Limits (export.ts)

| Limit | Value | Purpose |
|-------|-------|---------|
| MAX_FILE_SIZE | 2MB | Prevent DoS via large files |
| MAX_PROJECTS | 50 | Prevent array exhaustion |
| MAX_RELEASES | 500 | Prevent array exhaustion |
| MAX_SNAPSHOTS | 100 | Prevent snapshot accumulation |

### Snapshot Storage Limits (snapshots.ts)

| Limit | Value | Purpose |
|-------|-------|---------|
| MAX_SNAPSHOTS_TOTAL | 100 | Cap total snapshots across all projects |
| MAX_SNAPSHOTS_PER_PROJECT | 50 | Prevent per-project bloat |

## Component Architecture

### Tab Structure

```
index.tsx (AppContent)
├── Tabs (navigation: Projects | Releases | Gantt Chart | Settings | About)
├── ProjectsTab
│   ├── useProjects (CRUD hook + cascade snapshot delete)
│   ├── ImportPreviewSection (Smart Import inline preview, v0.24.0)
│   └── ShareDialog (cloud mode only, v11.0)
├── ReleasesTab
│   └── useReleases (CRUD hook)
├── GanttChart
│   ├── SnapshotBar (chip navigation)
│   ├── SVG chart (gridlines, labels)
│   │   └── ChartReleaseBar (per-release: bars, ML line, date labels, inline editors)
│   ├── ChartLegend (editable labels incl. Most Likely)
│   ├── Read-only banner (snapshot view)
│   └── ChartSettings (display/color/toggle options)
├── SettingsTab (v11.0)
│   ├── Storage mode selector (Local/Cloud radio)
│   ├── Account section (sign-in/sign-out)
│   └── Export attribution fields
├── AboutTab
└── ChangelogTab (via footer version link)
```

### State Management Pattern

1. **Global State**: `AppDataContext` provides data and updaters
2. **Auth State**: `AuthContext` provides user, sign-in/out methods (v11.0)
3. **Storage State**: `StorageContext` provides storage service, mode, switchMode (v10.0/v11.0)
4. **Feature Hooks**: `useProjects`, `useReleases`, `useSnapshots` encapsulate CRUD logic
5. **Editing Hook**: `useChartEditing` manages inline edit state for names, dates, labels
6. **Effective Props**: `useEffectiveChartProps` resolves snapshot vs live data for chart rendering
7. **Local State**: Component-specific UI state (form fields, toggles)
8. **Persistence**: Automatic save via `GanttStorageService` on every `updateData()` call
9. **Snapshot Storage**: Managed by `useSnapshots` hook through `GanttStorageService`
10. **Real-time Sync**: Cloud mode subscribes to Firestore changes via `onSnapshot` (v11.0)

## Chart Rendering

The GanttChart component renders an SVG with:

1. **Quarterly gridlines** - Dashed vertical lines at Q2, Q3, Q4 boundaries
2. **Year labels** - Year numbers at top of chart (quarter labels suppressed when too close)
3. **Release bars** - Rendered by ChartReleaseBar for each visible release:
   - **Normal releases:**
     - Solid bar: startDate → earlyFinishDate
     - Hatched bar: earlyFinishDate → lateFinishDate (SVG pattern fill)
     - Most Likely line: optional vertical line within hatched bar (v8.0)
     - Date labels below bars (with collision detection, 40px minimum spacing)
   - **Completed releases (v9.0):**
     - Single solid bar: startDate → lateFinishDate (no hatching — no uncertainty)
     - Color: `chartColors.completedBar` (customizable, default `#90ee90`)
     - Early Finish date label hidden
     - Most Likely line and label hidden
     - Only Start Date and Late Finish Date labels shown
4. **Vertical lines** - Today's date, project finish date (configurable)
5. **Legend** - Editable labels for bar types and Most Likely line (disabled in read-only mode)

### SVG Pattern for Hatching

```jsx
<defs>
  <pattern id={`hatch-${release.id}`} patternUnits="userSpaceOnUse"
           width="8" height="8" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="8" stroke={color} strokeWidth="4" />
  </pattern>
</defs>
<rect fill={`url(#hatch-${release.id})`} ... />
```

## Testing Strategy

- **Unit Tests**: Utility functions (validation, dates, colors, export, snapshots, firestore converters)
- **Hook Tests**: Custom hooks with renderHook (useProjects, useReleases, useChartEditing, useSnapshots)
- **Component Tests**: UI components with React Testing Library
- **Storage Tests**: StorageDriver and GanttStorageService implementations (mocked Firestore)
- **Context Tests**: AuthContext, StorageContext, AppDataContext providers
- **808 total tests** across 49 test files

## Build & Deployment

```bash
npm run dev      # Development with Turbopack (hot reload)
npm run build    # Production build
npm run lint     # ESLint 9 flat config
npm test         # Vitest test runner
```

**Deployment**: Push to `main` branch triggers Vercel auto-deploy.

## Key Design Decisions

1. **localStorage default, cloud optional** - User owns their data by default; cloud is opt-in for sharing and multi-device access (v11.0)
2. **Two-layer storage abstraction** - Driver (raw I/O) + Service (app logic) allows different backends to share sanitization/validation code (v10.0)
3. **Pages Router over App Router** - Simpler, well-tested, no RSC overhead
4. **Inline SVG over chart library** - Full control, smaller bundle
5. **Feature modules** - Scales well, reduces cognitive load
6. **Defense-in-depth** - Validate on input, sanitize on load, whitelist settings
7. **Separate snapshot storage** - Isolates historical data from live data, prevents corruption risk
8. **Effective props pattern** - Chart component is data-source agnostic (live vs snapshot)
9. **Provider hierarchy** - AuthProvider outermost (no deps), StorageProvider uses auth, AppDataProvider uses storage — switching storage instance auto-reloads data (v11.0)
10. **Write-echo prevention** - Uses Firestore's `hasPendingWrites` flag for deterministic echo prevention, not time-based (v11.0)
