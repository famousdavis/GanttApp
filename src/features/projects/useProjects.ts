// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Projects CRUD operations hook

import { useState } from 'react';
import { Project } from '../../shared/types';
import type { Snapshot } from '../../shared/types/snapshots';
import { useAppData } from '../../context/AppDataContext';
import { useStorage } from '../../context/StorageContext';
import { useAuth } from '../../context/AuthContext';
import { generateId } from '../../shared/utils';
import { sanitizeString, sanitizeFirebaseError, MAX_NAME_LENGTH } from '../../shared/utils/validation';
import { MAX_SNAPSHOTS_TOTAL } from '../../shared/storage/snapshot-limits';

/**
 * Build a clone candidate name, truncating the source ONLY when the chosen
 * suffix would push the result past MAX_NAME_LENGTH.
 *
 * ⚠️ TWO THINGS HERE ARE LOAD-BEARING AND NEITHER IS OBVIOUS.
 *
 * 1. TRUNCATION MUST HAPPEN BEFORE THE COLLISION CHECK, not after it.
 *    `cloneProject` compares each candidate against `existingNames`, which
 *    holds names already truncated to MAX_NAME_LENGTH by `validateLoadedData`
 *    on every load. Truncating the winning candidate *after* the loop would
 *    compare a 111-character candidate against 100-character stored names: the
 *    guard could never fire, and every clone of a long name would collapse to
 *    the same stored value. Measured before the fix: cloning a 100-character
 *    name twice, with a reload between, produced 3 projects and 1 distinct name.
 *
 * 2. THE RESERVE IS THE CHOSEN SUFFIX'S LENGTH, NOT A CONSTANT.
 *    `" - Copy (1)"` is 11 characters and `" - Copy (99)"` is 12. A constant 11
 *    overflows by exactly one from `(10)` upward; a constant 12 is safe but
 *    chops a character off every long clone, including the overwhelmingly
 *    common `(1)` case.
 *
 * ⚠️ This DIVERGES from `applyImportDecisions` in `export.ts`, which reserves a
 * constant `MAX_SUFFIX_LEN = 5` for its own `" (99)"` format. The divergence is
 * deliberate: the two paths share the truncate-before-the-loop *behaviour* and
 * deliberately do not share the suffix *format*. See SD-6 in
 * `docs/SPEC_DEVIATIONS.md` — mirror behaviour, never format.
 *
 * `.trimEnd()` after the slice matches `export.ts`, and earns its place
 * independently: slicing at the reserve boundary can land on a space, which
 * would otherwise produce a double space before the suffix. `sanitizeString`
 * cannot clean it, because it trims BEFORE it slices.
 */
export function buildCloneCandidateName(sourceName: string, suffix: number): string {
  const suffixText = ` - Copy (${suffix})`;
  const base = sourceName.length + suffixText.length > MAX_NAME_LENGTH
    ? sourceName.slice(0, MAX_NAME_LENGTH - suffixText.length).trimEnd()
    : sourceName;
  return base + suffixText;
}

export function useProjects() {
  const { data, updateData } = useAppData();
  const { storage } = useStorage();
  const { user } = useAuth();
  const [projectName, setProjectName] = useState('');
  const [projectFinishDate, setProjectFinishDate] = useState('');
  const [projectWorkDays, setProjectWorkDays] = useState<number[] | undefined>(undefined);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const addProject = (selectedProjectId: string, setSelectedProjectId: (id: string) => void) => {
    if (!projectName.trim()) return;
    const newProject: Project = {
      id: generateId(),
      name: sanitizeString(projectName),
      ...(projectFinishDate && { finishDate: projectFinishDate }),
      ...(projectWorkDays && projectWorkDays.length > 0 && { workDays: projectWorkDays }),
      ...(storage.mode === 'cloud' && user && { owner: user.uid }),
    };
    const newData = { ...data, projects: [...data.projects, newProject] };
    updateData(newData);
    setProjectName('');
    setProjectFinishDate('');
    setProjectWorkDays(undefined);
    if (!selectedProjectId) {
      setSelectedProjectId(newProject.id);
    }
  };

  const updateProject = () => {
    if (!projectName.trim() || !editingProjectId) return;
    const newData = {
      ...data,
      projects: data.projects.map(p =>
        p.id === editingProjectId ? {
          ...p,
          name: sanitizeString(projectName),
          ...(projectFinishDate ? { finishDate: projectFinishDate } : { finishDate: undefined }),
          ...(projectWorkDays && projectWorkDays.length > 0
            ? { workDays: projectWorkDays }
            : { workDays: undefined })
        } : p
      )
    };
    updateData(newData);
    setProjectName('');
    setProjectFinishDate('');
    setProjectWorkDays(undefined);
    setEditingProjectId(null);
  };

  const deleteProject = async (id: string, selectedProjectId: string, setSelectedProjectId: (id: string) => void) => {
    const newData = {
      ...data,
      projects: data.projects.filter(p => p.id !== id),
      releases: data.releases.filter(r => r.projectId !== id)
    };
    updateData(newData);
    // Cascade delete: remove all snapshots for this project.
    // v0.28.10: updateData above already removed the project from state, so a
    // failure here is partial. Say what actually survived rather than implying
    // the delete was undone, and still fall through to the selection reset.
    try {
      await storage.deleteSnapshotsForProject(id);
    } catch (error) {
      console.error('Failed to delete project snapshots:', error);
      alert(`Project deleted, but its saved snapshots could not be removed. ${sanitizeFirebaseError(error)}`);
    }
    if (selectedProjectId === id) {
      const remaining = data.projects.filter(p => p.id !== id);
      setSelectedProjectId(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  const startEditProject = (project: Project) => {
    setProjectName(project.name);
    setProjectFinishDate(project.finishDate || '');
    setProjectWorkDays(project.workDays);
    setEditingProjectId(project.id);
  };

  const cancelEditProject = () => {
    setProjectName('');
    setProjectFinishDate('');
    setProjectWorkDays(undefined);
    setEditingProjectId(null);
  };

  /**
   * Clone a project — duplicate the project record, all releases, and all snapshots
   * with new IDs. The cloned project is inserted immediately after the source in
   * the project list with the suffix " - Copy (N)" (collision-checked).
   *
   * Selection stays on the original project (no setSelectedProjectId parameter).
   * The user does not lose their place — the clone simply appears below.
   *
   * Snapshot block uses storage.saveSnapshots([...existing, ...cloned]) — single
   * batched write. Avoids the Promise.all race that calling addSnapshot in a loop
   * would cause on the cloud implementation. If cloning would exceed the
   * MAX_SNAPSHOTS_TOTAL workspace cap, the project + releases still clone but
   * snapshots are skipped with a user-facing alert.
   */
  const cloneProject = async (projectId: string) => {
    const source = data.projects.find(p => p.id === projectId);
    if (!source) return;

    // Build cloned name with " - Copy (N)" suffix. Truncation happens inside
    // buildCloneCandidateName, i.e. BEFORE each collision check — see its
    // doc comment for why the order and the variable reserve are load-bearing.
    const existingNames = new Set(data.projects.map(p => p.name));
    let suffix = 1;
    let candidateName = buildCloneCandidateName(source.name, suffix);
    while (existingNames.has(candidateName) && suffix < 99) {
      suffix += 1;
      candidateName = buildCloneCandidateName(source.name, suffix);
    }

    // Clone the project record. Explicit field copy (not bare ...source spread)
    // so the clone's `owner` is rebound to the current user in cloud mode rather
    // than inheriting the source's owner uid (which may belong to a different
    // user when cloning a project that was shared to you).
    const clonedProject: Project = {
      id: generateId(),
      name: candidateName,
      ...(source.finishDate && { finishDate: source.finishDate }),
      ...(source.workDays && { workDays: source.workDays }),
      ...(source.legendLabels && { legendLabels: source.legendLabels }),
      ...(storage.mode === 'cloud' && user && { owner: user.uid }),
    };

    // Clone releases with new IDs and the cloned project's ID as projectId.
    const sourceReleases = data.releases.filter(r => r.projectId === projectId);
    const clonedReleases = sourceReleases.map(r => ({
      ...r,
      id: generateId(),
      projectId: clonedProject.id,
    }));

    // Insert cloned project immediately after the source in the list.
    const sourceIndex = data.projects.findIndex(p => p.id === projectId);
    const newProjects = [
      ...data.projects.slice(0, sourceIndex + 1),
      clonedProject,
      ...data.projects.slice(sourceIndex + 1),
    ];

    updateData({
      ...data,
      projects: newProjects,
      releases: [...data.releases, ...clonedReleases],
    });

    // Snapshot block: load existing, build cloned, write all in one batch.
    const allSnapshots: Snapshot[] = await storage.loadSnapshots();
    const sourceSnapshots = allSnapshots.filter(s => s.projectId === projectId);
    if (sourceSnapshots.length === 0) return;

    if (allSnapshots.length + sourceSnapshots.length > MAX_SNAPSHOTS_TOTAL) {
      alert(
        'Project cloned successfully. Snapshots were not copied because the ' +
        'workspace is near the storage limit.'
      );
      return;
    }

    const clonedSnapshots = sourceSnapshots.map(s => ({
      ...s,
      id: generateId(),
      projectId: clonedProject.id,
    }));

    // v0.28.10: the project and its releases are already committed above, so
    // only the snapshot copy can fail here. Name that precisely.
    try {
      await storage.saveSnapshots([...allSnapshots, ...clonedSnapshots]);
    } catch (error) {
      console.error('Failed to copy snapshots to cloned project:', error);
      alert(`Project cloned, but its snapshots could not be copied. ${sanitizeFirebaseError(error)}`);
    }
  };

  return {
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
  };
}
