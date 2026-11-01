// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Projects Tab: the toolbar, the grid of project tiles, and the project dialog

import { useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, RefObject } from 'react';
import { useProjects } from './useProjects';
import { ShareDialog } from './ShareDialog';
import { ProjectDialog } from './ProjectDialog';
import { ProjectTile } from './ProjectTile';
import { projectsTabPalette, paletteStyle, patchedColors } from './projectsTabPalette';
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
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { TabType, Snapshot, Project } from '../../shared/types';
import type { ThemeColors } from '../../shared/utils/theme';
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
  /** Told what Load Sample added, after it has opened the Gantt Chart tab. */
  onSampleLoaded?: (message: string) => void;
}

type DialogState = { mode: 'new' } | { mode: 'edit'; projectId: string } | null;

/** Where focus goes once the tiles have re-rendered. */
type PendingFocus =
  | { kind: 'open'; projectId: string }
  | { kind: 'delete'; projectId: string }
  | { kind: 'move'; projectId: string; direction: 'earlier' | 'later' }
  | { kind: 'new' };

const ICON_PATHS = {
  export: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  import: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  sample: 'M9 3h6M10 3v6.5L4.6 18.8A1.5 1.5 0 0 0 5.9 21h12.2a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3M7.2 15h9.6',
  plus: 'M12 5v14M5 12h14',
} as const;

function ToolbarIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface ToolbarProps {
  hasProjects: boolean;
  applying: boolean;
  newProjectRef: RefObject<HTMLButtonElement | null>;
  onExportAll: () => void;
  onImport: (e: ChangeEvent<HTMLInputElement>) => void;
  onLoadSample: () => void;
  onNewProject: () => void;
}

// Export All · Import · Load Sample · New Project. Import stays a <label>
// around a visually hidden file input, so the native picker opens on a click
// and keyboard users can still reach the input.
function ProjectsToolbar({
  hasProjects, applying, newProjectRef, onExportAll, onImport, onLoadSample, onNewProject,
}: ToolbarProps) {
  return (
    <div className="pt-toolbar">
      {hasProjects && (
        <button type="button" className="pt-btn" onClick={onExportAll} aria-label="Export all projects as JSON">
          <ToolbarIcon d={ICON_PATHS.export} />
          Export All
        </button>
      )}
      <label className="pt-btn" aria-label="Import projects from JSON" aria-disabled={applying}>
        <ToolbarIcon d={ICON_PATHS.import} />
        Import
        <input
          type="file"
          name="importJson"
          accept=".json"
          className="pt-sr-only"
          disabled={applying}
          onChange={onImport}
        />
      </label>
      <button type="button" className="pt-btn" onClick={onLoadSample}>
        <ToolbarIcon d={ICON_PATHS.sample} />
        Load Sample
      </button>
      <button type="button" ref={newProjectRef} className="pt-btn pt-btn-primary" onClick={onNewProject}>
        <ToolbarIcon d={ICON_PATHS.plus} />
        New Project
      </button>
    </div>
  );
}

interface ImportBannerProps {
  kind: 'error' | 'success';
  text: string;
  dark: boolean;
  colors: ThemeColors;
  onDismiss: () => void;
}

// v0.24.0 — the import result banner (success/error). Explicit dismiss, no auto-fade.
function ImportResultBanner({ kind, text, dark, colors, onDismiss }: ImportBannerProps) {
  const isError = kind === 'error';
  const tint = isError
    ? (dark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2')
    : (dark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5');
  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        background: tint,
        border: `1px solid ${isError ? '#ef4444' : '#10b981'}`,
        borderRadius: '6px',
        color: colors.text,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <span>{text}</span>
      <button
        type="button"
        onClick={onDismiss}
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
  );
}

/** The element a pending focus names, if it is on screen and can take focus. */
function focusTarget(root: HTMLElement, pending: PendingFocus, newProject: HTMLElement | null): HTMLElement | null {
  if (pending.kind === 'new') return newProject;
  const tile = root.querySelector(`[data-project-tile="${pending.projectId}"]`);
  if (!tile) return null;
  if (pending.kind === 'open') return tile.querySelector<HTMLElement>('.pt-open');
  if (pending.kind === 'delete') return tile.querySelector<HTMLElement>('button[aria-label="Delete project"]');
  // The pressed Move button keeps focus; at an end it is disabled, so its partner takes it.
  const pressed = tile.querySelector<HTMLButtonElement>(`button[data-move="${pending.direction}"]`);
  if (pressed && !pressed.disabled) return pressed;
  const partner = pending.direction === 'earlier' ? 'later' : 'earlier';
  return tile.querySelector<HTMLElement>(`button[data-move="${partner}"]`);
}

/** Where focus goes after a delete: the next tile, else the previous, else New Project. */
function focusAfterDelete(projects: Project[], deletedId: string): PendingFocus {
  const i = projects.findIndex(p => p.id === deletedId);
  const neighbour = projects[i + 1] ?? projects[i - 1];
  return neighbour ? { kind: 'open', projectId: neighbour.id } : { kind: 'new' };
}

export function ProjectsTab({
  selectedProjectId,
  setSelectedProjectId,
  setActiveTab,
  draggedProjectId,
  onProjectDragStart,
  onProjectDragOver,
  onProjectDragEnd,
  onReplaceSnapshots,
  onSampleLoaded,
}: ProjectsTabProps) {
  const { data, updateData, globalWorkDays, loading: appDataLoading } = useAppData();
  const { colors, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const { storage } = useStorage();
  const baseFieldId = useId();
  const importIdPrefix = `${baseFieldId}-import`;
  const headingId = `${baseFieldId}-heading`;
  const palette = projectsTabPalette(resolvedTheme);
  const tabColors = patchedColors(colors, palette);
  const rootRef = useRef<HTMLDivElement>(null);
  const newProjectRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<PendingFocus | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null);
  const [moveStatus, setMoveStatus] = useState('');
  const isCloudMode = storage.mode === 'cloud';
  const isOwner = (project: Project) => Boolean(user && project.owner === user.uid);
  const {
    projectName,
    setProjectName,
    projectFinishDate,
    setProjectFinishDate,
    projectWorkDays,
    setProjectWorkDays,
    addProject,
    addSampleProject,
    updateProject,
    deleteProject,
    startEditProject,
    cancelEditProject,
    cloneProject
  } = useProjects();

  // Focus moves the tiles cannot make themselves: after a delete or a move,
  // once the list has re-rendered.
  useEffect(() => {
    const pending = pendingFocusRef.current;
    const root = rootRef.current;
    if (!pending || !root) return;
    pendingFocusRef.current = null;
    focusTarget(root, pending, newProjectRef.current)?.focus();
  });

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
  // Known limitation; do not lift state up to compensate. The state-machine spec
  // is the APPLYING Contract section of ARCHITECTURE.md.
  const {
    importPreview,
    importBanner,
    replaceAllPending,
    applying,
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
    ownerUid: isCloudMode ? user?.uid : undefined,
  });

  const openNewProject = () => {
    cancelEditProject(); // start from an empty draft
    setDialog({ mode: 'new' });
  };

  const openEditProject = (project: Project) => {
    startEditProject(project);
    setDialog({ mode: 'edit', projectId: project.id });
  };

  const closeDialog = () => {
    cancelEditProject();
    setDialog(null);
  };

  const saveDialog = () => {
    if (dialog?.mode === 'edit') updateProject();
    else addProject(selectedProjectId, setSelectedProjectId);
    setDialog(null);
  };

  const dialogOpener = (): HTMLElement | null => {
    if (dialog?.mode === 'edit') {
      const edit = rootRef.current?.querySelector<HTMLElement>(
        `[data-project-tile="${dialog.projectId}"] button[aria-label="Edit project"]`,
      );
      if (edit) return edit;
    }
    return newProjectRef.current;
  };

  // A reorder rearranges the whole project list by id, never a filtered subset.
  const moveProject = (projectId: string, direction: -1 | 1) => {
    const from = data.projects.findIndex(p => p.id === projectId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= data.projects.length) return;
    const projects = [...data.projects];
    [projects[from], projects[to]] = [projects[to], projects[from]];
    updateData({ ...data, projects });
    pendingFocusRef.current = { kind: 'move', projectId, direction: direction < 0 ? 'earlier' : 'later' };
    setMoveStatus(`"${projects[to].name}" moved to position ${to + 1} of ${projects.length}.`);
  };

  const confirmDelete = (projectId: string) => {
    // A refused delete (nothing can be saved) leaves the project; focus goes back to its Delete.
    pendingFocusRef.current = storage.canWrite()
      ? focusAfterDelete(data.projects, projectId)
      : { kind: 'delete', projectId };
    // v0.28.10 backstop — see pages/index.tsx.
    deleteProject(projectId, selectedProjectId, setSelectedProjectId)
      .catch(err => console.error('Delete project failed:', err));
    setDeleteConfirmProjectId(null);
  };

  const loadSample = () => {
    const sample = addSampleProject();
    setSelectedProjectId(sample.id);
    setActiveTab('chart');
    onSampleLoaded?.(`Added "${sample.name}" at the end of the project list and opened it on the Gantt Chart tab.`);
  };

  const deleteTarget = deleteConfirmProjectId
    ? data.projects.find(p => p.id === deleteConfirmProjectId)
    : undefined;
  const shareTarget = shareProjectId && isCloudMode
    ? data.projects.find(p => p.id === shareProjectId)
    : undefined;

  return (
    <div ref={rootRef} className="pt-root" style={paletteStyle(palette)}>
      <div className="pt-head">
        <h2 id={headingId}>Projects</h2>
        <ProjectsToolbar
          hasProjects={data.projects.length > 0}
          applying={applying}
          newProjectRef={newProjectRef}
          onExportAll={handleExport}
          onImport={handleImport}
          onLoadSample={loadSample}
          onNewProject={openNewProject}
        />
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
          colors={tabColors}
          noteColor={palette.note}
          onModeChange={onModeChange}
          onDecisionChange={onDecisionChange}
          onConfirm={handleConfirmMerge}
          onRequestReplaceAll={openReplaceAllConfirm}
          onCancel={handleImportCancel}
          dismissalSuppressed={replaceAllPending}
        />
      )}

      {importBanner && (
        <ImportResultBanner
          kind={importBanner.kind}
          text={importBanner.text}
          dark={resolvedTheme === 'dark'}
          colors={tabColors}
          onDismiss={() => setImportBanner(null)}
        />
      )}

      <p className="pt-sr-only" aria-live="polite" aria-atomic="true">{moveStatus}</p>

      {data.projects.length === 0 ? (
        <p className="pt-empty">No projects yet.</p>
      ) : (
        <div className="pt-area">
          <ul className="pt-grid" aria-labelledby={headingId}>
            {data.projects.map((project, index) => (
              <ProjectTile
                key={project.id}
                project={project}
                index={index}
                count={data.projects.length}
                releaseCount={data.releases.filter(r => r.projectId === project.id).length}
                globalWorkDays={globalWorkDays}
                // In cloud mode only the owner may delete or share a project.
                canDelete={!isCloudMode || isOwner(project)}
                canShare={isCloudMode && isOwner(project)}
                dragging={draggedProjectId === project.id}
                onOpen={() => {
                  setSelectedProjectId(project.id);
                  setActiveTab('releases');
                }}
                onDelete={() => setDeleteConfirmProjectId(project.id)}
                onShare={() => setShareProjectId(project.id)}
                onExport={() => handleExportProject(project.id)}
                onEdit={() => openEditProject(project)}
                onClone={() => {
                  // v0.28.10 backstop — see pages/index.tsx.
                  cloneProject(project.id)
                    .catch(err => console.error('Clone project failed:', err));
                }}
                onMove={(direction) => moveProject(project.id, direction)}
                onDragStart={() => onProjectDragStart(project.id)}
                onDragOver={(e) => onProjectDragOver(e, project.id)}
                onDragEnd={onProjectDragEnd}
              />
            ))}
          </ul>
        </div>
      )}

      {dialog && (
        <ProjectDialog
          mode={dialog.mode}
          name={projectName}
          onNameChange={setProjectName}
          finishDate={projectFinishDate}
          onFinishDateChange={setProjectFinishDate}
          workDays={projectWorkDays}
          onWorkDaysChange={setProjectWorkDays}
          globalWorkDays={globalWorkDays}
          onSave={saveDialog}
          onCancel={closeDialog}
          returnFocusTo={dialogOpener}
          colors={colors}
          palette={palette}
        />
      )}

      {/* Share dialog (cloud mode only) */}
      {shareProjectId && shareTarget && (
        <ShareDialog
          projectId={shareProjectId}
          projectName={shareTarget.name}
          cloudStorage={storage as CloudGanttStorageService}
          onClose={() => setShareProjectId(null)}
        />
      )}

      {/* Delete project confirmation modal */}
      {deleteTarget && (
        <ConfirmDialog
          modal
          title="Delete Project"
          message={`Delete project "${deleteTarget.name}"? This will also delete all its releases.`}
          colors={tabColors}
          buttons={[
            {
              label: 'Cancel',
              variant: 'secondary',
              onClick: () => setDeleteConfirmProjectId(null),
            },
            {
              label: 'Delete',
              variant: 'danger',
              onClick: () => confirmDelete(deleteTarget.id),
            },
          ]}
        />
      )}

      {/* v0.24.0 — Replace-All confirmation modal. Gated on replaceAllPending &&
          importPreview !== null so it can never render without an active preview. */}
      {replaceAllPending && importPreview && (
        <ConfirmDialog
          modal
          onEscape={cancelReplaceAllConfirm}
          title="Replace All Data"
          message="This will replace all existing projects, releases, snapshots, and settings with the contents of this file. This cannot be undone. Export your current data first if you want to keep it."
          colors={tabColors}
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
