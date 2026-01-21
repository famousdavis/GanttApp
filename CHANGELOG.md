# Change Log

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

## Version 3.6
- Revert to localStorage
- Add drag-and-drop reordering for projects and releases

## Version 3.5
- Add configurable chart colors with preset themes
- Users can now customize solid bar, hatched bar, and today's line colors
- Includes preset color themes: Classic Blue, Ocean Green, Purple Haze, Sunset Orange, Ruby Red

## Version 3.0
- Initial release with Firebase integration
- Project and release management
- Gantt chart visualization with uncertainty ranges
