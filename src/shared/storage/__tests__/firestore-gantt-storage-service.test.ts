// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// v0.27.0 (Pass 6, I1a): mutable auth so tests can simulate user-switch races.
// Default uid 'test-uid' matches the mockUid used by all service constructions
// in this file, so existing tests continue to pass without modification.
const mutableAuth = vi.hoisted(() => ({
  currentUser: { uid: 'test-uid' } as Partial<import('firebase/auth').User> | null,
}));

vi.mock('../../../lib/firebase', () => ({
  auth: mutableAuth,
  db: {},
  isFirebaseAvailable: true,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

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

    // v0.27.0 (Pass 6, I1a): reset mutable auth to match mockUid so existing
    // tests work unchanged. Tests in the "uid guard" describe block override.
    mutableAuth.currentUser = { uid: 'test-uid' } as Partial<import('firebase/auth').User>;

    service = new FirestoreGanttStorageServiceImpl(mockDb, mockUid);
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
    // Restore default for the next test
    mutableAuth.currentUser = { uid: 'test-uid' } as Partial<import('firebase/auth').User>;
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

    // v0.21.0 — verify the constrained query is built correctly so the
    // server-side filter in Firestore (not just client-side) returns only
    // the user's projects.
    //
    // ⚠️ This comment used to end: "This is the load-bearing fix that makes
    // the list rule `allow list: if isAuth()` safe in a multi-tenant
    // collection." THAT WAS FALSE, and it is the belief that kept the hole
    // open. A client-side query is not a security boundary — an attacker uses
    // their own Firestore client and omits the filter. On 2026-08-19 an
    // unfiltered list against production returned every project in the
    // collection, including ones the caller was not a member of. The rule is
    // now membership-constrained, and THAT is what makes the collection safe;
    // this query merely has to satisfy it.
    //
    // Pinned from the other side by rules-tests/project-collections-list.test.ts
    // in the spert-landing-page repo, which runs the real rules against an
    // emulator but cannot see edits made here.
    it('builds a constrained query with where(`members.${uid}`, in, roles)', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      await service.loadAppData();

      expect(mockWhere).toHaveBeenCalledWith(
        `members.${mockUid}`,
        'in',
        ['owner', 'editor', 'viewer']
      );
      expect(mockQuery).toHaveBeenCalled();
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

    it('prunes lastSavedState before dispatching ganttapp:project-revoked on permission-denied (I2)', () => {
      // Seed lastSavedState with the project that will be revoked.
      // `lastSavedState` is TypeScript `private`; double cast bypasses access.
      // No @ts-expect-error needed (would be "unused" in strict mode).
      (
        service as unknown as {
          lastSavedState: {
            projects: { id: string; name: string }[];
            releases: { id: string; projectId: string; name: string; startDate: string; earlyFinishDate: string; lateFinishDate: string }[];
          };
        }
      ).lastSavedState = {
        projects: [{ id: 'p-revoked', name: 'Shared' }],
        releases: [{
          id: 'r1', projectId: 'p-revoked', name: 'R1',
          startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01',
        }],
      };

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      // onSnapshot signature is (query, successCb, errorCb). Capture the error callback.
      let capturedErrorCb: ((err: { code: string }) => void) | undefined;
      mockOnSnapshot.mockImplementation(
        (_ref: unknown, _success: unknown, errorCb: (err: { code: string }) => void) => {
          capturedErrorCb = errorCb;
          return vi.fn();
        },
      );

      service.subscribeToProject('p-revoked', vi.fn());
      expect(capturedErrorCb).toBeDefined();

      // Fire permission-denied
      capturedErrorCb!({ code: 'permission-denied' });

      // lastSavedState pruned: revoked project and its releases gone
      const lastSaved = (
        service as unknown as {
          lastSavedState: { projects: { id: string }[]; releases: { projectId: string }[] };
        }
      ).lastSavedState;
      expect(lastSaved.projects.find((p) => p.id === 'p-revoked')).toBeUndefined();
      expect(lastSaved.releases.find((r) => r.projectId === 'p-revoked')).toBeUndefined();

      // Eviction event dispatched with the right projectId
      const revokeCalls = dispatchSpy.mock.calls.filter(
        (c) => (c[0] as Event).type === 'ganttapp:project-revoked',
      );
      expect(revokeCalls).toHaveLength(1);
      expect(
        (revokeCalls[0][0] as CustomEvent<{ projectId: string }>).detail.projectId,
      ).toBe('p-revoked');

      dispatchSpy.mockRestore();
    });
  });

  // createUserProfile method removed in v18.0.0 (D2). Profile writes are
  // now performed by writeUserProfile in AuthContext, which dual-writes
  // ganttapp_profiles + spertsuite_profiles. AuthContext.test.tsx is the
  // canonical site for profile-write coverage.

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

  // shareProject describe block removed in v0.22.2 — the legacy single-email
  // path was deleted (S1 Option A / S8). Bulk invitations via the
  // sendInvitationEmail Cloud Function are the only remaining email→share path.

  describe('removeCollaborator', () => {
    it('throws on self-removal with the user-friendly guard-1 message', async () => {
      // Service injects mockUid as callerUid; passing mockUid as targetUid
      // is the owner-removes-self UX path. Guard 1 fires pre-transaction, so
      // no Firestore reads happen — and the user sees "Cannot remove yourself"
      // instead of the generic "Cannot remove the project owner".
      await expect(
        service.removeCollaborator('p1', mockUid)
      ).rejects.toThrow('Cannot remove yourself from a project.');
    });
  });

  // v0.27.0 (Pass 3, D1 + D2): debounce reduced from 500ms to 200ms;
  // pagehide listener added alongside beforeunload for bfcache flushing.
  describe('Pass 3 — debounce timing and pagehide listener', () => {
    it('fires debounce after exactly 200ms (D1)', async () => {
      // Establish lastSavedState so saveAppData → executeSave produces an actual
      // batch.commit (no-diff would skip the commit and break the assertion).
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await service.loadAppData();
      batchMock.commit.mockClear();

      await service.saveAppData({ projects: [], releases: [], showTodayLine: true });

      // Just before debounce expiry — no commit yet
      await vi.advanceTimersByTimeAsync(199);
      expect(batchMock.commit).not.toHaveBeenCalled();

      // Crossing 200ms — commit fires
      await vi.advanceTimersByTimeAsync(1);
      expect(batchMock.commit).toHaveBeenCalledTimes(1);
    });

    it('registers and removes both beforeunload and pagehide listeners (D2)', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const localService = new FirestoreGanttStorageServiceImpl(mockDb, mockUid);

      expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(addSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));

      localService.dispose();

      expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      expect(removeSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));

      addSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('pagehide handler flushes pendingData when invoked (D2)', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const localService = new FirestoreGanttStorageServiceImpl(mockDb, mockUid);

      // Establish lastSavedState; then queue a save without letting the timer fire.
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await localService.loadAppData();
      batchMock.commit.mockClear();

      await localService.saveAppData({ projects: [], releases: [], showTodayLine: true });
      // pendingData is set, but the 200ms timer has not elapsed.
      expect(batchMock.commit).not.toHaveBeenCalled();

      // Extract the registered pagehide handler.
      const pageHideCalls = addSpy.mock.calls.filter((c) => c[0] === 'pagehide');
      expect(pageHideCalls).toHaveLength(1);
      const handler = pageHideCalls[0][1] as () => void;

      // Invoke the handler — it should call executeSave (fire-and-forget).
      handler();
      // Allow the fire-and-forget promise chain to settle.
      await vi.advanceTimersByTimeAsync(0);

      expect(batchMock.commit).toHaveBeenCalledTimes(1);

      addSpy.mockRestore();
      localService.dispose();
    });
  });

  // v0.27.0 (Pass 6, I1a): user-switch race guards. Discard real-time
  // callbacks and abort saves when auth.currentUser.uid no longer matches
  // the uid this service was constructed for.
  describe('Pass 6 — user-switch race guards (I1a)', () => {
    it('discards subscribeToProject callback when auth.currentUser is null', () => {
      mutableAuth.currentUser = null;
      const callback = vi.fn();
      mockOnSnapshot.mockImplementation(
        (_ref: unknown, successCb: (snap: unknown) => void) => {
          successCb({ docs: [], metadata: { hasPendingWrites: false } });
          return vi.fn();
        },
      );
      service.subscribeToProject('p1', callback);
      // uid mismatch (null !== 'test-uid') → app callback not invoked
      expect(callback).not.toHaveBeenCalled();
    });

    it('allows subscribeToProject callback when auth.currentUser.uid matches', () => {
      mutableAuth.currentUser = { uid: 'test-uid' } as Partial<import('firebase/auth').User>;
      const callback = vi.fn();
      mockOnSnapshot.mockImplementation(
        (_ref: unknown, successCb: (snap: unknown) => void) => {
          successCb({
            docs: [],
            metadata: { hasPendingWrites: false },
          });
          return vi.fn();
        },
      );
      service.subscribeToProject('p1', callback);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('discards subscribeToProject callback when auth.currentUser.uid changes to a different user (user-transition)', () => {
      // Subscribe with user-1; then User-2 signs in BEFORE the success
      // callback fires. The guard must catch the transition.
      mutableAuth.currentUser = { uid: 'test-uid' } as Partial<import('firebase/auth').User>;
      const callback = vi.fn();

      let capturedSuccessCb: ((snap: unknown) => void) | undefined;
      mockOnSnapshot.mockImplementation(
        (_ref: unknown, successCb: (snap: unknown) => void) => {
          capturedSuccessCb = successCb;
          return vi.fn();
        },
      );
      service.subscribeToProject('p1', callback);

      // Simulate user switch
      mutableAuth.currentUser = { uid: 'user-2' } as Partial<import('firebase/auth').User>;

      // Fire the success callback after the switch
      capturedSuccessCb!({ docs: [], metadata: { hasPendingWrites: false } });

      // uid mismatch ('user-2' !== 'test-uid') → app callback not invoked
      expect(callback).not.toHaveBeenCalled();
    });

    it('executeSave aborts without re-queuing when uid changes (save-side guard)', async () => {
      // Establish lastSavedState so a non-uid-guarded save would actually
      // produce a batch.commit.
      mockGetDocs.mockResolvedValue({ docs: [] });
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await service.loadAppData();
      batchMock.commit.mockClear();

      // Seed pendingData directly (skip the debounce path).
      (
        service as unknown as { pendingData: { projects: []; releases: [] } | null }
      ).pendingData = { projects: [], releases: [] };

      // User switch before the save fires
      mutableAuth.currentUser = { uid: 'user-2' } as Partial<import('firebase/auth').User>;

      // Trigger executeSave directly via the private method
      await (
        service as unknown as { executeSave: () => Promise<void> }
      ).executeSave();

      // No commit attempted (uid guard fires before executeFirestoreSave)
      expect(batchMock.commit).not.toHaveBeenCalled();
      // pendingData cleared (not re-queued)
      const pending = (
        service as unknown as { pendingData: unknown }
      ).pendingData;
      expect(pending).toBeNull();
    });
  });
});
