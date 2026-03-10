// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// LocalStorageDriver — wraps browser localStorage as an async StorageDriver

import type { StorageDriver, StorageMode } from '../types/storage';

export class LocalStorageDriver implements StorageDriver {
  readonly mode: StorageMode = 'local';

  async load<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async save<T>(key: string, data: T): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded. Please export your data and clear some space.');
      }
      throw e;
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(key);
  }
}
