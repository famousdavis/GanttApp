// Changelog Tab component

export function ChangelogTab() {
  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>Changelog</h2>
      <p style={{ color: '#555', marginBottom: '2rem' }}>
        Complete version history of GanttApp. Each version includes new features, improvements, and bug fixes.
      </p>

      {/* Version 5.0 */}
      <div>
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
          <li>Added Vertical Line Width control: Thin (2px), Medium (3px), or Thick (4px) for Today's Date and Project Finish Date lines</li>
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
          <li>Enhanced Releases tab with "Show" checkbox and "Mark Done" button for each release</li>
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
          <li>Renamed "Chart Color Settings" to "Chart Settings"</li>
          <li>Moved chart display toggles to Chart Settings section (cleaner exported images)</li>
          <li>Added project finish date vertical line visualization (bright green by default)</li>
          <li>Added quarter labels (Q2, Q3, Q4) to timeline above vertical gridlines</li>
          <li>Enhanced Chart Settings with toggle controls and finish date color picker</li>
        </ul>
      </div>

      {/* Earlier versions note */}
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f9f9f9', borderRadius: '8px' }}>
        <p style={{ color: '#666', fontStyle: 'italic' }}>
          For complete version history (v1.0 - v4.1), see the full changelog in the original application code.
        </p>
      </div>
    </div>
  );
}
