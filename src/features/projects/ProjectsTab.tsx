// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Projects Tab component with form and list

import { useState, useMemo, useId } from 'react';
import { useProjects } from './useProjects';
import { ShareDialog } from './ShareDialog';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import {
  exportData as exportDataUtil,
  exportSingleProject,
} from '../../shared/utils';
import { ImportPreviewSection } from './ImportPreviewSection';
import { useImportState } from './hooks/useImportState';
import { isProjectNameValid, getWorkDayWarning, getEffectiveWorkDays } from '../../shared/utils';
import { formatDateMDY } from '../../shared/utils';
import { DragHandle } from '../../shared/components/DragHandle';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { TrashIconButton } from '../../shared/components/TrashIconButton';
import { PencilIconButton } from '../../shared/components/PencilIconButton';
import { ExportIconButton } from '../../shared/components/ExportIconButton';
import { CloneIconButton } from '../../shared/components/CloneIconButton';
import { ShareIconButton } from '../../shared/components/ShareIconButton';
import { WorkWeekSelector } from '../../shared/components/WorkWeekSelector';
import { TabType, Snapshot, Project } from '../../shared/types';
import { useKeyboardShortcuts } from '../../shared/hooks/useKeyboardShortcuts';
import type { CloudGanttStorageService } from '../../shared/storage';

interface ProjectsTabProps {
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  setActiveTab: (tab: TabType) => void;
  draggedProjectId: string | null;
  onProjectDragStart: (id: string) => void;
  onProjectDragOver: (e: React.DragEvent, id: string) => void;
  onProjectDragEnd: () => void;
  onReplaceSnapshots: (snapshots: Snapshot[]) => Promise<void>;
}

export function ProjectsTab({
  selectedProjectId,
  setSelectedProjectId,
  setActiveTab,
  draggedProjectId,
  onProjectDragStart,
  onProjectDragOver,
  onProjectDragEnd,
  onReplaceSnapshots
}: ProjectsTabProps) {
  const { data, updateData, globalWorkDays, loading: appDataLoading } = useAppData();
  const { colors, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const { storage } = useStorage();
  const baseFieldId = useId();
  const projectNameId = `${baseFieldId}-project-name`;
  const projectFinishDateId = `${baseFieldId}-project-finish-date`;
  const importIdPrefix = `${baseFieldId}-import`;
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null);
  const [exportAllHover, setExportAllHover] = useState(false);
  const [importHover, setImportHover] = useState(false);
  const [tileHoverId, setTileHoverId] = useState<string | null>(null);
  const isCloudMode = storage.mode === 'cloud';
  const {
    projectName,
    setProjectName,
    projectFinishDate,
    setProjectFinishDate,
    projectWorkDays,
    setProjectWorkDays,
    editingProjectId,
    addProject,
    updateProject,
    deleteProject,
    startEditProject,
    cancelEditProject,
    cloneProject
  } = useProjects();

  // v19.0 — Edit-pencil UX: short blue-glow pulse on the form card after click,
  // paired with window.scrollTo so the user can see where their attention is being directed.
  const [editHighlight, setEditHighlight] = useState(false);
  const handleEditProject = (project: Project) => {
    startEditProject(project);
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setEditHighlight(true);
    setTimeout(() => setEditHighlight(false), 600);
  };

  // v19.0 — Per-tile export downloads a single-project JSON file (no global settings).
  const handleExportProject = async (projectId: string) => {
    await exportSingleProject(projectId, data, storage, {
      storageMode: storage.mode,
      uid: user?.uid,
    });
  };

  const handleExport = async () => {
    const allSnapshots = await storage.loadSnapshots();
    exportDataUtil(data, allSnapshots, {
      storageMode: storage.mode,
      uid: user?.uid,
    });
  };

  // v0.26.0 — Smart Import state machine extracted to useImportState hook (pitfall #59).
  // NOTE: ProjectsTab unmounts on tab switch — preview state is lost on navigation.
  // Known limitation; do not lift state up to compensate. See APPLYING CONTRACT
  // and docs/SPEC_DEVIATIONS.md for the full state-machine spec.
  const {
    importPreview,
    importBanner,
    replaceAllPending,
    applying,
    fileInputRef,
    setImportBanner,
    openReplaceAllConfirm,
    cancelReplaceAllConfirm,
    handleConfirmReplaceAll,
    handleImport,
    handleConfirmMerge,
    handleImportCancel,
    onModeChange,
    onDecisionChange,
  } = useImportState({
    data,
    storage,
    updateData,
    onReplaceSnapshots,
    selectedProjectId,
    setSelectedProjectId,
    appDataLoading,
  });

  const [finishDateError, setFinishDateError] = useState('');

  const validateFinishDate = (date: string) => {
    if (date === '') {
      setFinishDateError('');
      return true;
    }
    if (date.length !== 10) {
      setFinishDateError('Please enter a complete date');
      return false;
    }
    if (date < '2000-01-01' || date > '2050-12-31') {
      setFinishDateError('Date must be between 2000 and 2050');
      return false;
    }
    setFinishDateError('');
    return true;
  };

  const isValid = isProjectNameValid(projectName) && !finishDateError;

  // Work-week warning for the Finish Date field. Uses the project override (if editing
  // and one is selected) otherwise the global default. Non-blocking — warnings never
  // prevent save, matching the pattern in ReleaseFormFields.
  const formEffectiveWorkDays = (projectWorkDays && projectWorkDays.length > 0)
    ? projectWorkDays
    : globalWorkDays;
  const finishDateWarning = projectFinishDate && !finishDateError
    ? getWorkDayWarning(projectFinishDate, formEffectiveWorkDays)
    : '';

  // Keyboard shortcuts for Projects tab
  const shortcuts = useMemo(() => ({
    'escape': () => {
      if (editingProjectId) {
        cancelEditProject();
      }
    },
    'ctrl+s': () => {
      if (editingProjectId) {
        if (isValid) updateProject();
      } else {
        if (isValid) addProject(selectedProjectId, setSelectedProjectId);
      }
    }
  }), [editingProjectId, isValid, selectedProjectId, setSelectedProjectId, cancelEditProject, updateProject, addProject]);

  useKeyboardShortcuts(shortcuts);

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: colors.text }}>Projects</h2>
      </div>

      <div
        style={{
          marginBottom: '1rem',
          padding: '1.5rem',
          background: colors.surface,
          borderRadius: '8px',
          border: editHighlight ? '2px solid #0070f3' : `1px solid ${colors.border}`,
          boxShadow: editHighlight ? '0 0 0 3px rgba(0,112,243,0.18)' : 'none',
          transition: 'border 0.15s ease, box-shadow 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto' }}>
            <label htmlFor={projectNameId} style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Project Name
            </label>
            <input
              id={projectNameId}
              name="projectName"
              type="text"
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (editingProjectId ? updateProject() : addProject(selectedProjectId, setSelectedProjectId))}
              maxLength={100}
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: `2px solid ${colors.borderLight}`,
                borderRadius: '4px',
                width: '400px',
                background: colors.inputBg,
                color: colors.text
              }}
            />
          </div>
          <div>
            <label htmlFor={projectFinishDateId} style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Finish Date <span style={{ fontWeight: 'normal' }}>(Optional)</span>
            </label>
            <input
              id={projectFinishDateId}
              name="projectFinishDate"
              type="date"
              value={projectFinishDate}
              className={projectFinishDate ? 'has-value' : ''}
              onChange={(e) => {
                setProjectFinishDate(e.target.value);
                setFinishDateError(''); // Clear error while typing
              }}
              onBlur={(e) => validateFinishDate(e.target.value)}
              min="2000-01-01"
              max="2050-12-31"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: finishDateError ? '2px solid #dc3545' : `2px solid ${colors.borderLight}`,
                borderRadius: '4px',
                width: '180px',
                background: colors.inputBg,
                color: colors.text
              }}
            />
            <div style={{ minHeight: '1rem', marginTop: '0.25rem' }}>
              {finishDateError ? (
                <div style={{ color: '#dc3545', fontSize: '0.75rem' }}>
                  {finishDateError}
                </div>
              ) : finishDateWarning && (
                <div style={{ color: '#d97706', fontSize: '0.75rem' }}>
                  ⚠ {finishDateWarning}
                </div>
              )}
            </div>
          </div>
          <div style={{ flex: '1 1 auto' }}>
            {/*
              <span> rather than <label>: WorkWeekSelector is a button-group
              custom control with its own aria-label, not a single form input
              that htmlFor can target. An orphan <label> would trigger the
              "Form field element should have an id or name attribute" /
              "No label associated with a form field" warning pair.
            */}
            <span style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Work Week <span style={{ fontWeight: 'normal' }}>(Optional Override)</span>
            </span>
            <WorkWeekSelector
              value={projectWorkDays}
              onChange={setProjectWorkDays}
              colors={colors}
              placeholder="Uses global default"
              allowReset={projectWorkDays !== undefined}
              onReset={() => setProjectWorkDays(undefined)}
              fallbackDays={globalWorkDays}
            />
          </div>
        </div>
        <div>
          {editingProjectId ? (
            <>
              <button
                onClick={updateProject}
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
                Update
              </button>
              <button
                onClick={cancelEditProject}
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
              onClick={() => addProject(selectedProjectId, setSelectedProjectId)}
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
              Add Project
            </button>
          )}
        </div>
      </div>

      {/*
        v19.0 — toolbar between the form card and the tile list. Export All hides
        when there are no projects; Import always renders so first-time users can
        bring data in. justifyContent: 'center' at zero projects so the lone
        Import button is centered rather than floating at the right edge.
      */}
      <div style={{
        display: 'flex',
        justifyContent: data.projects.length === 0 ? 'center' : 'flex-end',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      }}>
        {data.projects.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            onMouseEnter={() => setExportAllHover(true)}
            onMouseLeave={() => setExportAllHover(false)}
            onFocus={() => setExportAllHover(true)}
            onBlur={() => setExportAllHover(false)}
            aria-label="Export all projects as JSON"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              background: exportAllHover
                ? (resolvedTheme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5')
                : 'transparent',
              color: exportAllHover ? '#10b981' : '#9ca3af',
              border: `1px solid ${exportAllHover ? '#10b981' : 'transparent'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.9rem',
              transition: 'all 0.12s ease',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
                stroke={exportAllHover ? '#10b981' : '#9ca3af'}
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Export All
          </button>
        )}
        <label
          onMouseEnter={() => !applying && setImportHover(true)}
          onMouseLeave={() => setImportHover(false)}
          onFocus={() => !applying && setImportHover(true)}
          onBlur={() => setImportHover(false)}
          aria-label="Import projects from JSON"
          aria-disabled={applying}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.75rem',
            background: importHover && !applying
              ? (resolvedTheme === 'dark' ? 'rgba(0, 112, 243, 0.15)' : '#eff6ff')
              : 'transparent',
            color: importHover && !applying ? '#0070f3' : '#9ca3af',
            border: `1px solid ${importHover && !applying ? '#0070f3' : 'transparent'}`,
            borderRadius: '6px',
            cursor: applying ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontSize: '0.9rem',
            transition: 'all 0.12s ease',
            opacity: applying ? 0.5 : 1,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
              stroke={importHover && !applying ? '#0070f3' : '#9ca3af'}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Import
          <input
            type="file"
            name="importJson"
            accept=".json"
            disabled={applying}
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* v0.24.0 — Smart Import preview, rendered between toolbar and project list. */}
      {importPreview && (
        <ImportPreviewSection
          imported={importPreview.imported}
          conflicts={importPreview.conflicts}
          decisions={importPreview.decisions}
          mode={importPreview.mode}
          applying={applying}
          idPrefix={importIdPrefix}
          colors={colors}
          onModeChange={onModeChange}
          onDecisionChange={onDecisionChange}
          onConfirm={handleConfirmMerge}
          onRequestReplaceAll={openReplaceAllConfirm}
          onCancel={handleImportCancel}
        />
      )}

      {/* v0.24.0 — Result banner (success/error). Explicit dismiss, no auto-fade. */}
      {importBanner && (
        <div
          role={importBanner.kind === 'error' ? 'alert' : 'status'}
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: importBanner.kind === 'error'
              ? (resolvedTheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2')
              : (resolvedTheme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5'),
            border: `1px solid ${importBanner.kind === 'error' ? '#ef4444' : '#10b981'}`,
            borderRadius: '6px',
            color: colors.text,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span>{importBanner.text}</span>
          <button
            type="button"
            onClick={() => setImportBanner(null)}
            aria-label="Dismiss notification"
            style={{
              padding: '0.25rem 0.6rem',
              background: 'transparent',
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {data.projects.length === 0 ? (
        <p style={{ color: colors.textMuted, fontStyle: 'italic' }}>No projects yet. Add one to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.projects.map(project => {
            const projEffectiveWorkDays = getEffectiveWorkDays(project, globalWorkDays);
            const projFinishWarning = project.finishDate
              ? getWorkDayWarning(project.finishDate, projEffectiveWorkDays)
              : '';
            return (
            <div
              key={project.id}
              onDragOver={(e) => onProjectDragOver(e, project.id)}
              style={{
                padding: '0 1rem',
                background: tileHoverId === project.id
                  ? (resolvedTheme === 'dark' ? 'rgba(20, 184, 166, 0.10)' : '#f0fdfa')
                  : colors.surface,
                border: `2px solid ${colors.border}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'default',
                opacity: draggedProjectId === project.id ? 0.5 : 1,
                transition: 'background 0.12s ease, opacity 0.2s'
              }}
            >
              <div
                draggable
                onDragStart={(e) => {
                  // Use the parent tile as the drag image so the ghost shows the whole tile,
                  // not just the small 6-dot handle.
                  const tile = e.currentTarget.parentElement;
                  if (tile && e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setDragImage(tile, 12, tile.getBoundingClientRect().height / 2);
                  }
                  onProjectDragStart(project.id);
                }}
                onDragEnd={onProjectDragEnd}
                style={{ display: 'inline-flex', alignItems: 'center', cursor: 'grab' }}
                aria-label="Drag to reorder project"
                title="Drag to reorder"
              >
                <DragHandle />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setActiveTab('releases');
                }}
                onMouseEnter={() => setTileHoverId(project.id)}
                onMouseLeave={() => setTileHoverId(prev => prev === project.id ? null : prev)}
                onFocus={() => setTileHoverId(project.id)}
                onBlur={() => setTileHoverId(prev => prev === project.id ? null : prev)}
                aria-label={`Open releases for ${project.name}`}
                title="Open releases"
                style={{
                  flex: 1,
                  minWidth: 0,
                  alignSelf: 'stretch',
                  display: 'flex',
                  alignItems: 'center',
                  textAlign: 'left',
                  padding: '1rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit'
                }}
              >
                <strong style={{ fontSize: '1.1rem', color: colors.text }}>{project.name}</strong>
                <span style={{ marginLeft: '1rem', color: colors.textMuted, fontSize: '0.9rem' }}>
                  ({data.releases.filter(r => r.projectId === project.id).length} releases
                  {project.finishDate && (
                    <>, finish: {formatDateMDY(project.finishDate)}
                      {projFinishWarning && (
                        <span title={projFinishWarning} style={{ color: '#d97706', marginLeft: '0.25rem' }}>⚠</span>
                      )}
                    </>
                  )}
                  {project.workDays && project.workDays.length > 0 && `, custom work week`})
                </span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 'calc(18px + 0.7rem)',
                      height: 'calc(18px + 0.7rem)',
                      flexShrink: 0
                    }}
                  >
                    {isCloudMode && user && project.owner === user.uid && (
                      <ShareIconButton
                        onClick={() => setShareProjectId(project.id)}
                        ariaLabel="Share project"
                        title="Share project"
                      />
                    )}
                  </div>
                  <div
                    aria-hidden="true"
                    style={{
                      width: '1px',
                      height: '20px',
                      background: colors.border,
                      margin: '0 4px',
                      flexShrink: 0
                    }}
                  />
                  <ExportIconButton
                    onClick={() => handleExportProject(project.id)}
                    ariaLabel="Export project"
                    title="Export project"
                  />
                  <PencilIconButton
                    onClick={() => handleEditProject(project)}
                    ariaLabel="Edit project"
                    title="Edit project"
                  />
                  <CloneIconButton
                    onClick={() => {
                      // v0.28.10 backstop — see pages/index.tsx.
                      cloneProject(project.id)
                        .catch(err => console.error('Clone project failed:', err));
                    }}
                    ariaLabel="Clone project"
                    title="Clone project"
                  />
                  <TrashIconButton
                    onClick={() => setDeleteConfirmProjectId(project.id)}
                    ariaLabel="Delete project"
                    title="Delete project"
                  />
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Share dialog (cloud mode only) */}
      {shareProjectId && isCloudMode && (() => {
        const project = data.projects.find(p => p.id === shareProjectId);
        return project ? (
          <ShareDialog
            projectId={shareProjectId}
            projectName={project.name}
            cloudStorage={storage as CloudGanttStorageService}
            onClose={() => setShareProjectId(null)}
          />
        ) : null;
      })()}

      {/* Delete project confirmation modal */}
      {deleteConfirmProjectId && (() => {
        const project = data.projects.find(p => p.id === deleteConfirmProjectId);
        return project ? (
          <ConfirmDialog
            modal
            title="Delete Project"
            message={`Delete project "${project.name}"? This will also delete all its releases.`}
            colors={colors}
            buttons={[
              {
                label: 'Cancel',
                variant: 'secondary',
                onClick: () => setDeleteConfirmProjectId(null),
              },
              {
                label: 'Delete',
                variant: 'danger',
                onClick: () => {
                  // v0.28.10 backstop — see pages/index.tsx.
                  deleteProject(deleteConfirmProjectId, selectedProjectId, setSelectedProjectId)
                    .catch(err => console.error('Delete project failed:', err));
                  setDeleteConfirmProjectId(null);
                },
              },
            ]}
          />
        ) : null;
      })()}

      {/* v0.24.0 — Replace-All confirmation modal. Gated on replaceAllPending &&
          importPreview !== null so it can never render without an active preview. */}
      {replaceAllPending && importPreview && (
        <ConfirmDialog
          modal
          title="Replace All Data"
          message="This will replace all existing projects, releases, snapshots, and settings with the contents of this file. This cannot be undone. Export your current data first if you want to keep it."
          colors={colors}
          buttons={[
            {
              label: 'Cancel',
              variant: 'secondary',
              onClick: cancelReplaceAllConfirm,
            },
            {
              label: 'Replace',
              variant: 'danger',
              onClick: handleConfirmReplaceAll,
            },
          ]}
        />
      )}
    </div>
  );
}
