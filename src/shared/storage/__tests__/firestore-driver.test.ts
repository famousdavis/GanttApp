// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore SDK
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

import { FirestoreDriver } from '../firestore-driver';

describe('FirestoreDriver', () => {
  let driver: FirestoreDriver;
  const mockDb = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    driver = new FirestoreDriver(mockDb);
    mockDoc.mockReturnValue('doc-ref');
  });

  it('has mode "cloud"', () => {
    expect(driver.mode).toBe('cloud');
  });

  describe('load', () => {
    it('returns data when document exists', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ foo: 'bar' }) });
      const result = await driver.load('some/path');
      expect(result).toEqual({ foo: 'bar' });
      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'some/path');
    });

    it('returns null when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      const result = await driver.load('some/path');
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Network error'));
      const result = await driver.load('some/path');
      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('calls setDoc with merge', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      await driver.save('some/path', { foo: 'bar' });
      expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', { foo: 'bar' }, { merge: true });
    });
  });

  describe('remove', () => {
    it('calls deleteDoc', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);
      await driver.remove('some/path');
      expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
    });
  });

  describe('onRemoteChange', () => {
    it('subscribes and calls callback with data', () => {
      const unsubFn = vi.fn();
      mockOnSnapshot.mockImplementation((_ref: unknown, callback: (snap: any) => void) => {
        callback({ exists: () => true, data: () => ({ value: 42 }) });
        return unsubFn;
      });

      const callback = vi.fn();
      const unsub = driver.onRemoteChange('some/path', callback);
      expect(callback).toHaveBeenCalledWith({ value: 42 });
      expect(typeof unsub).toBe('function');
    });

    it('calls callback with null when document does not exist', () => {
      mockOnSnapshot.mockImplementation((_ref: unknown, callback: (snap: any) => void) => {
        callback({ exists: () => false });
        return vi.fn();
      });

      const callback = vi.fn();
      driver.onRemoteChange('some/path', callback);
      expect(callback).toHaveBeenCalledWith(null);
    });
  });
});
