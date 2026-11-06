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
  isProjectArchived,
  moveAmongShown,
  projectPrefOf,
  shownProjects,
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
  /** `shownIds`: the tiles on screen, in order. A drag moves among those, past any hidden project. */
  onProjectDragOver: (e: React.DragEvent, id: string, shownIds: string[]) => void;
  onProjectDragEnd: () => void;
  onReplaceSnapshots: (snapshots: Snapshot[]) => Promise<void>;
  /** Told what Load Sample added, after it has opened the Gantt Chart tab. */
  onSampleLoaded?: (message: string) => void;
  /** Says something after this tab has gone: its own status region goes with it. */
  onAnnounce?: (message: string) => void;
}

type DialogState = { mode: 'new' } | { mode: 'edit'; projectId: string } | null;

/** Where focus goes once the tiles have re-rendered. */
type PendingFocus =
  | { kind: 'open'; projectId: string }
  | { kind: 'icon'; projectId: string; label: 'Delete project' | 'Archive project' | 'Unarchive project' }
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
  if (pending.kind === 'icon') return tile.querySelector<HTMLElement>(`button[aria-label="${pending.label}"]`);
  // The pressed Move button keeps focus; at an end it is disabled, so its partner takes it.
  const pressed = tile.querySelector<HTMLButtonElement>(`button[data-move="${pending.direction}"]`);
  if (pressed && !pressed.disabled) return pressed;
  const partner = pending.direction === 'earlier' ? 'later' : 'earlier';
  return tile.querySelector<HTMLElement>(`button[data-move="${partner}"]`);
}

/** Where focus goes when a tile leaves: the next shown tile, else the previous, else New Project. */
function focusAfterTileLeaves(shown: Project[], leavingId: string): PendingFocus {
  const i = shown.findIndex(p => p.id === leavingId);
  const neighbour = shown[i + 1] ?? shown[i - 1];
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
  onAnnounce,
}: ProjectsTabProps) {
  const { data, updateData, globalWorkDays, loading: appDataLoading } = useAppData();
  const { colors, resolvedTheme } = useTheme();
  const { user } = useAuth();
  const { storage } = useStorage();
  const baseFieldId = useId();
  const importIdPrefix = `${baseFieldId}-import`;
  const headingId = `${baseFieldId}-heading`;
  const showArchivedId = `${baseFieldId}-show-archived`;
  const palette = projectsTabPalette(resolvedTheme);
  const tabColors = patchedColors(colors, palette);
  const rootRef = useRef<HTMLDivElement>(null);
  const newProjectRef = useRef<HTMLButtonElement>(null);
  const pendingFocusRef = useRef<PendingFocus | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [colorPopoverFor, setColorPopoverFor] = useState<string | null>(null);
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
    cloneProject,
    setProjectColor,
    setProjectArchived
  } = useProjects();

  const prefs = data.projectPrefs;
  const archivedCount = data.projects.filter(p => isProjectArchived(prefs, p.id)).length;
  if (showArchived && archivedCount === 0) setShowArchived(false);
  // What this person sees. Reordering, focus and counts on this tab read this
  // list; a save always gets the full one.
  const shown = shownProjects(data.projects, prefs, showArchived);

  // A dialog takes over, or the tile has gone: the popover must not come back with it.
  const dialogOpen = Boolean(dialog || shareProjectId || deleteConfirmProjectId);
  if (colorPopoverFor && (dialogOpen || !shown.some(p => p.id === colorPopoverFor))) {
    setColorPopoverFor(null);
  }

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

  // A reorder moves a tile among the shown ones and saves the whole list; a
  // hidden project keeps its slot.
  const moveProject = (project: Project, direction: -1 | 1) => {
    const shownIds = shown.map(p => p.id);
    const to = shownIds.indexOf(project.id) + direction;
    const projects = moveAmongShown(data.projects, shownIds, project.id, to);
    if (projects === data.projects) return;
    setColorPopoverFor(null);
    updateData({ ...data, projects });
    pendingFocusRef.current = { kind: 'move', projectId: project.id, direction: direction < 0 ? 'earlier' : 'later' };
    setStatus(`"${project.name}" moved to position ${to + 1} of ${shownIds.length}.`);
  };

  const openProject = (project: Project) => {
    if (isProjectArchived(prefs, project.id)) {
      if (!setProjectArchived(project.id, false)) return;
      onAnnounce?.(`Unarchived "${project.name}" and opened its releases.`);
    }
    setSelectedProjectId(project.id);
    setActiveTab('releases');
  };

  const archiveProject = (project: Project) => {
    if (!setProjectArchived(project.id, true)) return;
    setColorPopoverFor(null);
    if (showArchived) {
      pendingFocusRef.current = { kind: 'icon', projectId: project.id, label: 'Unarchive project' };
      setStatus(`Archived "${project.name}".`);
      return;
    }
    pendingFocusRef.current = focusAfterTileLeaves(shown, project.id);
    setStatus(`Archived "${project.name}". Show archived (${archivedCount + 1}) lists it.`);
  };

  const unarchiveProject = (project: Project) => {
    if (!setProjectArchived(project.id, false)) return;
    pendingFocusRef.current = { kind: 'icon', projectId: project.id, label: 'Archive project' };
    setStatus(`Unarchived "${project.name}".`);
  };

  const confirmDelete = (projectId: string) => {
    // A refused delete (nothing can be saved) leaves the project; focus goes back to its Delete.
    pendingFocusRef.current = storage.canWrite()
      ? focusAfterTileLeaves(shown, projectId)
      : { kind: 'icon', projectId, label: 'Delete project' };
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

      {archivedCount > 0 && (
        <div className="pt-filter">
          <label className="pt-check" htmlFor={showArchivedId}>
            <input
              type="checkbox"
              id={showArchivedId}
              name="showArchived"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived ({archivedCount})
          </label>
        </div>
      )}

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

      <p className="pt-sr-only" aria-live="polite" aria-atomic="true">{status}</p>

      {data.projects.length === 0 && <p className="pt-empty">No projects yet.</p>}
      {data.projects.length > 0 && shown.length === 0 && (
        <p className="pt-empty">{`All projects are archived. Select "Show archived (${archivedCount})" to see them.`}</p>
      )}
      {shown.length > 0 && (
        <div className="pt-area">
          <ul className="pt-grid" aria-labelledby={headingId}>
            {shown.map((project, index) => (
              <ProjectTile
                key={project.id}
                project={project}
                index={index}
                count={shown.length}
                releaseCount={data.releases.filter(r => r.projectId === project.id).length}
                globalWorkDays={globalWorkDays}
                color={projectPrefOf(prefs, project.id).color}
                archived={isProjectArchived(prefs, project.id)}
                colorOpen={colorPopoverFor === project.id}
                // In cloud mode only the owner may delete or share a project.
                canDelete={!isCloudMode || isOwner(project)}
                canShare={isCloudMode && isOwner(project)}
                dragging={draggedProjectId === project.id}
                onOpen={() => openProject(project)}
                onDelete={() => setDeleteConfirmProjectId(project.id)}
                onShare={() => setShareProjectId(project.id)}
                onExport={() => handleExportProject(project.id)}
                onEdit={() => openEditProject(project)}
                onClone={() => {
                  // v0.28.10 backstop — see pages/index.tsx.
                  cloneProject(project.id)
                    .catch(err => console.error('Clone project failed:', err));
                }}
                onArchive={() => archiveProject(project)}
                onUnarchive={() => unarchiveProject(project)}
                onColorOpenChange={(open) => {
                  // Closing one popover never closes another that has opened since.
                  setColorPopoverFor(current => {
                    if (open) return project.id;
                    return current === project.id ? null : current;
                  });
                }}
                onPickColor={(color) => setProjectColor(project.id, color)}
                onMove={(direction) => moveProject(project, direction)}
                onDragStart={() => onProjectDragStart(project.id)}
                onDragOver={(e) => onProjectDragOver(e, project.id, shown.map(p => p.id))}
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
