// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Releases Tab component with form and list

import { useState, useMemo } from 'react';
import { useReleases } from './useReleases';
import { ReleaseFormFields } from './ReleaseFormFields';
import { ReleaseStatusControl } from './ReleaseStatusControl';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { isReleaseValid, getDateErrorMessage, getMostLikelyDateError, getDateWarnings, getEffectiveWorkDays, formatDateLocale } from '../../shared/utils';
import { DragHandle } from '../../shared/components/DragHandle';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { useKeyboardShortcuts } from '../../shared/hooks/useKeyboardShortcuts';

interface ReleasesTabProps {
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  draggedReleaseId: string | null;
  onReleaseDragStart: (id: string) => void;
  onReleaseDragOver: (e: React.DragEvent, id: string) => void;
  onReleaseDragEnd: () => void;
}

export function ReleasesTab({
  selectedProjectId,
  setSelectedProjectId,
  draggedReleaseId,
  onReleaseDragStart,
  onReleaseDragOver,
  onReleaseDragEnd
}: ReleasesTabProps) {
  const { data, globalWorkDays } = useAppData();
  const { colors } = useTheme();
  const {
    releaseName,
    setReleaseName,
    startDate,
    setStartDate,
    earlyFinish,
    setEarlyFinish,
    lateFinish,
    setLateFinish,
    editingReleaseId,
    touchedFields,
    setTouchedFields,
    addRelease,
    updateRelease,
    deleteRelease,
    startEditRelease,
    clearReleaseForm,
    mostLikelyFinish,
    setMostLikelyFinish,
    toggleReleaseHidden,
    setReleaseStatus,
    duplicateRelease
  } = useReleases();

  const [deleteConfirmReleaseId, setDeleteConfirmReleaseId] = useState<string | null>(null);

  const currentReleases = data.releases.filter(r => r.projectId === selectedProjectId);
  const selectedProject = data.projects.find(p => p.id === selectedProjectId);
  const errorMessage = getDateErrorMessage(startDate, earlyFinish, lateFinish, touchedFields);
  const mostLikelyError = mostLikelyFinish ? getMostLikelyDateError(earlyFinish, lateFinish, mostLikelyFinish) : '';
  const mostLikelyErrorVisible = touchedFields.mostLikelyFinish ? mostLikelyError : '';
  const isValid = isReleaseValid(releaseName, startDate, earlyFinish, lateFinish) && !errorMessage && !mostLikelyError;

  // Work-week warnings (v15.0). Warnings never block save — they're informational.
  // No touched-field gate: <input type="date"> only fires onChange with complete valid input,
  // and getDateWarnings internally checks isValidDateFormat() before emitting.
  const effectiveWorkDays = getEffectiveWorkDays(selectedProject, globalWorkDays);
  const warnings = getDateWarnings(startDate, earlyFinish, lateFinish, mostLikelyFinish, effectiveWorkDays);

  // Keyboard shortcuts for Releases tab
  const shortcuts = useMemo(() => ({
    'escape': () => {
      if (editingReleaseId) {
        clearReleaseForm();
      }
    },
    'ctrl+s': () => {
      if (editingReleaseId) {
        if (isValid) updateRelease();
      } else {
        if (isValid) addRelease(selectedProjectId);
      }
    }
  }), [editingReleaseId, isValid, selectedProjectId, clearReleaseForm, updateRelease, addRelease]);

  useKeyboardShortcuts(shortcuts);

  if (data.projects.length === 0) {
    return <p style={{ color: colors.textMuted, fontStyle: 'italic' }}>No projects yet. Create a project first!</p>;
  }

  // Form fields props — shared between Add and inline Edit forms
  const formFieldsProps = {
    releaseName, setReleaseName,
    startDate, setStartDate,
    earlyFinish, setEarlyFinish,
    lateFinish, setLateFinish,
    mostLikelyFinish, setMostLikelyFinish,
    touchedFields, errorMessage, mostLikelyErrorVisible, warnings, colors,
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: colors.text, display: 'flex', alignItems: 'baseline' }}>
        <span style={{ fontWeight: 'normal' }}>Releases for </span>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          style={{
            fontSize: '1.5rem',
            color: colors.text,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 600,
            padding: 0,
            outline: 'none',
            marginLeft: '0'
          }}
        >
          {data.projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </h2>

      {/* Add Release form — hidden when editing inline */}
      {!editingReleaseId && (
        <div style={{ marginBottom: '2rem', padding: '1.5rem', background: colors.surface, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
          <ReleaseFormFields {...formFieldsProps} />
          <button
            onClick={() => addRelease(selectedProjectId)}
            disabled={!isValid}
            style={{
              padding: '0.75rem 1.5rem',
              background: isValid ? '#0070f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isValid ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              opacity: isValid ? 1 : 0.6
            }}
          >
            Add Release
          </button>
        </div>
      )}

      {currentReleases.length === 0 ? (
        <p style={{ color: colors.textMuted, fontStyle: 'italic' }}>No releases yet. Add one to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {currentReleases.map(release => (
            <div key={release.id}>
              {/* Release row */}
              <div
                draggable={editingReleaseId !== release.id}
                onDragStart={() => onReleaseDragStart(release.id)}
                onDragOver={(e) => onReleaseDragOver(e, release.id)}
                onDragEnd={onReleaseDragEnd}
                style={{
                  padding: '1rem',
                  background: colors.surface,
                  border: editingReleaseId === release.id ? '2px solid #0070f3' : `2px solid ${colors.border}`,
                  borderRadius: editingReleaseId === release.id ? '8px 8px 0 0' : '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: editingReleaseId === release.id ? 'default' : (draggedReleaseId === release.id ? 'grabbing' : 'grab'),
                  opacity: draggedReleaseId === release.id ? 0.5 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <DragHandle />
                  <div>
                    <strong style={{ fontSize: '1.1rem', display: 'block', marginBottom: '0.5rem', color: colors.text }}>
                      {release.name}
                    </strong>
                    <div style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
                      <span>Start: {formatDateLocale(release.startDate)}</span>
                      <span style={{ margin: '0 1rem' }}>|</span>
                      <span>Early: {formatDateLocale(release.earlyFinishDate)}</span>
                      <span style={{ margin: '0 1rem' }}>|</span>
                      <span>Late: {formatDateLocale(release.lateFinishDate)}</span>
                      {release.mostLikelyFinishDate && (
                        <>
                          <span style={{ margin: '0 1rem' }}>|</span>
                          <span>ML: {formatDateLocale(release.mostLikelyFinishDate)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    background: release.hidden ? colors.hoverBg : 'transparent',
                    color: colors.textSecondary
                  }}>
                    <input
                      type="checkbox"
                      checked={!release.hidden}
                      onChange={() => toggleReleaseHidden(release.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Show</span>
                  </label>
                  <ReleaseStatusControl
                    value={release.status ?? 'not-started'}
                    onChange={(s) => setReleaseStatus(release.id, s)}
                    colors={colors}
                  />
                  <button
                    onClick={() => duplicateRelease(release.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: colors.buttonBg,
                      border: `1px solid ${colors.buttonBorder}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: colors.buttonText
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => startEditRelease(release)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: editingReleaseId === release.id ? '#0070f3' : colors.buttonBg,
                      border: editingReleaseId === release.id ? '1px solid #0070f3' : `1px solid ${colors.buttonBorder}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: editingReleaseId === release.id ? 'white' : colors.buttonText
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmReleaseId(release.id)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: colors.buttonBg,
                      border: '1px solid #dc3545',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: '#dc3545'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Inline edit form — appears below the release being edited */}
              {editingReleaseId === release.id && (
                <div style={{
                  padding: '1.5rem',
                  background: colors.surface,
                  borderRadius: '0 0 8px 8px',
                  border: '2px solid #0070f3',
                  borderTop: `1px solid ${colors.border}`
                }}>
                  <ReleaseFormFields {...formFieldsProps} />
                  <button
                    onClick={updateRelease}
                    disabled={!isValid}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: isValid ? '#00c9a7' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isValid ? 'pointer' : 'not-allowed',
                      fontWeight: '600',
                      marginRight: '0.5rem',
                      opacity: isValid ? 1 : 0.6
                    }}
                  >
                    Update Release
                  </button>
                  <button
                    onClick={clearReleaseForm}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#999',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete release confirmation modal */}
      {deleteConfirmReleaseId && (() => {
        const release = currentReleases.find(r => r.id === deleteConfirmReleaseId);
        return release ? (
          <ConfirmDialog
            modal
            title="Delete Release"
            message={`Delete release "${release.name}"?`}
            colors={colors}
            buttons={[
              {
                label: 'Cancel',
                variant: 'secondary',
                onClick: () => setDeleteConfirmReleaseId(null),
              },
              {
                label: 'Delete',
                variant: 'danger',
                onClick: () => {
                  deleteRelease(release.id);
                  setDeleteConfirmReleaseId(null);
                },
              },
            ]}
          />
        ) : null;
      })()}
    </div>
  );
}
