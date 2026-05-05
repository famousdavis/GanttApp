// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// LocalGanttStorageService — local mode implementation of GanttStorageService
// Delegates to LocalStorageDriver for raw read/write, reuses existing validation.

import type { GanttStorageService, StorageMode } from '../types/storage';
import type { AppData } from '../types/app';
import type { Snapshot } from '../types/snapshots';
import { LocalStorageDriver } from './local-storage-driver';
import { validateLoadedData } from '../utils/storage';
import { validateSnapshot } from '../utils/snapshots';
import { MAX_SNAPSHOTS_TOTAL, MAX_SNAPSHOTS_PER_PROJECT } from './snapshot-limits';

const APP_DATA_KEY = 'ganttAppData';
const SNAPSHOTS_KEY = 'ganttAppSnapshots';

/**
 * Clear only project data and snapshots from localStorage.
 * Preserves: ganttapp-storage-mode, gantt-theme, ganttapp-workspace-id
 * — user preferences, not project data.
 *
 * v16.6: no longer preserves 'ganttapp-has-uploaded-to-cloud' (removed
 * from the app entirely as a dead write; the v16.6 sign-out cleanup
 * actively removes it as a one-time migration for existing users).
 */
export function clearLocalProjectData(): void {
  localStorage.removeItem(APP_DATA_KEY);
  localStorage.removeItem(SNAPSHOTS_KEY);
}

export class LocalGanttStorageService implements GanttStorageService {
  readonly mode: StorageMode = 'local';
  private driver: LocalStorageDriver;

  constructor() {
    this.driver = new LocalStorageDriver();
  }

  async loadAppData(): Promise<AppData | null> {
    const raw = await this.driver.load<unknown>(APP_DATA_KEY);
    if (raw === null) return null;
    return validateLoadedData(raw);
  }

  async saveAppData(data: AppData): Promise<void> {
    await this.driver.save(APP_DATA_KEY, data);
  }

  async loadSnapshots(): Promise<Snapshot[]> {
    const raw = await this.driver.load<unknown[]>(SNAPSHOTS_KEY);
    if (!Array.isArray(raw)) return [];

    const validated: Snapshot[] = [];
    for (const item of raw) {
      const snapshot = validateSnapshot(item);
      if (snapshot) {
        validated.push(snapshot);
      }
    }
    return validated;
  }

  async saveSnapshots(snapshots: Snapshot[]): Promise<void> {
    await this.driver.save(SNAPSHOTS_KEY, snapshots);
  }

  async addSnapshot(snapshot: Snapshot): Promise<Snapshot[] | null> {
    const all = await this.loadSnapshots();

    // Check total limit
    if (all.length >= MAX_SNAPSHOTS_TOTAL) {
      return null;
    }

    // Check per-project limit
    const projectCount = all.filter(s => s.projectId === snapshot.projectId).length;
    if (projectCount >= MAX_SNAPSHOTS_PER_PROJECT) {
      return null;
    }

    all.push(snapshot);
    await this.saveSnapshots(all);
    return all;
  }

  async deleteSnapshot(snapshotId: string): Promise<Snapshot[]> {
    const all = await this.loadSnapshots();
    const filtered = all.filter(s => s.id !== snapshotId);
    await this.saveSnapshots(filtered);
    return filtered;
  }

  async deleteSnapshotsForProject(projectId: string): Promise<Snapshot[]> {
    const all = await this.loadSnapshots();
    const filtered = all.filter(s => s.projectId !== projectId);
    await this.saveSnapshots(filtered);
    return filtered;
  }

  // No-op: local mode has no debounce. Present to satisfy the interface
  // so consumers can call cancelPendingSaves() without mode-checking.
  cancelPendingSaves(): void {
    // intentionally empty
  }
}
