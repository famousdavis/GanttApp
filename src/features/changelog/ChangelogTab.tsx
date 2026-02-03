// Changelog Tab component

export function ChangelogTab() {
  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>Changelog</h2>
      <p style={{ color: '#555', marginBottom: '2rem' }}>
        Complete version history of GanttApp. Each version includes new features, improvements, and bug fixes.
      </p>

      {/* Version 5.6 */}
      <div>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 5.6
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            February 3, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li><strong>Security Hardening Release</strong> — comprehensive input validation and sanitization</li>
          <li>Added sanitizeString() and sanitizeId() functions to remove control characters and limit lengths</li>
          <li>Added isValidHexColor() and sanitizeColor() for strict color input validation</li>
          <li>Enhanced data import with full sanitization of all string fields (projects, releases, labels)</li>
          <li>Added file size limit (1MB) and array limits (50 projects, 500 releases) to prevent DoS via imports</li>
          <li>Added date format validation on imported release dates (rejects invalid calendar dates)</li>
          <li>Added whitelist validation for display settings (font sizes, colors, line widths)</li>
          <li>Added whitelist validation for color preset names</li>
          <li>Enhanced localStorage loading with full data validation (defense-in-depth)</li>
          <li>All imported/loaded IDs now sanitized to alphanumeric + hyphens only (safe for SVG pattern IDs)</li>
          <li>npm audit: 0 vulnerabilities maintained</li>
        </ul>
      </div>

      {/* Version 5.5 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 5.5
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            February 2, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Upgraded Next.js from 15.5.11 to 16.1.6 (major version upgrade)</li>
          <li>Turbopack is now the default bundler (faster builds)</li>
          <li>Removed ESLint bridge packages (@eslint/compat, @eslint/eslintrc, @eslint/js) — eslint-config-next@16 exports native flat config</li>
          <li>Simplified eslint.config.mjs to use native Next.js 16 flat config directly</li>
          <li>Removed obsolete eslint config block from next.config.js</li>
          <li>Refactored project auto-selection from useEffect to computed value (fixes react-hooks/set-state-in-effect lint rule)</li>
          <li>Removed unused useEffect import from main page</li>
          <li>npm audit: 0 vulnerabilities — fully JFrog scan ready</li>
          <li>All 288 tests pass, build succeeds, lint clean</li>
        </ul>
      </div>

      {/* Version 5.4 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 5.4
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            February 2, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Upgraded Next.js from 14.2.35 to 15.5.11 (major version upgrade)</li>
          <li>Upgraded React from 18 to 19 and React DOM from 18 to 19</li>
          <li>Updated @types/react and @types/react-dom to v19</li>
          <li>Migrated Context.Provider to React 19 direct Context syntax</li>
          <li>Aligned eslint-config-next to 15.5.11 to match Next.js version</li>
          <li>Resolved all Next.js 14 CVEs (GHSA-h25m, GHSA-9g9p) by upgrading to 15.x</li>
          <li>All 288 tests pass on React 19 with zero code changes required</li>
        </ul>
      </div>

      {/* Version 5.3 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 5.3
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            February 2, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Upgraded ESLint from v8 to v9 to resolve moderate security vulnerability (GHSA-p5wg)</li>
          <li>Upgraded eslint-config-next from 14.0.4 to 15.1.7 for ESLint 9 compatibility</li>
          <li>Migrated to ESLint flat config format (eslint.config.mjs) for forward compatibility</li>
          <li>Added ESLint bridge packages (@eslint/js, @eslint/eslintrc, @eslint/compat)</li>
          <li>Fixed 21 unescaped entity lint errors across JSX components</li>
          <li>Changed lint command from &ldquo;next lint&rdquo; to &ldquo;eslint .&rdquo; for ESLint 9 support</li>
          <li>Reduced npm audit vulnerabilities from 5 to 1 (remaining: Next.js CVE that does not apply to Pages Router)</li>
        </ul>
      </div>

      {/* Version 5.2 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 5.2
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            February 1, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Expanded automated test suite from 157 to 288 tests across 19 test files</li>
          <li>Added tests for useProjects hook: CRUD operations, form state, cascade delete (23 tests)</li>
          <li>Added tests for useReleases hook: CRUD operations, validation, toggle operations (27 tests)</li>
          <li>Added tests for ProjectsTab component: rendering, form, edit/delete, navigation, validation (20 tests)</li>
          <li>Added tests for ReleasesTab component: rendering, project selection, form, toggles (18 tests)</li>
          <li>Added tests for UI components: Tabs, DragHandle, ColorSwatchPicker, GrayscaleSwatchPicker, PresetButtonGroup (34 tests)</li>
          <li>Added tests for static pages: AboutTab and ChangelogTab (9 tests)</li>
        </ul>
      </div>

      {/* Version 5.1 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 5.1
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 29, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Added automated test suite with 157 tests across 8 test files (Vitest + React Testing Library)</li>
          <li>Fixed date validation bug: invalid calendar dates (e.g., Feb 30, Month 13) are now rejected</li>
          <li>Fixed timezone inconsistency: date comparisons now use local timezone consistently</li>
          <li>Fixed potential ID collision by replacing Date.now() with unique ID generator</li>
          <li>Improved data import validation: projects and releases are now schema-validated on import</li>
          <li>Fixed chart rendering edge case when all release dates are identical</li>
          <li>Consolidated duplicate localStorage save effects in state management</li>
          <li>Removed unused useLocalStorage hook (dead code cleanup)</li>
          <li>Fixed date input placeholder styling: empty inputs show mm/dd/yyyy in light gray, entered values in dark color</li>
          <li>Copy chart as image button now excluded from captured images</li>
          <li>Improved inline &ldquo;Releases for&rdquo; dropdown styling on Releases tab</li>
        </ul>
      </div>
      {/* Version 5.0 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 5.0
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 22, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Complete architectural refactoring to Feature Modules pattern</li>
          <li>Extracted utilities, types, and components for better maintainability</li>
          <li>Reduced token usage for AI-assisted development by 75-85%</li>
          <li>Improved code organization with feature-based folder structure</li>
          <li>Created centralized context for state management</li>
          <li>All features work identically - zero functional changes for users</li>
        </ul>
      </div>

      {/* Version 4.4 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 4.4
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 21, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Enhanced Chart Settings with configurable display options</li>
          <li>Added Release Name Font Size control: Small (14px), Medium (16px), or Large (18px)</li>
          <li>Added Date Label Font Size control: Small (9px), Medium (11px), or Large (13px)</li>
          <li>Added Date Label Color control: grayscale swatches from light gray to black for better contrast</li>
          <li>Added Vertical Line Width control: Thin (2px), Medium (3px), or Thick (4px) for Today&apos;s Date and Project Finish Date lines</li>
          <li>Increased left margin space for release names and optimized chart layout</li>
          <li>All display settings persist to localStorage and survive export/import</li>
        </ul>
      </div>

      {/* Version 4.3 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 4.3
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 21, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Added release visibility toggle: hide releases from chart while keeping them in the list</li>
          <li>Added completion status: mark releases as done to render them in green</li>
          <li>Enhanced Releases tab with &ldquo;Show&rdquo; checkbox and &ldquo;Mark Done&rdquo; button for each release</li>
          <li>Completed releases display in light green (solid) and forest green (hatched)</li>
        </ul>
      </div>

      {/* Version 4.2 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 4.2
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 20, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Added optional project finish date field (Projects tab)</li>
          <li>Renamed &ldquo;Chart Color Settings&rdquo; to &ldquo;Chart Settings&rdquo;</li>
          <li>Moved chart display toggles to Chart Settings section (cleaner exported images)</li>
          <li>Added project finish date vertical line visualization (bright green by default)</li>
          <li>Added quarter labels (Q2, Q3, Q4) to timeline above vertical gridlines</li>
          <li>Enhanced Chart Settings with toggle controls and finish date color picker</li>
        </ul>
      </div>

      {/* Version 4.1 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 4.1
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 20, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Removed &ldquo;Gantt Chart:&rdquo; label prefix from chart display (project name only)</li>
          <li>Added collapsible color settings section (collapsed by default)</li>
          <li>Made legend labels editable with localStorage persistence</li>
          <li>Enhanced About page formatting (bolded &ldquo;GanttApp&rdquo; in description)</li>
        </ul>
      </div>

      {/* Version 4.0 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 4.0
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 19, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Revert from Firebase to localStorage for better data persistence</li>
          <li>While Firebase provided cloud storage, anonymous authentication sessions expired unpredictably</li>
          <li>localStorage puts users in control - data persists until they choose to clear their browser cache</li>
          <li>Export/Import feature provides reliable backup mechanism</li>
        </ul>
      </div>

      {/* Version 3.5 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 3.5
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 19, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Add configurable chart colors with preset themes</li>
          <li>Users can now customize solid bar, hatched bar, and today&apos;s line colors</li>
          <li>Includes preset color themes: Classic Blue, Ocean Green, Purple Haze, Sunset Orange, Ruby Red</li>
        </ul>
      </div>

      {/* Version 3.4 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 3.4
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 19, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Add intelligent label hiding on Gantt chart to prevent overlapping date labels</li>
        </ul>
      </div>

      {/* Version 3.3 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 3.3
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 19, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Add real-time validation for project names, release names, and date logic</li>
        </ul>
      </div>

      {/* Version 3.2 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 3.2
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 19, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Add Change Log accessible via footer link</li>
        </ul>
      </div>

      {/* Version 3.1 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 3.1
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 18, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Fix timezone bug in date display</li>
        </ul>
      </div>

      {/* Version 3.0 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 3.0
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 18, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Initial release with Firebase integration</li>
          <li>Project and release management</li>
          <li>Gantt chart visualization with uncertainty ranges</li>
        </ul>
      </div>

      {/* Version 2.1 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 2.1
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 17, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Add copyright footer and GNU GPL v3 license</li>
        </ul>
      </div>

      {/* Version 2.0 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 2.0
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 17, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Add Export/Import functionality and copy chart as image</li>
        </ul>
      </div>

      {/* Version 1.0 */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
          Version 1.0
          <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
            January 17, 2026
          </span>
        </h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Initial release with localStorage, Projects, Releases, and Gantt chart</li>
        </ul>
      </div>
    </div>
  );
}
