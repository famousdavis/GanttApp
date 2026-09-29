// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// What the mocked LocalGanttStorageService returns. beforeEach restores the
// two-project default; a test may replace it before calling switchToCloudMode.
const local = vi.hoisted(() => ({ data: null as unknown, snapshots: [] as unknown[] }));

// Mock firebase/firestore BEFORE importing the module under test
const mockGetDoc = vi.fn();
const mockDoc = vi.fn((_firestore: unknown, path: string) => ({ path }));
// Every batch the switch creates, in creation order: [0] projects + settings,
// [1] releases, [2] snapshots (created only when there are snapshots to upload).
const batches: { set: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn> }[] = [];
const mockWriteBatch = vi.fn(() => {
  const batch = { set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  batches.push(batch);
  return batch;
});
const pathsWritten = () =>
  batches.flatMap((b) => b.set.mock.calls.map((call) => (call[0] as { path: string }).path));
const projectDocsWritten = () => pathsWritten().filter((p) => /^ganttapp_projects\/[^/]+$/.test(p));

vi.mock('firebase/firestore', () => ({
  getDoc: (...args: Parameters<typeof mockGetDoc>) => mockGetDoc(...args),
  doc: (...args: Parameters<typeof mockDoc>) => mockDoc(...args),
  writeBatch: (...args: Parameters<typeof mockWriteBatch>) => mockWriteBatch(...args),
}));

// Mock the local storage service — must be a real class for `new` to work
vi.mock('../../shared/storage/local-gantt-storage-service', () => {
  class MockLocalGanttStorageService {
    mode = 'local' as const;
    loadAppData = vi.fn(async () => local.data);
    loadSnapshots = vi.fn(async () => local.snapshots);
  }
  return { LocalGanttStorageService: MockLocalGanttStorageService };
});

// Mock the Firestore service — must be a real class for `new` to work.
// v18.0.0 (D2): createUserProfile method removed; profile writes are now
// performed by writeUserProfile in AuthContext (see AuthContext.test.tsx).
vi.mock('../../shared/storage/firestore-gantt-storage-service', () => {
  class MockFirestoreGanttStorageServiceImpl {
    mode = 'cloud' as const;
  }
  return { FirestoreGanttStorageServiceImpl: MockFirestoreGanttStorageServiceImpl };
});

// Mock converters
vi.mock('../../shared/utils/firestore-converters', () => ({
  projectToFirestoreMeta: vi.fn((_project, _uid) => ({ name: 'mock' })),
  releaseToFirestore: vi.fn((_release, _index) => ({ name: 'mock-release' })),
  appDataToUserSettings: vi.fn((_data) => ({ settings: 'mock' })),
  snapshotToFirestore: vi.fn((_snap) => ({ snapshot: 'mock' })),
}));

import { switchToCloudMode } from '../storage-mode-switch';
import { snapshotToFirestore } from '../../shared/utils/firestore-converters';

const mockUser = {
  uid: 'user-123',
  displayName: 'Test User',
  email: 'test@example.com',
} as unknown as import('firebase/auth').User;

const mockFirestore = {} as unknown as import('firebase/firestore').Firestore;

const NEW_ID_1 = '11111111-1111-4111-8111-111111111111';
const NEW_ID_2 = '22222222-2222-4222-8222-222222222222';
const snapshotOf = (id: string, projectId: string) =>
  ({ id, projectId, name: id, timestamp: '2026-01-01T00:00:00.000Z', releases: [] });

describe('switchToCloudMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    batches.length = 0;
    local.data = {
      projects: [
        { id: 'proj-1', name: 'Project One' },
        { id: 'proj-2', name: 'Project Two' },
      ],
      releases: [
        { id: 'rel-1', projectId: 'proj-1', name: 'Release 1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
      ],
    };
    local.snapshots = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips projects that already exist in cloud and user is a member', async () => {
    // Project exists and user is a member
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ members: { 'user-123': 'owner' } }),
    });

    const result = await switchToCloudMode(mockFirestore, mockUser);

    expect(result.skipped).toBe(2);
    expect(result.uploaded).toBe(0);
  });

  it('generates new ID when project exists but user is not a member', async () => {
    // Project exists but user is NOT a member
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ members: { 'other-user': 'owner' } }),
    });
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(NEW_ID_1).mockReturnValueOnce(NEW_ID_2);

    const result = await switchToCloudMode(mockFirestore, mockUser);

    expect(result.uploaded).toBe(2);
    expect(result.skipped).toBe(0);
    // Written under the new IDs — never over the other user's documents.
    expect(projectDocsWritten()).toEqual([`ganttapp_projects/${NEW_ID_1}`, `ganttapp_projects/${NEW_ID_2}`]);
  });

  it('keeps original ID when project does not exist in cloud', async () => {
    // Project does not exist
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const result = await switchToCloudMode(mockFirestore, mockUser);

    expect(result.uploaded).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('generates new ID on permission-denied error', async () => {
    // permission-denied — doc doesn't exist or user not authorized
    const permError = new Error('Permission denied');
    (permError as unknown as { code: string }).code = 'permission-denied';
    mockGetDoc.mockRejectedValue(permError);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(NEW_ID_1).mockReturnValueOnce(NEW_ID_2);

    const result = await switchToCloudMode(mockFirestore, mockUser);

    expect(result.uploaded).toBe(2);
    expect(result.skipped).toBe(0);
    // Written under the new IDs: the unreadable document may be someone else's.
    expect(projectDocsWritten()).toEqual([`ganttapp_projects/${NEW_ID_1}`, `ganttapp_projects/${NEW_ID_2}`]);
  });

  it('throws on network/transient errors instead of silently creating duplicates', async () => {
    // Network error — should NOT generate new ID, should throw
    const networkError = new Error('Network unavailable');
    (networkError as unknown as { code: string }).code = 'unavailable';
    mockGetDoc.mockRejectedValue(networkError);

    await expect(switchToCloudMode(mockFirestore, mockUser)).rejects.toThrow(
      'Failed to check project "Project One"'
    );
  });

  it('returns cloud service in the result', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await switchToCloudMode(mockFirestore, mockUser);

    expect(result.service).toBeDefined();
    expect(result.service.mode).toBe('cloud');
  });

  // v18.0.0 (D2): "creates user profile during cloud switch" test removed.
  // Profile writes are now performed by writeUserProfile in AuthContext on
  // every auth resolution (not gated on cloud-switch). Coverage lives in
  // AuthContext.test.tsx — switchToCloudMode no longer calls a profile API.

  it('uploads nothing, and still returns the cloud service, when there is no local data', async () => {
    local.data = null; // what LocalGanttStorageService returns for an empty store

    const switching = switchToCloudMode(mockFirestore, mockUser);
    await expect(switching).resolves.toMatchObject({ uploaded: 0, skipped: 0 });
    expect((await switching).service.mode).toBe('cloud');
    expect(mockGetDoc).not.toHaveBeenCalled();
    expect(batches).toEqual([]);
  });

  it('commits no releases batch when the uploaded projects have no releases', async () => {
    local.data = { projects: [{ id: 'proj-1', name: 'Project One' }], releases: [] };
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await switchToCloudMode(mockFirestore, mockUser);

    expect(result.uploaded).toBe(1);
    expect(batches[0].commit).toHaveBeenCalledTimes(1); // the project and settings
    expect(batches[1].commit).not.toHaveBeenCalled(); // the empty releases batch
  });

  it("uploads a snapshot under its project's new ID when the project was given one", async () => {
    local.data = { projects: [{ id: 'proj-1', name: 'Project One' }], releases: [] };
    local.snapshots = [snapshotOf('snap-1', 'proj-1')];
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ members: { 'other-user': 'owner' } }) });
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(NEW_ID_1);

    await switchToCloudMode(mockFirestore, mockUser);

    expect(pathsWritten()).toContain(`ganttapp_projects/${NEW_ID_1}/snapshots/snap-1`);
    expect(vi.mocked(snapshotToFirestore)).toHaveBeenCalledWith(expect.objectContaining({ id: 'snap-1', projectId: NEW_ID_1 }));
    expect(pathsWritten().filter((p) => p.includes('proj-1'))).toEqual([]);
  });

  it('does not upload the snapshots of a project it skipped', async () => {
    local.snapshots = [snapshotOf('snap-1', 'proj-1'), snapshotOf('snap-2', 'proj-2')];
    // proj-1 is already in the cloud with this user as a member; proj-2 is not.
    mockGetDoc.mockImplementation(async (ref: { path: string }) => (ref.path === 'ganttapp_projects/proj-1'
      ? { exists: () => true, data: () => ({ members: { 'user-123': 'owner' } }) }
      : { exists: () => false }));

    const result = await switchToCloudMode(mockFirestore, mockUser);

    expect(result).toMatchObject({ uploaded: 1, skipped: 1 });
    expect(pathsWritten()).toContain('ganttapp_projects/proj-2/snapshots/snap-2');
    expect(pathsWritten().filter((p) => p.includes('snap-1'))).toEqual([]);
  });

  it('names the project and gives the mapped Firebase message when the existence check fails', async () => {
    const networkError = Object.assign(new Error('grpc UNAVAILABLE: connection reset'), { code: 'unavailable' });
    mockGetDoc.mockRejectedValue(networkError);

    await expect(switchToCloudMode(mockFirestore, mockUser)).rejects.toThrow(
      'Failed to check project "Project One": Service temporarily unavailable. Please try again later.'
    );
  });

  it('sanitizes the project name it puts in that message', async () => {
    local.data = { projects: [{ id: 'proj-1', name: 'Bad\u0000Name\u0007' }], releases: [] };
    mockGetDoc.mockRejectedValue(Object.assign(new Error('offline'), { code: 'unavailable' }));

    await expect(switchToCloudMode(mockFirestore, mockUser)).rejects.toThrow('Failed to check project "BadName":');
  });
});
