# Change Log

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
