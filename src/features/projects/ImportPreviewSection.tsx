// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// v0.24.0 — Inline import preview UI for per-project conflict resolution.
// Controlled, stateless: all state lives in ProjectsTab. Mode toggle, decisions,
// and apply state are passed in as props and surfaced via callbacks.

import { useEffect, useRef } from 'react';
import type { ImportResult, ImportConflict, ConflictAction } from '../../shared/utils/export';
import type { ThemeColors } from '../../shared/utils/theme';

interface ImportPreviewSectionProps {
  imported: ImportResult;
  conflicts: ImportConflict[];
  decisions: Map<string, ConflictAction>;
  mode: 'merge' | 'replace-all';
  applying: boolean;
  idPrefix: string;
  colors: ThemeColors;
  onModeChange: (mode: 'merge' | 'replace-all') => void;
  onDecisionChange: (projectId: string, action: ConflictAction) => void;
  onConfirm: () => void;
  onRequestReplaceAll: () => void;
  onCancel: () => void;
}

const ACTION_LABELS: Record<ConflictAction, string> = {
  skip: 'Keep existing, ignore imported',
  copy: 'Add as a copy',
  replace: 'Replace existing with imported',
};

const ACTIONS: ConflictAction[] = ['skip', 'copy', 'replace'];

export function ImportPreviewSection({
  imported,
  conflicts,
  decisions,
  mode,
  applying,
  idPrefix,
  colors,
  onModeChange,
  onDecisionChange,
  onConfirm,
  onRequestReplaceAll,
  onCancel,
}: ImportPreviewSectionProps) {
  const isModeToggleable =
    imported.exportType === 'ganttapp-all-projects' ||
    imported.exportType === 'legacy';

  const conflictIncomingIds = new Set(conflicts.map(c => c.incomingProject.id));
  const nonConflicting = imported.appData.projects.filter(p => !conflictIncomingIds.has(p.id));

  const releaseCountByProjectId = new Map<string, number>();
  for (const r of imported.appData.releases) {
    releaseCountByProjectId.set(r.projectId, (releaseCountByProjectId.get(r.projectId) ?? 0) + 1);
  }

  const isReplaceMode = isModeToggleable && mode === 'replace-all';

  // v0.26.0 — accessibility (Phase 11):
  // - role="region" with aria-labelledby (heading id) for screen-reader orientation.
  // - Programmatic focus on the heading on mount so keyboard users land in the
  //   right place. tabIndex={-1} keeps the heading out of the Tab cycle.
  // - Escape key dismisses the preview (matches the Cancel button), suppressed
  //   while applying so an in-flight apply isn't cancelled.
  // - role="radiogroup" per conflict for clearer screen-reader navigation.
  // - aria-busy on action buttons reflects the apply state.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = `${idPrefix}-heading`;
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [applying, onCancel]);

  const cardStyle: React.CSSProperties = {
    marginBottom: '1rem',
    padding: '1.25rem',
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 600,
    color: colors.text,
  };

  const greenBlockStyle: React.CSSProperties = {
    marginTop: '0.75rem',
    padding: '0.75rem 1rem',
    background: 'rgba(16, 185, 129, 0.08)',
    border: '1px solid rgba(16, 185, 129, 0.35)',
    borderRadius: '6px',
    color: colors.text,
  };

  const amberBlockStyle: React.CSSProperties = {
    marginTop: '0.5rem',
    padding: '0.75rem 1rem',
    background: 'rgba(217, 119, 6, 0.08)',
    border: '1px solid rgba(217, 119, 6, 0.35)',
    borderRadius: '6px',
    color: colors.text,
  };

  const hintStyle: React.CSSProperties = {
    margin: '0.5rem 0 0 0',
    fontSize: '0.85rem',
    color: colors.textMuted,
    fontStyle: 'italic',
  };

  const buttonRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '1rem',
  };

  const primaryButtonStyle = (enabled: boolean): React.CSSProperties => ({
    padding: '0.55rem 1.1rem',
    background: enabled ? '#0070f3' : '#9ca3af',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontWeight: 600,
    opacity: enabled ? 1 : 0.7,
  });

  const dangerButtonStyle = (enabled: boolean): React.CSSProperties => ({
    padding: '0.55rem 1.1rem',
    background: enabled ? '#e53e3e' : '#9ca3af',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontWeight: 600,
    opacity: enabled ? 1 : 0.7,
  });

  const secondaryButtonStyle = (enabled: boolean): React.CSSProperties => ({
    padding: '0.55rem 1.1rem',
    background: 'transparent',
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontWeight: 600,
    opacity: enabled ? 1 : 0.7,
  });

  return (
    <div
      style={cardStyle}
      data-testid="import-preview-section"
      role="region"
      aria-labelledby={headingId}
    >
      <h3 ref={headingRef} id={headingId} tabIndex={-1} style={sectionTitleStyle}>
        Review import
      </h3>

      {isModeToggleable && (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: applying ? 'not-allowed' : 'pointer', opacity: applying ? 0.6 : 1 }}>
            <input
              type="radio"
              name={`${idPrefix}-mode`}
              checked={mode === 'merge'}
              disabled={applying}
              onChange={() => onModeChange('merge')}
            />
            Merge into workspace
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: applying ? 'not-allowed' : 'pointer', opacity: applying ? 0.6 : 1 }}>
            <input
              type="radio"
              name={`${idPrefix}-mode`}
              checked={mode === 'replace-all'}
              disabled={applying}
              onChange={() => onModeChange('replace-all')}
            />
            Replace entire workspace
          </label>
        </div>
      )}

      {/* Replace-mode hides the per-project conflict UI entirely (not disabled). */}
      {!isReplaceMode && (
        <>
          {/* Merge-mode hint for workspace-settings handling — shown only for
              files that carry global settings (ganttapp-all-projects / legacy). */}
          {isModeToggleable && (
            <p style={hintStyle}>
              Workspace settings (colors, attribution) are not imported in Merge mode. Switch to Replace All to restore them.
            </p>
          )}

          {nonConflicting.length > 0 && (
            <div style={greenBlockStyle}>
              <strong>New projects ({nonConflicting.length})</strong>
              <ul style={{ margin: '0.4rem 0 0 1.25rem', padding: 0 }}>
                {nonConflicting.map(p => {
                  const rc = releaseCountByProjectId.get(p.id) ?? 0;
                  return (
                    <li key={p.id}>
                      {p.name} <span style={{ color: colors.textMuted, fontSize: '0.85rem' }}>({rc} release{rc !== 1 ? 's' : ''})</span>
                    </li>
                  );
                })}
              </ul>
              <p style={{ ...hintStyle, marginTop: '0.4rem' }}>
                New projects will be added at the bottom of your project list.
              </p>
            </div>
          )}

          {conflicts.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <strong style={{ color: colors.text }}>Conflicts ({conflicts.length})</strong>
              {conflicts.map(conflict => {
                const incomingId = conflict.incomingProject.id;
                const groupName = `${idPrefix}-conflict-${incomingId}`;
                const groupLabelId = `${groupName}-label`;
                const currentAction = decisions.get(incomingId) ?? 'skip';
                return (
                  <div
                    key={incomingId}
                    style={amberBlockStyle}
                    data-testid={`conflict-group-${incomingId}`}
                    role="radiogroup"
                    aria-labelledby={groupLabelId}
                  >
                    {conflict.type === 'id' ? (
                      <>
                        <div id={groupLabelId} style={{ fontSize: '0.9rem', color: colors.text }}>
                          <span style={{ color: colors.textMuted }}>Existing:</span> <strong>&ldquo;{conflict.existingProject.name}&rdquo;</strong>
                          {' → '}
                          <span style={{ color: colors.textMuted }}>Incoming:</span> <strong>&ldquo;{conflict.incomingProject.name}&rdquo;</strong>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '0.15rem' }}>
                          Already exists — same project
                        </div>
                      </>
                    ) : (
                      <>
                        <div id={groupLabelId} style={{ fontSize: '0.9rem', color: colors.text }}>
                          <strong>&ldquo;{conflict.incomingProject.name}&rdquo;</strong>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#92400e', marginTop: '0.15rem' }}>
                          Already exists — same name, different origin
                        </div>
                      </>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                      {ACTIONS.map(action => {
                        const radioId = `${groupName}-${action}`;
                        return (
                          <label
                            key={action}
                            htmlFor={radioId}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: applying ? 'not-allowed' : 'pointer', opacity: applying ? 0.6 : 1 }}
                          >
                            <input
                              type="radio"
                              id={radioId}
                              name={groupName}
                              value={action}
                              checked={currentAction === action}
                              disabled={applying}
                              onChange={() => onDecisionChange(incomingId, action)}
                            />
                            {ACTION_LABELS[action]}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div style={buttonRowStyle}>
        {isReplaceMode ? (
          <button
            type="button"
            onClick={onRequestReplaceAll}
            disabled={applying}
            aria-busy={applying}
            style={dangerButtonStyle(!applying)}
          >
            Replace All Data
          </button>
        ) : (
          <button
            type="button"
            onClick={onConfirm}
            disabled={applying}
            aria-busy={applying}
            style={primaryButtonStyle(!applying)}
          >
            {isModeToggleable ? 'Confirm Merge' : 'Confirm Import'}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={applying}
          aria-busy={applying}
          style={secondaryButtonStyle(!applying)}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
