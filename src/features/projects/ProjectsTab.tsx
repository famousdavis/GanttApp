// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Projects Tab component with form and list

import { useState, useMemo } from 'react';
import { useProjects } from './useProjects';
import { ShareDialog } from './ShareDialog';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { exportData as exportDataUtil, parseImportedData, readFileAsText } from '../../shared/utils';
import { isProjectNameValid } from '../../shared/utils';
import { formatDateMDY } from '../../shared/utils';
import { DragHandle } from '../../shared/components/DragHandle';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { TabType } from '../../shared/types';
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
}

export function ProjectsTab({
  selectedProjectId,
  setSelectedProjectId,
  setActiveTab,
  draggedProjectId,
  onProjectDragStart,
  onProjectDragOver,
  onProjectDragEnd
}: ProjectsTabProps) {
  const { data, updateData } = useAppData();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { storage } = useStorage();
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const isCloudMode = storage.mode === 'cloud';
  const {
    projectName,
    setProjectName,
    projectFinishDate,
    setProjectFinishDate,
    editingProjectId,
    addProject,
    updateProject,
    deleteProject,
    startEditProject,
    cancelEditProject
  } = useProjects();

  const handleExport = async () => {
    const allSnapshots = await storage.loadSnapshots();
    exportDataUtil(data, allSnapshots, {
      storageMode: storage.mode,
      uid: user?.uid,
    });
  };

  const [importConfirm, setImportConfirm] = useState<{ imported: ReturnType<typeof parseImportedData>; fileInput: HTMLInputElement } | null>(null);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const imported = parseImportedData(content);

      if (imported) {
        const hasExistingData = data.projects.length > 0 || data.releases.length > 0;
        if (hasExistingData) {
          setImportConfirm({ imported, fileInput: event.target });
          return;
        }
        applyImport(imported, event.target);
      } else {
        alert('Invalid file format');
        event.target.value = '';
      }
    } catch (error) {
      alert('Error importing file');
      console.error(error);
      event.target.value = '';
    }
  };

  const applyImport = async (imported: NonNullable<ReturnType<typeof parseImportedData>>, fileInput: HTMLInputElement) => {
    updateData(imported.appData);
    if (imported.snapshots && imported.snapshots.length > 0) {
      await storage.saveSnapshots(imported.snapshots);
    }
    if (imported.appData.projects.length > 0) {
      setSelectedProjectId(imported.appData.projects[0].id);
    }
    const snapshotMsg = imported.snapshots ? ` (including ${imported.snapshots.length} snapshot${imported.snapshots.length !== 1 ? 's' : ''})` : '';
    alert(`Data imported successfully!${snapshotMsg}`);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: colors.text }}>Projects</h2>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleExport}
            disabled={data.projects.length === 0}
            style={{
              padding: '0.5rem 1rem',
              background: colors.buttonBg,
              color: data.projects.length === 0 ? colors.textMuted : colors.text,
              border: `1px solid ${colors.buttonBorder}`,
              borderRadius: '4px',
              cursor: data.projects.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              opacity: data.projects.length === 0 ? 0.5 : 1
            }}
          >
            📥 Export
          </button>
          <label style={{
            padding: '0.5rem 1rem',
            background: colors.buttonBg,
            color: colors.text,
            border: `1px solid ${colors.buttonBorder}`,
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}>
            📤 Import
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '2rem', padding: '1.5rem', background: colors.surface, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Project Name
            </label>
            <input
              type="text"
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (editingProjectId ? updateProject() : addProject(selectedProjectId, setSelectedProjectId))}
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
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: colors.textSecondary }}>
              Project Finish Date (Optional)
            </label>
            <input
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
            <div style={{ height: '1rem', marginTop: '0.25rem' }}>
              {finishDateError && (
                <div style={{ color: '#dc3545', fontSize: '0.75rem' }}>
                  {finishDateError}
                </div>
              )}
            </div>
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

      {data.projects.length === 0 ? (
        <p style={{ color: colors.textMuted, fontStyle: 'italic' }}>No projects yet. Add one to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.projects.map(project => (
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
                    {project.finishDate && `, finish: ${formatDateMDY(project.finishDate)}`})
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
                <button
                  onClick={() => startEditProject(project)}
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
                    if (confirm(`Delete project "${project.name}"? This will also delete all its releases.`)) {
                      deleteProject(project.id, selectedProjectId, setSelectedProjectId);
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
                importConfirm.fileInput.value = '';
                setImportConfirm(null);
              },
            },
            {
              label: 'Replace',
              variant: 'danger',
              onClick: () => {
                applyImport(importConfirm.imported!, importConfirm.fileInput);
                setImportConfirm(null);
              },
            },
          ]}
        />
      )}
    </div>
  );
}
