// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Snapshot navigation bar for the Gantt chart

import { useState, useRef, useEffect } from 'react';
import { Snapshot } from '../../shared/types';
import { useTheme } from '../../context/ThemeContext';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { TrashIconButton } from '../../shared/components/TrashIconButton';

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
  const [deleteConfirmSnapshotId, setDeleteConfirmSnapshotId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isCurrentView = activeSnapshotId === null;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (e.deltaX !== 0) return;
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const chipStyle = (isActive: boolean) => ({
    padding: '0.35rem 0.75rem',
    border: `2px solid ${isActive ? '#0070f3' : colors.borderLight}`,
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
      <div ref={scrollRef} className="snapshot-bar-scroll" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        height: '2.5rem'
      }}>
        {/* Save Snapshot button — only in Current view, pinned left */}
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

        {/* Delete button — only when viewing a historical snapshot, pinned left */}
        {!isCurrentView && activeSnapshotId && (
          <TrashIconButton
            onClick={() => setDeleteConfirmSnapshotId(activeSnapshotId)}
            ariaLabel="Delete snapshot"
            title="Delete this snapshot"
          />
        )}

        {/* Current chip */}
        <button
          onClick={() => onSelectSnapshot(null)}
          style={chipStyle(isCurrentView)}
          title="View current release plan"
        >
          Current{isCurrentView ? ' \u2713' : ''}
        </button>

        {/* Snapshot chips — newest first */}
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
      </div>

      {/* Delete snapshot confirmation modal */}
      {deleteConfirmSnapshotId && (() => {
        const snap = snapshots.find(s => s.id === deleteConfirmSnapshotId);
        const label = snap ? `"${snap.name}"` : 'this snapshot';
        const dateStr = snap ? new Date(snap.timestamp).toLocaleDateString('en-US', {
          year: 'numeric', month: 'short', day: 'numeric'
        }) : '';
        return (
          <ConfirmDialog
            modal
            title="Delete Snapshot"
            message={`Delete snapshot ${label}${dateStr ? ` (${dateStr})` : ''}?`}
            colors={colors}
            buttons={[
              {
                label: 'Cancel',
                variant: 'secondary',
                onClick: () => setDeleteConfirmSnapshotId(null),
              },
              {
                label: 'Delete',
                variant: 'danger',
                onClick: () => {
                  // v0.28.10 backstop — see pages/index.tsx. The prop is typed
                  // `=> void` but the wired handler is async, so resolve first.
                  Promise.resolve(onDeleteSnapshot(deleteConfirmSnapshotId))
                    .catch(err => console.error('Delete snapshot failed:', err));
                  setDeleteConfirmSnapshotId(null);
                },
              },
            ]}
          />
        );
      })()}
    </div>
  );
}
