// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore SDK
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
// deleteField returns a sentinel object that Firestore recognizes;
// in the mock we just stub it as a marker so tests can assert presence.
const DELETE_FIELD_SENTINEL = { __deleteField: true };

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  deleteField: () => DELETE_FIELD_SENTINEL,
  Timestamp: class { toMillis() { return 0; } },
}));

import {
  shareProject,
  removeCollaborator,
  getProjectMembers,
  listPendingInvites,
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

    it('throws when non-owner tries to share', async () => {
      // Mock user lookup — find the target
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'target-uid', data: () => ({ email: 'target@test.com' }) }],
      });
      // Mock project — caller is editor, not owner
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: 'real-owner', members: { 'real-owner': 'owner', [mockUid]: 'editor' },
          schemaVersion: 1, createdAt: '', updatedAt: '', _changeLog: [],
        }),
      });

      await expect(
        shareProject(mockDb, mockUid, 'p1', 'target@test.com', 'editor')
      ).rejects.toThrow('Only the project owner can share projects');
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

  describe('removeCollaborator', () => {
    it('throws when non-owner tries to remove member', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: 'real-owner', members: { 'real-owner': 'owner', [mockUid]: 'editor', 'other-uid': 'viewer' },
          schemaVersion: 1, createdAt: '', updatedAt: '', _changeLog: [],
        }),
      });

      await expect(
        removeCollaborator(mockDb, mockUid, 'p1', 'other-uid')
      ).rejects.toThrow('Only the project owner can remove members');
    });

    it('throws when trying to remove owner', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: mockUid, members: { [mockUid]: 'owner', 'other-uid': 'editor' },
          schemaVersion: 1, createdAt: '', updatedAt: '', _changeLog: [],
        }),
      });

      await expect(
        removeCollaborator(mockDb, mockUid, 'p1', mockUid)
      ).rejects.toThrow('Cannot remove the project owner');
    });

    it('removes non-owner member via deleteField on the specific key', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: mockUid, members: { [mockUid]: 'owner', 'other-uid': 'editor' },
          schemaVersion: 1, createdAt: '', updatedAt: '', _changeLog: [],
        }),
      });
      mockSetDoc.mockResolvedValue(undefined);

      await removeCollaborator(mockDb, mockUid, 'p1', 'other-uid');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      const savedPayload = mockSetDoc.mock.calls[0][1];
      // v18.0.0 (D3): payload uses deleteField() on the specific key,
      // not a full-doc rewrite. The dotted-path key is the fingerprint.
      expect(savedPayload['members.other-uid']).toBe(DELETE_FIELD_SENTINEL);
      expect(savedPayload.updatedAt).toBeDefined();
      expect(savedPayload._changeLog).toBeDefined();
      // Confirm merge:true is passed (third arg) so other members are preserved.
      expect(mockSetDoc.mock.calls[0][2]).toEqual({ merge: true });
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

  // createUserProfile removed in v18.0.0 (D2). Profile writes are now
  // performed by writeUserProfile in AuthContext, which dual-writes
  // ganttapp_profiles + spertsuite_profiles. AuthContext.test.tsx is the
  // canonical site for profile-write coverage.

  describe('listPendingInvites', () => {
    it('filters status === pending in code, not as a third where clause', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 't1', data: () => ({ status: 'pending', appId: 'ganttapp', modelId: 'p1', modelName: 'P1', inviteeEmail: 'a@x.com', role: 'editor', isVoting: false, inviterUid: mockUid, inviterName: 'Owner', inviterEmail: 'o@x.com', createdAt: 200, expiresAt: 0, lastEmailSentAt: 0, emailSendCount: 0, updatedAt: 0 }) },
          { id: 't2', data: () => ({ status: 'accepted', appId: 'ganttapp', modelId: 'p1', modelName: 'P1', inviteeEmail: 'b@x.com', role: 'viewer', isVoting: false, inviterUid: mockUid, inviterName: 'Owner', inviterEmail: 'o@x.com', createdAt: 100, expiresAt: 0, lastEmailSentAt: 0, emailSendCount: 0, updatedAt: 0 }) },
        ],
      });

      const result = await listPendingInvites(mockDb, mockUid, 'p1');
      expect(result).toHaveLength(1);
      expect(result[0].tokenId).toBe('t1');
      // Only two where() calls — status filter is in code, not in the query
      // (keeps us inside the existing composite index per Step 7c).
      expect(mockWhere).toHaveBeenCalledTimes(2);
    });

    it('sorts pending invites newest-first by createdAt', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { id: 'old', data: () => ({ status: 'pending', appId: 'ganttapp', modelId: 'p1', modelName: 'P1', inviteeEmail: 'a@x.com', role: 'editor', isVoting: false, inviterUid: mockUid, inviterName: 'Owner', inviterEmail: 'o@x.com', createdAt: 100, expiresAt: 0, lastEmailSentAt: 0, emailSendCount: 0, updatedAt: 0 }) },
          { id: 'new', data: () => ({ status: 'pending', appId: 'ganttapp', modelId: 'p1', modelName: 'P1', inviteeEmail: 'b@x.com', role: 'editor', isVoting: false, inviterUid: mockUid, inviterName: 'Owner', inviterEmail: 'o@x.com', createdAt: 500, expiresAt: 0, lastEmailSentAt: 0, emailSendCount: 0, updatedAt: 0 }) },
        ],
      });

      const result = await listPendingInvites(mockDb, mockUid, 'p1');
      expect(result.map((i) => i.tokenId)).toEqual(['new', 'old']);
    });
  });
});
