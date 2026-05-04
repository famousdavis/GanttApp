// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/firestore BEFORE importing the module under test
const mockGetDoc = vi.fn();
const mockDoc = vi.fn((_firestore: unknown, path: string) => ({ path }));
const mockWriteBatch = vi.fn(() => ({
  set: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', () => ({
  getDoc: (...args: Parameters<typeof mockGetDoc>) => mockGetDoc(...args),
  doc: (...args: Parameters<typeof mockDoc>) => mockDoc(...args),
  writeBatch: (...args: Parameters<typeof mockWriteBatch>) => mockWriteBatch(...args),
}));

// Mock the local storage service — must be a real class for `new` to work
vi.mock('../../shared/storage/local-gantt-storage-service', () => {
  class MockLocalGanttStorageService {
    mode = 'local' as const;
    loadAppData = vi.fn().mockResolvedValue({
      projects: [
        { id: 'proj-1', name: 'Project One' },
        { id: 'proj-2', name: 'Project Two' },
      ],
      releases: [
        { id: 'rel-1', projectId: 'proj-1', name: 'Release 1', startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' },
      ],
    });
    loadSnapshots = vi.fn().mockResolvedValue([]);
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

const mockUser = {
  uid: 'user-123',
  displayName: 'Test User',
  email: 'test@example.com',
} as unknown as import('firebase/auth').User;

const mockFirestore = {} as unknown as import('firebase/firestore').Firestore;

describe('switchToCloudMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const result = await switchToCloudMode(mockFirestore, mockUser);

    expect(result.uploaded).toBe(2);
    expect(result.skipped).toBe(0);
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

    const result = await switchToCloudMode(mockFirestore, mockUser);

    expect(result.uploaded).toBe(2);
    expect(result.skipped).toBe(0);
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
});
