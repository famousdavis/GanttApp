// Snapshot navigation bar for the Gantt chart

import { Snapshot } from '../../shared/types';
import { useTheme } from '../../context/ThemeContext';

interface SnapshotBarProps {
  snapshots: Snapshot[];
  activeSnapshotId: string | null;
  onSelectSnapshot: (id: string | null) => void;
  onSaveSnapshot: () => void;
  onDeleteSnapshot: (id: string) => void;
}

export function SnapshotBar({
  snapshots,
  activeSnapshotId,
  onSelectSnapshot,
  onSaveSnapshot,
  onDeleteSnapshot
}: SnapshotBarProps) {
  const { colors } = useTheme();
  const isCurrentView = activeSnapshotId === null;

  const chipStyle = (isActive: boolean) => ({
    padding: '0.35rem 0.75rem',
    border: isActive ? '2px solid #0070f3' : `1px solid ${colors.borderLight}`,
    borderRadius: '20px',
    background: isActive ? '#0070f3' : colors.surface,
    color: isActive ? '#ffffff' : colors.text,
    cursor: 'pointer' as const,
    fontSize: '0.8rem',
    fontWeight: isActive ? 600 : 400 as number,
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s ease'
  });

  const formatSnapshotDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  return (
    <div className="copy-image-button" style={{ marginBottom: '0.75rem' }}>
      {/* Navigation chips */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        paddingBottom: '0.25rem'
      }}>
        {/* Current chip */}
        <button
          onClick={() => onSelectSnapshot(null)}
          style={chipStyle(isCurrentView)}
          title="View current release plan"
        >
          Current{isCurrentView ? ' \u2713' : ''}
        </button>

        {/* Snapshot chips */}
        {snapshots.map(snapshot => {
          const isActive = activeSnapshotId === snapshot.id;
          return (
            <button
              key={snapshot.id}
              onClick={() => onSelectSnapshot(snapshot.id)}
              style={chipStyle(isActive)}
              title={`${snapshot.name} — ${formatSnapshotDate(snapshot.timestamp)}`}
            >
              {snapshot.name}
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Save Snapshot button — only in Current view */}
        {isCurrentView && (
          <button
            onClick={onSaveSnapshot}
            style={{
              padding: '0.35rem 0.75rem',
              border: `1px solid ${colors.borderLight}`,
              borderRadius: '20px',
              background: colors.surface,
              color: colors.text,
              cursor: 'pointer',
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
            title="Save a snapshot of the current release plan"
          >
            <span role="img" aria-label="camera">📸</span> Save Snapshot
          </button>
        )}

        {/* Delete button — only when viewing a historical snapshot */}
        {!isCurrentView && activeSnapshotId && (
          <button
            onClick={() => onDeleteSnapshot(activeSnapshotId)}
            style={{
              padding: '0.35rem 0.5rem',
              border: `1px solid ${colors.borderLight}`,
              borderRadius: '20px',
              background: colors.surface,
              color: '#dc3545',
              cursor: 'pointer',
              fontSize: '0.8rem',
              whiteSpace: 'nowrap'
            }}
            title="Delete this snapshot"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}
