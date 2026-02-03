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
│   ├── index.tsx              # Main app entry + GanttChart SVG component
│   ├── _app.tsx               # Next.js app wrapper
│   └── index-old.tsx          # Pre-refactor backup (reference only)
│
├── src/
│   ├── context/
│   │   └── AppDataContext.tsx # Global state provider + localStorage sync
│   │
│   ├── features/              # Feature-based modules
│   │   ├── about/
│   │   │   └── AboutTab.tsx
│   │   ├── changelog/
│   │   │   └── ChangelogTab.tsx
│   │   ├── chart/
│   │   │   └── useChartCalculations.ts
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
│   │   │   └── Tabs.tsx
│   │   ├── hooks/
│   │   │   └── useDragAndDrop.ts
│   │   ├── types/
│   │   │   ├── models.ts      # Core data models (Project, Release, etc.)
│   │   │   ├── app.ts         # App-level types (AppData, TabType)
│   │   │   └── index.ts       # Re-exports
│   │   └── utils/
│   │       ├── colors.ts      # Color constants, presets, defaults
│   │       ├── dates.ts       # Date parsing, formatting, ID generation
│   │       ├── export.ts      # JSON export/import with sanitization
│   │       ├── storage.ts     # localStorage wrapper with validation
│   │       ├── validation.ts  # Input validation + security sanitization
│   │       └── index.ts       # Re-exports
│   │
│   └── test/
│       └── setup.ts           # Test configuration
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
│  │                   Key: "ganttAppData"                     │   │
│  │                   Value: JSON (AppData)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│         ▲                                      │                 │
│         │ saveData()                           │ loadData()      │
│         │                                      ▼                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AppDataContext (Provider)                    │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  State:                                          │    │   │
│  │  │  - data: AppData (projects, releases)            │    │   │
│  │  │  - chartColors, displaySettings                  │    │   │
│  │  │  - legendLabels, toggles                         │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                        │
│         │ useAppData() hook                                      │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Feature Components                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ProjectsTab│ │ReleasesTab│ │GanttChart│ │ AboutTab │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
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
}

// Chart color customization
interface ChartColors {
  solidBar: string;      // Hex color for solid bar
  hatchedBar: string;    // Hex color for hatched bar
  todayLine: string;     // Hex color for today line
  finishDateLine: string; // Hex color for finish date line
}

// Display settings
interface ChartDisplaySettings {
  releaseNameFontSize: '14' | '16' | '18';
  dateLabelFontSize: '11' | '13' | '15';
  dateLabelColor: '#999' | '#666' | '#333' | '#000';
  verticalLineWidth: '2' | '3' | '4';
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
  };
  showFinishDateLine?: boolean;
  chartDisplaySettings?: ChartDisplaySettings;
}
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

### Import Limits (export.ts)

| Limit | Value | Purpose |
|-------|-------|---------|
| MAX_FILE_SIZE | 1MB | Prevent DoS via large files |
| MAX_PROJECTS | 50 | Prevent array exhaustion |
| MAX_RELEASES | 500 | Prevent array exhaustion |

## Component Architecture

### Tab Structure

```
index.tsx (AppContent)
├── Tabs (navigation)
├── ProjectsTab
│   └── useProjects (CRUD hook)
├── ReleasesTab
│   └── useReleases (CRUD hook)
├── GanttChart (inline)
│   └── useChartCalculations
├── AboutTab
└── ChangelogTab
```

### State Management Pattern

1. **Global State**: `AppDataContext` provides data and updaters
2. **Feature Hooks**: `useProjects`, `useReleases` encapsulate CRUD logic
3. **Local State**: Component-specific UI state (form fields, toggles)
4. **Persistence**: Automatic localStorage sync on every `updateData()` call

## Chart Rendering

The GanttChart component renders an SVG with:

1. **Quarterly gridlines** - Dashed vertical lines at Q2, Q3, Q4 boundaries
2. **Year labels** - Year numbers at top of chart
3. **Release bars** - For each visible release:
   - Solid bar: startDate → earlyFinishDate
   - Hatched bar: earlyFinishDate → lateFinishDate (SVG pattern fill)
   - Date labels below bars (with collision detection)
4. **Vertical lines** - Today's date, project finish date (configurable)
5. **Legend** - Editable labels for bar types

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

- **Unit Tests**: Utility functions (validation, dates, colors, export)
- **Hook Tests**: Custom hooks with renderHook (useProjects, useReleases)
- **Component Tests**: UI components with React Testing Library
- **288 total tests** across 19 test files

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
