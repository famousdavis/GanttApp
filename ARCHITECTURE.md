# GanttApp Architecture

This document describes the technical architecture of GanttApp, a browser-based Gantt chart application for visualizing release date uncertainty.

## Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (Pages Router) | 16.1.6 |
| UI Library | React | 19 |
| Language | TypeScript | 5 |
| Bundler | Turbopack (default in Next.js 16) | - |
| Storage | Browser localStorage | - |
| Chart Export | html2canvas | 1.4.1 |
| Testing | Vitest + React Testing Library | 4.0.18 |
| Linting | ESLint 9 (flat config) | 9.17.0 |
| Hosting | Vercel (serverless) | - |

## Directory Structure

```
GanttApp/
├── pages/
│   ├── index.tsx              # Main app entry + orchestration
│   ├── _app.tsx               # Next.js app wrapper
│   └── index-old.tsx          # Pre-refactor backup (reference only)
│
├── src/
│   ├── context/
│   │   ├── AppDataContext.tsx  # Global state provider + localStorage sync
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
│   │   │   └── useProjects.ts
│   │   └── releases/
│   │       ├── ReleasesTab.tsx
│   │       └── useReleases.ts
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── ColorPickers/
│   │   │   │   ├── ColorSwatchPicker.tsx
│   │   │   │   ├── GrayscaleSwatchPicker.tsx
│   │   │   │   ├── PresetButtonGroup.tsx
│   │   │   │   └── index.ts
│   │   │   ├── DragHandle.tsx
│   │   │   ├── InlineDateEditor.tsx
│   │   │   ├── InlineTextEditor.tsx
│   │   │   └── Tabs.tsx
│   │   ├── hooks/
│   │   │   ├── useDragAndDrop.ts
│   │   │   └── useKeyboardShortcuts.ts
│   │   ├── types/
│   │   │   ├── models.ts      # Core data models (Project, Release, etc.)
│   │   │   ├── app.ts         # App-level types (AppData, TabType)
│   │   │   ├── snapshots.ts   # Snapshot type definition
│   │   │   └── index.ts       # Re-exports
│   │   └── utils/
│   │       ├── colors.ts      # Color constants, presets, defaults
│   │       ├── dates.ts       # Date parsing, formatting, ID generation
│   │       ├── export.ts      # JSON export/import with sanitization
│   │       ├── snapshots.ts   # Snapshot CRUD, validation, localStorage
│   │       ├── storage.ts     # localStorage wrapper with validation
│   │       ├── theme.ts       # Theme color constants
│   │       ├── validation.ts  # Input validation + security sanitization
│   │       └── index.ts       # Re-exports
│   │
│   └── test/
│       ├── setup.ts           # Test configuration
│       └── ThemeWrapper.tsx    # Test utility for themed components
│
├── styles/
│   └── globals.css            # Global styles + date input styling
│
├── public/
│   └── favicon.ico
│
├── eslint.config.mjs          # ESLint 9 flat config
├── vitest.config.ts           # Vitest test configuration
├── tsconfig.json              # TypeScript configuration
├── next.config.js             # Next.js configuration
└── package.json
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   localStorage                            │   │
│  │  Key: "ganttAppData"    → JSON (AppData)                 │   │
│  │  Key: "ganttAppSnapshots" → JSON (Snapshot[])            │   │
│  │  Key: "gantt-theme"     → "light" | "dark" | "system"   │   │
│  └─────────────────────────────────────────────────────────┘   │
│         ▲                                      │                 │
│         │ save                                 │ load            │
│         │                                      ▼                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AppDataContext (Provider)                    │   │
│  │  State: data, chartColors, displaySettings,              │   │
│  │         legendLabels, toggles, preparedBy                │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         │ useAppData() hook                                      │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  index.tsx (Orchestration)                                │   │
│  │  - useSnapshots() → effective props (live vs snapshot)   │   │
│  │  - useChartEditing() → inline edit state                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ProjectsTab│ │ReleasesTab│ │GanttChart│ │ AboutTab │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Core Data Models

```typescript
// Project - a container for releases
interface Project {
  id: string;           // Unique ID (timestamp-based)
  name: string;         // Display name (max 100 chars)
  finishDate?: string;  // Optional YYYY-MM-DD
}

// Release - a time-boxed work item
interface Release {
  id: string;
  projectId: string;           // Foreign key to Project
  name: string;
  startDate: string;           // YYYY-MM-DD
  earlyFinishDate: string;     // YYYY-MM-DD (optimistic)
  lateFinishDate: string;      // YYYY-MM-DD (pessimistic)
  hidden?: boolean;            // Hide from chart
  completed?: boolean;         // Render in green
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
  legendLabels?: { solidBar: string; hatchedBar: string; finishDateLine?: string; mostLikelyLine?: string };
  preparedBy?: string;
}

// Chart color customization
interface ChartColors {
  solidBar: string;       // Hex color for solid bar
  hatchedBar: string;     // Hex color for hatched bar
  todayLine: string;      // Hex color for today line
  finishDateLine: string; // Hex color for finish date line
  mostLikelyLine: string; // Hex color for most likely line (v8.0)
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

// Top-level app data structure
interface AppData {
  projects: Project[];
  releases: Release[];
  chartColors?: ChartColors;
  activePreset?: string;
  legendLabels?: {
    solidBar: string;
    hatchedBar: string;
    finishDateLine?: string;
    mostLikelyLine?: string;     // v8.0
  };
  showTodayLine?: boolean;        // v8.0 (persisted, was transient)
  showFinishDateLine?: boolean;
  showMostLikelyLine?: boolean;   // v8.0
  chartDisplaySettings?: ChartDisplaySettings;
  preparedBy?: string;
  showPreparedBy?: boolean;
}
```

## Snapshot Architecture (v7.0)

Snapshots provide read-only historical records of release plans, stored separately from live data.

### Storage Isolation

| Key | Content | Purpose |
|-----|---------|---------|
| `ganttAppData` | AppData (live) | Current projects, releases, settings |
| `ganttAppSnapshots` | Snapshot[] | All historical snapshots across projects |
| `gantt-theme` | Theme preference | Light/dark/system |

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
Save: Current view → window.prompt() → structuredClone(releases) → addSnapshot() → localStorage
View: Click chip → setActiveSnapshotId → effective props swap → chart re-renders
Delete: Click trash → window.confirm() → deleteSnapshot() → reset to Current
Cascade: Delete project → deleteSnapshotsForProject() → all project snapshots removed
Export: loadSnapshots() → included in JSON alongside AppData
Import: parseImportedData() → validateSnapshot() each → saveSnapshots()
```

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
| `sanitizeChartColors(colors)` | Chart colors sanitization with defaults (v7.1) |
| `sanitizeLegendLabels(labels)` | Legend labels sanitization (v7.1) |

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
├── Tabs (navigation)
├── ProjectsTab
│   └── useProjects (CRUD hook + cascade snapshot delete)
├── ReleasesTab
│   └── useReleases (CRUD hook)
├── GanttChart
│   ├── SnapshotBar (chip navigation)
│   ├── SVG chart (gridlines, labels)
│   │   └── ChartReleaseBar (per-release: bars, ML line, date labels, inline editors)
│   ├── ChartLegend (editable labels incl. Most Likely)
│   ├── Read-only banner (snapshot view)
│   └── ChartSettings (display/color/toggle options)
├── AboutTab
└── ChangelogTab
```

### State Management Pattern

1. **Global State**: `AppDataContext` provides data and updaters
2. **Feature Hooks**: `useProjects`, `useReleases`, `useSnapshots` encapsulate CRUD logic
3. **Editing Hook**: `useChartEditing` manages inline edit state for names, dates, labels
4. **Effective Props**: `useEffectiveChartProps` resolves snapshot vs live data for chart rendering
5. **Local State**: Component-specific UI state (form fields, toggles)
6. **Persistence**: Automatic localStorage sync on every `updateData()` call
7. **Snapshot Storage**: Independent localStorage key managed by `useSnapshots` hook

## Chart Rendering

The GanttChart component renders an SVG with:

1. **Quarterly gridlines** - Dashed vertical lines at Q2, Q3, Q4 boundaries
2. **Year labels** - Year numbers at top of chart (quarter labels suppressed when too close)
3. **Release bars** - Rendered by ChartReleaseBar for each visible release:
   - Solid bar: startDate → earlyFinishDate
   - Hatched bar: earlyFinishDate → lateFinishDate (SVG pattern fill)
   - Most Likely line: optional vertical line within hatched bar (v8.0)
   - Date labels below bars (with collision detection, 40px minimum spacing)
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

- **Unit Tests**: Utility functions (validation, dates, colors, export, snapshots)
- **Hook Tests**: Custom hooks with renderHook (useProjects, useReleases, useChartEditing)
- **Component Tests**: UI components with React Testing Library
- **447 total tests** across 28 test files

## Build & Deployment

```bash
npm run dev      # Development with Turbopack (hot reload)
npm run build    # Production build
npm run lint     # ESLint 9 flat config
npm test         # Vitest test runner
```

**Deployment**: Push to `main` branch triggers Vercel auto-deploy.

## Key Design Decisions

1. **localStorage over cloud** - User owns their data, no auth complexity
2. **Pages Router over App Router** - Simpler, well-tested, no RSC overhead
3. **Inline SVG over chart library** - Full control, smaller bundle
4. **Feature modules** - Scales well, reduces cognitive load
5. **Defense-in-depth** - Validate on input, sanitize on load, whitelist settings
6. **Separate snapshot storage** - Isolates historical data from live data, prevents corruption risk
7. **Effective props pattern** - Chart component is data-source agnostic (live vs snapshot)
