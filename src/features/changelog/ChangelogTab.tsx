// Changelog Tab — data-driven rendering from changelog-data.tsx

import { useTheme } from '../../context/ThemeContext';
import { CHANGELOG_ENTRIES } from './changelog-data';

export function ChangelogTab() {
  const { colors } = useTheme();

  const versionStyle = {
    fontSize: '1.2rem',
    color: '#0070f3',
    marginBottom: '0.5rem',
  };

  const dateStyle = {
    fontSize: '0.9rem',
    color: colors.textMuted,
    marginLeft: '1rem',
    fontWeight: 'normal' as const,
  };

  const listStyle = {
    paddingLeft: '2rem',
    lineHeight: '1.8',
    color: colors.textSecondary,
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: colors.text }}>Changelog</h2>
      <p style={{ color: colors.textSecondary, marginBottom: '2rem' }}>
        Complete version history of GanttApp. Each version includes new features, improvements, and bug fixes.
      </p>

      {CHANGELOG_ENTRIES.map((entry, index) => (
        <div key={entry.version} style={index > 0 ? { marginTop: '2rem' } : undefined}>
          <h3 style={versionStyle}>
            Version {entry.version}
            <span style={dateStyle}>{entry.date}</span>
          </h3>
          <ul style={listStyle}>
            {entry.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
