// Releases Tab component with form and list

import { useMemo } from 'react';
import { useReleases } from './useReleases';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { isReleaseValid, getDateErrorMessage, getMostLikelyDateError, formatDateLocale } from '../../shared/utils';
import { DragHandle } from '../../shared/components/DragHandle';
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
  const { data } = useAppData();
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
    toggleReleaseCompleted,
    duplicateRelease
  } = useReleases();

  const currentReleases = data.releases.filter(r => r.projectId === selectedProjectId);
  const selectedProject = data.projects.find(p => p.id === selectedProjectId);
  const errorMessage = getDateErrorMessage(startDate, earlyFinish, lateFinish, touchedFields);
  const mostLikelyError = mostLikelyFinish ? getMostLikelyDateError(earlyFinish, lateFinish, mostLikelyFinish) : '';
  const mostLikelyErrorVisible = touchedFields.mostLikelyFinish ? mostLikelyError : '';
  const isValid = isReleaseValid(releaseName, startDate, earlyFinish, lateFinish) && !errorMessage && !mostLikelyError;

  // Determine which fields have errors for highlighting
  const startDateInvalid = touchedFields.startDate && startDate.length === 10 && (startDate < '2000-01-01' || startDate > '2050-12-31');
  const earlyFinishInvalid = touchedFields.earlyFinish && earlyFinish.length === 10 && (earlyFinish < '2000-01-01' || earlyFinish > '2050-12-31');
  const lateFinishInvalid = touchedFields.lateFinish && lateFinish.length === 10 && (lateFinish < '2000-01-01' || lateFinish > '2050-12-31');

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

      <div style={{ marginBottom: '2rem', padding: '1.5rem', background: colors.surface, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Release Name
            </label>
            <input
              type="text"
              placeholder="Release name"
              value={releaseName}
              onChange={(e) => setReleaseName(e.target.value)}
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: `2px solid ${colors.inputBorder}`,
                borderRadius: '4px',
                width: '100%',
                background: colors.inputBg,
                color: colors.text
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Start Date<span style={{ color: '#dc3545', marginLeft: '2px' }}>*</span>
            </label>
            <input
              type="date"
              value={startDate}
              className={startDate ? 'has-value' : ''}
              onChange={(e) => setStartDate(e.target.value)}
              min="2000-01-01"
              max="2050-12-31"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: startDateInvalid ? '2px solid #dc3545' : `2px solid ${colors.inputBorder}`,
                borderRadius: '4px',
                width: '100%',
                background: colors.inputBg,
                color: colors.text
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Early Finish<span style={{ color: '#dc3545', marginLeft: '2px' }}>*</span>
            </label>
            <input
              type="date"
              value={earlyFinish}
              className={earlyFinish ? 'has-value' : ''}
              onChange={(e) => setEarlyFinish(e.target.value)}
              min="2000-01-01"
              max="2050-12-31"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: earlyFinishInvalid ? '2px solid #dc3545' : `2px solid ${colors.inputBorder}`,
                borderRadius: '4px',
                width: '100%',
                background: colors.inputBg,
                color: colors.text
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Late Finish<span style={{ color: '#dc3545', marginLeft: '2px' }}>*</span>
            </label>
            <input
              type="date"
              value={lateFinish}
              className={lateFinish ? 'has-value' : ''}
              onChange={(e) => setLateFinish(e.target.value)}
              min="2000-01-01"
              max="2050-12-31"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: lateFinishInvalid ? '2px solid #dc3545' : `2px solid ${colors.inputBorder}`,
                borderRadius: '4px',
                width: '100%',
                background: colors.inputBg,
                color: colors.text
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Most Likely <span style={{ fontWeight: 'normal', fontStyle: 'italic', fontSize: '0.8rem' }}>(Opt.)</span>
            </label>
            <input
              type="date"
              value={mostLikelyFinish}
              className={mostLikelyFinish ? 'has-value' : ''}
              onChange={(e) => setMostLikelyFinish(e.target.value)}
              min="2000-01-01"
              max="2050-12-31"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: mostLikelyErrorVisible ? '2px solid #dc3545' : `2px solid ${colors.inputBorder}`,
                borderRadius: '4px',
                width: '100%',
                background: colors.inputBg,
                color: colors.text
              }}
            />
          </div>
        </div>

        {(errorMessage || mostLikelyErrorVisible) && (
          <div style={{
            color: '#dc3545',
            fontSize: '0.9rem',
            marginTop: '0.75rem',
            marginBottom: '0.75rem',
            padding: '0.5rem',
            background: '#f8d7da',
            borderRadius: '4px',
            border: '1px solid #f5c6cb'
          }}>
            {errorMessage || mostLikelyErrorVisible}
          </div>
        )}

        {editingReleaseId ? (
          <>
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
          </>
        ) : (
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
        )}
      </div>

      {currentReleases.length === 0 ? (
        <p style={{ color: colors.textMuted, fontStyle: 'italic' }}>No releases yet. Add one to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {currentReleases.map(release => (
            <div
              key={release.id}
              draggable
              onDragStart={() => onReleaseDragStart(release.id)}
              onDragOver={(e) => onReleaseDragOver(e, release.id)}
              onDragEnd={onReleaseDragEnd}
              style={{
                padding: '1rem',
                background: colors.surface,
                border: `2px solid ${colors.border}`,
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: draggedReleaseId === release.id ? 'grabbing' : 'grab',
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
                <button
                  onClick={() => toggleReleaseCompleted(release.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    minWidth: '105px',
                    background: release.completed ? '#28a745' : colors.buttonBg,
                    border: release.completed ? '1px solid #28a745' : `1px solid ${colors.buttonBorder}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: release.completed ? 'white' : colors.buttonText
                  }}
                >
                  {release.completed ? '✓ Done' : 'Mark Done'}
                </button>
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
                    background: colors.buttonBg,
                    border: `1px solid ${colors.buttonBorder}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: colors.buttonText
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete release "${release.name}"?`)) {
                      deleteRelease(release.id);
                    }
                  }}
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
          ))}
        </div>
      )}
    </div>
  );
}
