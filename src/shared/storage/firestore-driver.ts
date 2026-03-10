// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// FirestoreDriver — wraps Firestore as an async StorageDriver
// This is a thin key-value wrapper used by FirestoreGanttStorageService
// for simple doc read/write operations (user profile, user settings).

import type { StorageDriver, StorageMode } from '../types/storage';
import type { Firestore } from 'firebase/firestore';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';

export class FirestoreDriver implements StorageDriver {
  readonly mode: StorageMode = 'cloud';
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  async load<T>(key: string): Promise<T | null> {
    try {
      const ref = doc(this.db, key);
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return snap.data() as T;
    } catch {
      return null;
    }
  }

  async save<T>(key: string, data: T): Promise<void> {
    const ref = doc(this.db, key);
    await setDoc(ref, data as Record<string, unknown>, { merge: true });
  }

  async remove(key: string): Promise<void> {
    const ref = doc(this.db, key);
    await deleteDoc(ref);
  }

  onRemoteChange<T>(key: string, callback: (data: T | null) => void): () => void {
    const ref = doc(this.db, key);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        callback(snap.data() as T);
      } else {
        callback(null);
      }
    });
  }
}
