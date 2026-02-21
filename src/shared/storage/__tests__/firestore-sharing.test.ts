import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore SDK
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
}));

import {
  shareProject,
  removeProjectMember,
  getProjectMembers,
  createUserProfile,
} from '../firestore-sharing';

describe('firestore-sharing', () => {
  const mockDb = {} as any;
  const mockUid = 'test-uid';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));
    mockDoc.mockImplementation((...args: unknown[]) => `doc:${(args as string[]).slice(1).join('/')}`);
    mockCollection.mockImplementation((...args: unknown[]) => `col:${(args as string[]).slice(1).join('/')}`);
  });

  describe('shareProject', () => {
    it('throws when target user not found', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await expect(
        shareProject(mockDb, mockUid, 'p1', 'unknown@test.com', 'editor')
      ).rejects.toThrow('not found');
    });

    it('adds member to project when user found', async () => {
      // Mock user lookup
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'target-uid', data: () => ({ email: 'target@test.com' }) }],
      });
      // Mock project get
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: mockUid, members: { [mockUid]: 'owner' },
          schemaVersion: 1, createdAt: '', updatedAt: '', _changeLog: [],
        }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      await shareProject(mockDb, mockUid, 'p1', 'target@test.com', 'editor');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const savedMeta = mockSetDoc.mock.calls[0][1];
      expect(savedMeta.members['target-uid']).toBe('editor');
    });
  });

  describe('removeProjectMember', () => {
    it('throws when trying to remove owner', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: 'owner-uid', members: { 'owner-uid': 'owner' },
          schemaVersion: 1, createdAt: '', updatedAt: '', _changeLog: [],
        }),
      });

      await expect(
        removeProjectMember(mockDb, mockUid, 'p1', 'owner-uid')
      ).rejects.toThrow('Cannot remove the project owner');
    });

    it('removes non-owner member', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: mockUid, members: { [mockUid]: 'owner', 'other-uid': 'editor' },
          schemaVersion: 1, createdAt: '', updatedAt: '', _changeLog: [],
        }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      await removeProjectMember(mockDb, mockUid, 'p1', 'other-uid');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const savedMeta = mockSetDoc.mock.calls[0][1];
      expect(savedMeta.members['other-uid']).toBeUndefined();
    });
  });

  describe('getProjectMembers', () => {
    it('returns empty array when project not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const result = await getProjectMembers(mockDb, 'p1');
      expect(result).toEqual([]);
    });

    it('returns members with emails from profiles', async () => {
      // Mock project
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: 'uid-1', members: { 'uid-1': 'owner' },
          schemaVersion: 1, createdAt: '', updatedAt: '',
        }),
      });
      // Mock profile lookup
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ email: 'user@test.com' }),
      });

      const result = await getProjectMembers(mockDb, 'p1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ uid: 'uid-1', role: 'owner', email: 'user@test.com' });
    });
  });

  describe('createUserProfile', () => {
    it('creates new profile when none exists', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      mockSetDoc.mockResolvedValue(undefined);

      await createUserProfile(mockDb, mockUid, 'Test User', 'test@example.com');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const profileData = mockSetDoc.mock.calls[0][1];
      expect(profileData.displayName).toBe('Test User');
      expect(profileData.email).toBe('test@example.com');
      expect(profileData.createdAt).toBeDefined();
    });

    it('updates existing profile', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ displayName: 'Old', email: 'old@test.com', createdAt: '2026-01-01', lastLogin: '2026-01-15' }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      await createUserProfile(mockDb, mockUid, 'New', 'new@test.com');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const profileData = mockSetDoc.mock.calls[0][1];
      expect(profileData.displayName).toBe('New');
    });
  });
});
