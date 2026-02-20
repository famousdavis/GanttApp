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
}
