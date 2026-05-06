// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Projects Tab component with form and list

import { useState, useMemo, useRef, useId } from 'react';
import { useProjects } from './useProjects';
import { ShareDialog } from './ShareDialog';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import {
  exportData as exportDataUtil,
  exportSingleProject,
  mergeImportedProjects,
  parseImportedData,
  readFileAsText,
} from '../../shared/utils';
import { isProjectNameValid, getWorkDayWarning, getEffectiveWorkDays } from '../../shared/utils';
import { formatDateMDY } from '../../shared/utils';
import { DragHandle } from '../../shared/components/DragHandle';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { TrashIconButton } from '../../shared/components/TrashIconButton';
import { PencilIconButton } from '../../shared/components/PencilIconButton';
import { ExportIconButton } from '../../shared/components/ExportIconButton';
import { CloneIconButton } from '../../shared/components/CloneIconButton';
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
  const { data, updateData, globalWorkDays } = useAppData();
  const { colors, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const { storage } = useStorage();
  const baseFieldId = useId();
  const projectNameId = `${baseFieldId}-project-name`;
  const projectFinishDateId = `${baseFieldId}-project-finish-date`;
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null);
  const [exportAllHover, setExportAllHover] = useState(false);
  const [importHover, setImportHover] = useState(false);
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importConfirm, setImportConfirm] = useState<{ imported: ReturnType<typeof parseImportedData> } | null>(null);
  // v19.0 — additive merge confirmation (separate from the replace-all `importConfirm`).
  const [importMergeConfirm, setImportMergeConfirm] = useState<{
    imported: NonNullable<ReturnType<typeof parseImportedData>>;
  } | null>(null);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const imported = parseImportedData(content);

      if (!imported) {
        alert('Invalid file format');
        event.target.value = '';
        return;
      }

      // v19.0 — route by _exportType discriminator. Replace-all dialog for
      // 'ganttapp-all-projects' or 'legacy'; additive merge for 'ganttapp-project-export'.
      fileInputRef.current = event.target;
      const isReplaceAll =
        imported.exportType === 'ganttapp-all-projects' ||
        imported.exportType === 'legacy';

      if (isReplaceAll) {
        const hasExistingData = data.projects.length > 0 || data.releases.length > 0;
        if (hasExistingData) {
          setImportConfirm({ imported });
          return;
        }
        applyImport(imported, event.target);
      } else {
        // 'ganttapp-project-export' → additive merge
        setImportMergeConfirm({ imported });
      }
    } catch (error) {
      alert('Error importing file');
      console.error('Error importing file:', error instanceof Error ? error.message : 'Unknown error');
      event.target.value = '';
    }
  };

  const applyImport = async (imported: NonNullable<ReturnType<typeof parseImportedData>>, fileInput: HTMLInputElement) => {
    updateData(imported.appData);
    await onReplaceSnapshots(imported.snapshots ?? []);
    if (imported.appData.projects.length > 0) {
      setSelectedProjectId(imported.appData.projects[0].id);
    }
    const snapshotMsg = imported.snapshots ? ` (including ${imported.snapshots.length} snapshot${imported.snapshots.length !== 1 ? 's' : ''})` : '';
    alert(`Data imported successfully!${snapshotMsg}`);
    fileInput.value = '';
  };

  // v19.0 — additive merge import path. Skips projects whose ID collides with existing,
  // reports the count to the user. Releases and snapshots filtered to accepted projects.
  const applyMergeImport = async (
    incoming: NonNullable<ReturnType<typeof parseImportedData>>,
    fileInput: HTMLInputElement
  ) => {
    const existingSnapshots = await storage.loadSnapshots();
    const { mergedData, mergedSnapshots, skipped } = mergeImportedProjects(
      data,
      incoming,
      existingSnapshots
    );
    updateData(mergedData);
    await onReplaceSnapshots(mergedSnapshots);
    const added = incoming.appData.projects.length - skipped;
    const skipMsg = skipped > 0
      ? ` (${skipped} project${skipped !== 1 ? 's' : ''} skipped — already existed)`
      : '';
    alert(`${added} project${added !== 1 ? 's' : ''} added successfully.${skipMsg}`);
    fileInput.value = '';
  };

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
          onMouseEnter={() => setImportHover(true)}
          onMouseLeave={() => setImportHover(false)}
          onFocus={() => setImportHover(true)}
          onBlur={() => setImportHover(false)}
          aria-label="Import projects from JSON"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.75rem',
            background: importHover
              ? (resolvedTheme === 'dark' ? 'rgba(0, 112, 243, 0.15)' : '#eff6ff')
              : 'transparent',
            color: importHover ? '#0070f3' : '#9ca3af',
            border: `1px solid ${importHover ? '#0070f3' : 'transparent'}`,
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
              d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
              stroke={importHover ? '#0070f3' : '#9ca3af'}
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
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </label>
      </div>

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
              draggable
              onDragStart={() => onProjectDragStart(project.id)}
              onDragOver={(e) => onProjectDragOver(e, project.id)}
              onDragEnd={onProjectDragEnd}
              style={{
                padding: '1rem',
                background: colors.surface,
                border: `2px solid ${colors.border}`,
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: draggedProjectId === project.id ? 'grabbing' : 'grab',
                opacity: draggedProjectId === project.id ? 0.5 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <DragHandle />
                <div>
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
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setActiveTab('releases');
                  }}
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
                  View Releases
                </button>
                {isCloudMode && user && project.owner === user.uid && (
                  <button
                    onClick={() => setShareProjectId(project.id)}
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
                    Share
                  </button>
                )}
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
                  onClick={() => cloneProject(project.id)}
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
                  deleteProject(deleteConfirmProjectId, selectedProjectId, setSelectedProjectId);
                  setDeleteConfirmProjectId(null);
                },
              },
            ]}
          />
        ) : null;
      })()}

      {/* Import confirmation modal */}
      {importConfirm && (
        <ConfirmDialog
          modal
          title="Replace All Data"
          message="This will replace all existing projects, releases, snapshots, and settings with the contents of this file. This cannot be undone. Export your current data first if you want to keep it."
          colors={colors}
          buttons={[
            {
              label: 'Cancel',
              variant: 'secondary',
              onClick: () => {
                setImportConfirm(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              },
            },
            {
              label: 'Replace',
              variant: 'danger',
              onClick: () => {
                applyImport(importConfirm.imported!, fileInputRef.current!);
                setImportConfirm(null);
              },
            },
          ]}
        />
      )}

      {/* v19.0 — additive merge import confirmation modal */}
      {importMergeConfirm && (
        <ConfirmDialog
          modal
          title="Add Projects to Workspace"
          message={`Add ${importMergeConfirm.imported.appData.projects.length} project${importMergeConfirm.imported.appData.projects.length !== 1 ? 's' : ''} from this file to your existing workspace? Projects that already exist will be skipped.`}
          colors={colors}
          buttons={[
            {
              label: 'Cancel',
              variant: 'secondary',
              onClick: () => {
                setImportMergeConfirm(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              },
            },
            {
              label: 'Add Projects',
              variant: 'primary',
              onClick: () => {
                applyMergeImport(importMergeConfirm.imported, fileInputRef.current!);
                setImportMergeConfirm(null);
              },
            },
          ]}
        />
      )}
    </div>
  );
}
