// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Firestore SDK
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockWriteBatch = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();

const batchMock = {
  set: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
};

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  writeBatch: () => batchMock,
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
}));

import { FirestoreGanttStorageServiceImpl } from '../firestore-gantt-storage-service';

describe('FirestoreGanttStorageService', () => {
  let service: FirestoreGanttStorageServiceImpl;
  const mockDb = {} as any;
  const mockUid = 'test-uid';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    batchMock.set.mockClear();
    batchMock.delete.mockClear();
    batchMock.commit.mockClear().mockResolvedValue(undefined);
    mockDoc.mockImplementation((...args: unknown[]) => `doc:${(args as string[]).slice(1).join('/')}`);
    mockCollection.mockImplementation((...args: unknown[]) => `col:${(args as string[]).slice(1).join('/')}`);
    mockQuery.mockImplementation((ref: unknown) => ref);

    service = new FirestoreGanttStorageServiceImpl(mockDb, mockUid);
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  it('has mode "cloud"', () => {
    expect(service.mode).toBe('cloud');
  });

  describe('loadAppData', () => {
    it('loads projects, releases, and settings', async () => {
      // Mock projects collection
      mockGetDocs.mockResolvedValueOnce({
        docs: [{
          id: 'p1',
          data: () => ({
            name: 'Project 1',
            owner: mockUid,
            members: { [mockUid]: 'owner' },
            schemaVersion: 1,
            createdAt: '', updatedAt: '',
          }),
        }],
      });

      // Mock releases subcollection
      mockGetDocs.mockResolvedValueOnce({
        docs: [{
          id: 'r1',
          data: () => ({
            name: 'Release 1',
            startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
            order: 0,
          }),
        }],
      });

      // Mock user settings
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ showTodayLine: true, preparedBy: 'Test' }),
      });

      const result = await service.loadAppData();
      expect(result).not.toBeNull();
      expect(result!.projects).toHaveLength(1);
      expect(result!.projects[0].name).toBe('Project 1');
      expect(result!.releases).toHaveLength(1);
      expect(result!.releases[0].name).toBe('Release 1');
      expect(result!.showTodayLine).toBe(true);
    });

    it('returns null on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Network error'));
      const result = await service.loadAppData();
      expect(result).toBeNull();
    });

    it('filters projects by membership client-side', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'p1', data: () => ({ name: 'Mine', members: { [mockUid]: 'owner' }, owner: mockUid, schemaVersion: 1, createdAt: '', updatedAt: '' }) },
          { id: 'p2', data: () => ({ name: 'Not Mine', members: { 'other-uid': 'owner' }, owner: 'other-uid', schemaVersion: 1, createdAt: '', updatedAt: '' }) },
        ],
      });

      // Releases for p1 only
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      // Settings
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await service.loadAppData();
      expect(result!.projects).toHaveLength(1);
      expect(result!.projects[0].name).toBe('Mine');
    });
  });

  describe('saveAppData (debounced)', () => {
    it('debounces writes', async () => {
      // First load to establish lastSavedState
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await service.loadAppData();

      const data = { projects: [], releases: [] };
      await service.saveAppData(data);

      // Should not have committed yet
      expect(batchMock.commit).not.toHaveBeenCalled();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(600);
      expect(batchMock.commit).toHaveBeenCalled();
    });

    it('coalesces multiple rapid saves', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await service.loadAppData();

      await service.saveAppData({ projects: [], releases: [] });
      await service.saveAppData({ projects: [], releases: [] });
      await service.saveAppData({ projects: [], releases: [] });

      await vi.advanceTimersByTimeAsync(600);
      // Only one commit, not three
      expect(batchMock.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveAppDataImmediate', () => {
    it('bypasses debounce', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await service.loadAppData();

      await service.saveAppDataImmediate({ projects: [], releases: [] });
      // Should commit immediately without timer
      expect(batchMock.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('flushPendingWrites', () => {
    it('flushes pending debounced data', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await service.loadAppData();

      await service.saveAppData({ projects: [], releases: [] });
      // Pending but not yet committed
      expect(batchMock.commit).not.toHaveBeenCalled();

      await service.flushPendingWrites();
      expect(batchMock.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelPendingSaves', () => {
    it('clears the debounce timer before it fires (no batch commit)', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await service.loadAppData();

      await service.saveAppData({ projects: [], releases: [] });
      expect(batchMock.commit).not.toHaveBeenCalled();

      service.cancelPendingSaves();

      // Advance past the 500ms debounce — nothing should fire.
      await vi.advanceTimersByTimeAsync(600);
      expect(batchMock.commit).not.toHaveBeenCalled();
    });

    it('nulls pendingData so a subsequent flush is a no-op', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await service.loadAppData();

      await service.saveAppData({ projects: [], releases: [] });
      service.cancelPendingSaves();

      // A follow-up flush should not commit anything.
      await service.flushPendingWrites();
      expect(batchMock.commit).not.toHaveBeenCalled();
    });

    it('is safe to call after dispose() — does not throw', () => {
      service.dispose();
      expect(() => service.cancelPendingSaves()).not.toThrow();
    });

    it('is idempotent — repeated calls do not throw', () => {
      service.cancelPendingSaves();
      service.cancelPendingSaves();
      expect(() => service.cancelPendingSaves()).not.toThrow();
    });
  });

  describe('subscribeToProject', () => {
    it('sets up onSnapshot listener and returns unsubscribe', () => {
      const unsubFn = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubFn);

      const callback = vi.fn();
      const unsub = service.subscribeToProject('p1', callback);
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      expect(typeof unsub).toBe('function');
    });

    it('converts Firestore releases and passes QuerySnapshot', () => {
      const mockSnapshot = {
        docs: [{
          id: 'r1',
          data: () => ({
            name: 'R1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01',
            lateFinishDate: '2026-03-01', order: 0,
          }),
        }],
        metadata: { hasPendingWrites: false },
      };

      mockOnSnapshot.mockImplementation((_ref: unknown, callback: (snap: any) => void) => {
        callback(mockSnapshot);
        return vi.fn();
      });

      const callback = vi.fn();
      service.subscribeToProject('p1', callback);

      expect(callback).toHaveBeenCalledTimes(1);
      const [releases, snapshot] = callback.mock.calls[0];
      expect(releases).toHaveLength(1);
      expect(releases[0].name).toBe('R1');
      expect(releases[0].projectId).toBe('p1');
      expect(snapshot).toBe(mockSnapshot);
    });
  });

  describe('createUserProfile', () => {
    it('creates new profile when none exists', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      await service.createUserProfile('Test User', 'test@example.com');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const profileData = mockSetDoc.mock.calls[0][1];
      expect(profileData.displayName).toBe('Test User');
      expect(profileData.email).toBe('test@example.com');
      expect(profileData.createdAt).toBeDefined();
      expect(profileData.lastLogin).toBeDefined();
    });

    it('updates existing profile lastLogin', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ displayName: 'Old Name', email: 'old@test.com', createdAt: '2026-01-01T00:00:00.000Z', lastLogin: '2026-01-15T00:00:00.000Z' }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      await service.createUserProfile('New Name', 'new@test.com');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const profileData = mockSetDoc.mock.calls[0][1];
      expect(profileData.displayName).toBe('New Name');
      expect(profileData.email).toBe('new@test.com');
    });
  });

  describe('addSnapshot', () => {
    it('returns null when total limit reached', async () => {
      // Mock loadSnapshots to return 100 snapshots
      mockGetDocs.mockResolvedValueOnce({
        docs: Array.from({ length: 10 }, (_, i) => ({
          id: `p${i}`,
          data: () => ({ name: `P${i}`, members: { [mockUid]: 'owner' }, owner: mockUid, schemaVersion: 1, createdAt: '', updatedAt: '' }),
        })),
      });
      // Each project has 10 snapshots
      for (let i = 0; i < 10; i++) {
        mockGetDocs.mockResolvedValueOnce({
          docs: Array.from({ length: 10 }, (_, j) => ({
            id: `snap-${i}-${j}`,
            data: () => ({ name: `Snap ${j}`, timestamp: '2026-01-01T00:00:00.000Z', releases: [] }),
          })),
        });
      }

      const result = await service.addSnapshot({
        id: 'new-snap', projectId: 'p0', name: 'New', timestamp: '', releases: [],
      });
      expect(result).toBeNull();
    });
  });

  describe('dispose', () => {
    it('unsubscribes all listeners', () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

      service.subscribeToProject('p1', vi.fn());
      service.subscribeToProject('p2', vi.fn());

      service.dispose();
      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
    });

    it('prevents further saves after disposal', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await service.loadAppData();

      service.dispose();
      await service.saveAppData({ projects: [], releases: [] });
      await vi.advanceTimersByTimeAsync(600);
      expect(batchMock.commit).not.toHaveBeenCalled();
    });
  });

  describe('settingsChanged triggers save on exportAttribution change', () => {
    it('saves settings when exportAttribution changes', async () => {
      // Load initial state
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'p1', data: () => ({ name: 'P1', members: { [mockUid]: 'owner' }, owner: mockUid, schemaVersion: 1, createdAt: '', updatedAt: '' }) }],
      });
      mockGetDocs.mockResolvedValueOnce({ docs: [] }); // releases
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ showTodayLine: true }),
      });
      await service.loadAppData();

      // Save with exportAttribution added
      const data = {
        projects: [{ id: 'p1', name: 'P1' }],
        releases: [],
        showTodayLine: true,
        exportAttribution: { name: 'Alice', identifier: 'team-42' },
      };

      // Mock getDoc for the project update check
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ name: 'P1', members: { [mockUid]: 'owner' }, owner: mockUid, schemaVersion: 1, createdAt: '', updatedAt: '' }),
      });

      await service.saveAppDataImmediate(data);

      // The settings doc should have been written
      const settingsSetCalls = batchMock.set.mock.calls.filter(
        (call: unknown[]) => String(call[0]).includes('ganttapp_settings')
      );
      expect(settingsSetCalls.length).toBeGreaterThan(0);
      // Verify exportAttribution is in the settings
      const settingsData = settingsSetCalls[0][1];
      expect(settingsData.exportAttribution).toEqual({ name: 'Alice', identifier: 'team-42' });
    });
  });

  describe('shareProject', () => {
    it('throws when target user not found', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] }); // no users found

      await expect(
        service.shareProject('p1', 'unknown@test.com', 'editor')
      ).rejects.toThrow('not found');
    });
  });

  describe('removeProjectMember', () => {
    it('throws when trying to remove owner', async () => {
      // Service uid (test-uid) must be the owner to pass the owner-role check
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'Test', owner: mockUid, members: { [mockUid]: 'owner', 'other-uid': 'editor' },
          schemaVersion: 1, createdAt: '', updatedAt: '',
        }),
      });

      await expect(
        service.removeProjectMember('p1', mockUid)
      ).rejects.toThrow('Cannot remove the project owner');
    });
  });
});
