// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Storage abstraction types for GanttApp

import { AppData } from './app';
import { Snapshot } from './snapshots';

export type StorageMode = 'local' | 'cloud';

/**
 * Low-level storage driver interface — thin wrapper around a storage backend.
 * Each app creates implementations for localStorage and Firestore.
 */
export interface StorageDriver {
  readonly mode: StorageMode;

  /** Load a JSON value by key. Returns null if not found. */
  load<T>(key: string): Promise<T | null>;

  /** Save a JSON value by key. */
  save<T>(key: string, data: T): Promise<void>;

  /** Delete a value by key. */
  remove(key: string): Promise<void>;

  /** Subscribe to remote changes (cloud only). Returns unsubscribe function. */
  onRemoteChange?<T>(key: string, callback: (data: T | null) => void): () => void;
}

/**
 * GanttApp-specific high-level storage service.
 * Sits between AppDataContext and the raw StorageDriver, handling
 * the translation between GanttApp's flat AppData model and
 * whatever the storage backend requires.
 */
export interface GanttStorageService {
  readonly mode: StorageMode;

  /** Load the full AppData (projects, releases, settings). Returns null if no data. */
  loadAppData(): Promise<AppData | null>;

  /**
   * The same data as loadAppData(), without its side effects: a cloud load
   * becomes what later saves are compared with, and a successful one clears the
   * failed-load report. Only the load AppDataContext applies should do that, so
   * the download of every project reads through this instead.
   */
  readAppData(): Promise<AppData | null>;

  /** Save the full AppData. */
  saveAppData(data: AppData): Promise<void>;

  /** Load all snapshots. */
  loadSnapshots(): Promise<Snapshot[]>;

  /** Replace all snapshots. */
  saveSnapshots(snapshots: Snapshot[]): Promise<void>;

  /** Add a snapshot. Returns updated list on success, null if limit exceeded. */
  addSnapshot(snapshot: Snapshot): Promise<Snapshot[] | null>;

  /** Delete a snapshot by ID. Returns updated list. */
  deleteSnapshot(snapshotId: string): Promise<Snapshot[]>;

  /** Delete all snapshots for a project. Returns updated list. */
  deleteSnapshotsForProject(projectId: string): Promise<Snapshot[]>;

  /**
   * Cancel any pending debounced save without executing it. Pending edits
   * are intentionally discarded. Idempotent and safe to call after dispose.
   * Local mode is a no-op (no debounce). Cloud mode clears the debounce
   * timer and nulls pendingData. Used by the centralized sign-out helper
   * to discard in-flight cloud writes at sign-out (discard-on-signout UX).
   */
  cancelPendingSaves(): void;

  /**
   * Whether a write may go to this storage now. Local: always. Cloud: only
   * once a load from it has succeeded, and not after dispose; until then there
   * is nothing to save against. An action that changes the screen before it
   * writes checks this first, so a refused action never looks done.
   */
  canWrite(): boolean;

  /**
   * AppDataContext did not apply this load's result: the empty-result guard
   * skipped it, or a newer load or a storage swap began first. Called in the
   * same continuation as that decision, before any timer can run. Cloud
   * storage restores the baseline it had before that load. Local storage keeps
   * no baseline and does not implement it.
   */
  setAsideLoad?(loaded: AppData): void;
}
