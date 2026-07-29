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
// Transaction primitives — used by removeCollaborator (LESSONS-LEARNED §50).
// mockTxGet returns the snapshot the updater sees; mockTxUpdate captures the
// write payload so tests can assert the deleteField sentinel and audit log.
const mockTxGet = vi.fn();
const mockTxUpdate = vi.fn();
const mockRunTransaction = vi.fn(
  async (_db: unknown, updater: (tx: { get: typeof mockTxGet; update: typeof mockTxUpdate }) => Promise<void>) =>
    updater({ get: mockTxGet, update: mockTxUpdate }),
);
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
  runTransaction: (...args: unknown[]) => mockRunTransaction(...(args as [unknown, never])),
  deleteField: () => DELETE_FIELD_SENTINEL,
  Timestamp: class { toMillis() { return 0; } },
}));

import {
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

  // shareProject describe block removed in v0.22.2 — the legacy single-email
  // helper was deleted (S1 Option A / S8). The bulk-invitation flow
  // (sendInvitationEmail Cloud Function) is the only remaining email→share path.

  describe('removeCollaborator', () => {
    it('throws on self-removal before opening a transaction (guard 1)', async () => {
      // Guard 1 fires pre-transaction — no get, no update, no runTransaction.
      await expect(
        removeCollaborator(mockDb, mockUid, 'p1', mockUid)
      ).rejects.toThrow('Cannot remove yourself from a project.');
      expect(mockRunTransaction).not.toHaveBeenCalled();
      expect(mockTxGet).not.toHaveBeenCalled();
    });

    it('throws when project does not exist (guard 2)', async () => {
      mockTxGet.mockResolvedValueOnce({ exists: () => false });

      await expect(
        removeCollaborator(mockDb, mockUid, 'p1', 'other-uid')
      ).rejects.toThrow('Project not found.');
      expect(mockTxUpdate).not.toHaveBeenCalled();
    });

    it('throws when non-owner tries to remove member (guard 3)', async () => {
      mockTxGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: 'real-owner', members: { 'real-owner': 'owner', [mockUid]: 'editor', 'other-uid': 'viewer' },
          schemaVersion: 1, createdAt: '', updatedAt: '', _changeLog: [],
        }),
      });

      await expect(
        removeCollaborator(mockDb, mockUid, 'p1', 'other-uid')
      ).rejects.toThrow('Only the project owner can remove members.');
      expect(mockTxUpdate).not.toHaveBeenCalled();
    });

    it('removes non-owner member via deleteField inside the transaction', async () => {
      mockTxGet.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: 'P1', owner: mockUid, members: { [mockUid]: 'owner', 'other-uid': 'editor' },
          schemaVersion: 1, createdAt: '', updatedAt: '', _changeLog: [],
        }),
      });

      await removeCollaborator(mockDb, mockUid, 'p1', 'other-uid');
      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(mockTxUpdate).toHaveBeenCalledTimes(1);
      // tx.update(ref, payload) — assert the payload, not setDoc.
      const savedPayload = mockTxUpdate.mock.calls[0][1];
      expect(savedPayload['members.other-uid']).toBe(DELETE_FIELD_SENTINEL);
      expect(savedPayload.updatedAt).toBeDefined();
      expect(savedPayload._changeLog).toBeDefined();
      expect(mockSetDoc).not.toHaveBeenCalled();
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

    // Regression: ShareDialog renders `member.email || member.uid`, so an
    // unresolved profile put a raw 28-char Firebase Auth UID on screen.
    // writeUserProfile dual-writes ganttapp_profiles + spertsuite_profiles, but
    // only on THIS app's sign-in. The cross-app invitation Cloud Function
    // resolves an invitee BY their spertsuite_profiles doc and then writes only
    // members.{uid} — it never seeds a per-app profile. Suite-wide sweep
    // 2026-07-29; first found in SPERT Story Map v0.49.3.
    describe('suite profile fallback', () => {
      const MEMBER = 'nT5V5xk8pcNHpHE7IjMxJtmQBPa2';

      /** Route getDoc by the `doc:<path>` marker mockDoc produces. */
      function routeDocs(docs: Record<string, Record<string, unknown>>, reads: string[]) {
        mockGetDoc.mockImplementation(async (ref: unknown) => {
          const path = String(ref).replace(/^doc:/, '');
          reads.push(path);
          const data = docs[path];
          return { exists: () => data !== undefined, data: () => data };
        });
      }

      const project = {
        name: 'P1', owner: 'uid-1', members: { [MEMBER]: 'editor' },
        schemaVersion: 1, createdAt: '', updatedAt: '',
      };

      it('falls back to spertsuite_profiles when the per-app profile is missing', async () => {
        const reads: string[] = [];
        routeDocs({
          'ganttapp_projects/p1': project,
          [`spertsuite_profiles/${MEMBER}`]: { email: 'famousdavispmp@gmail.com' },
        }, reads);

        const result = await getProjectMembers(mockDb, 'p1');
        expect(result[0]?.email).toBe('famousdavispmp@gmail.com');
      });

      it('does not read the suite mirror when the per-app profile exists', async () => {
        const reads: string[] = [];
        routeDocs({
          'ganttapp_projects/p1': project,
          [`ganttapp_profiles/${MEMBER}`]: { email: 'local@example.com' },
          [`spertsuite_profiles/${MEMBER}`]: { email: 'suite@example.com' },
        }, reads);

        const result = await getProjectMembers(mockDb, 'p1');
        expect(result[0]?.email).toBe('local@example.com');
        expect(reads).not.toContain(`spertsuite_profiles/${MEMBER}`);
      });

      it('leaves email undefined when neither profile exists', async () => {
        const reads: string[] = [];
        routeDocs({ 'ganttapp_projects/p1': project }, reads);

        const result = await getProjectMembers(mockDb, 'p1');
        expect(result[0]?.email).toBeUndefined();
        expect(reads).toContain(`ganttapp_profiles/${MEMBER}`);
        expect(reads).toContain(`spertsuite_profiles/${MEMBER}`);
      });
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
