// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firestore sharing operations — extracted from FirestoreGanttStorageServiceImpl.
// Standalone functions for member management, invitations, and profile reads.
//
// v0.22.2 (S1 Option A / S8): the legacy single-email shareProject() helper
// was deleted. It performed an unbounded getDocs(collection('ganttapp_profiles'))
// scan to resolve email→uid, which combined with the old `allow read: if isAuth()`
// rule on ganttapp_profiles permitted bulk profile enumeration. The bulk
// invitation flow (sendInvitationEmail Cloud Function) is the only path now.

import type { FirestoreProjectMeta, PendingInvite, ProjectRole } from '../types/firestore';
import type { Firestore } from 'firebase/firestore';
import { doc, getDoc, getDocs, collection, deleteField, query, where, runTransaction, Timestamp } from 'firebase/firestore';
import { appendChangeLogEntry } from '../utils/firestore-converters';

/**
 * Remove a member from a project. All four guards run inside a single
 * Firestore transaction so the membership write, owner check, and
 * _changeLog append cannot interleave with concurrent owner activity
 * on the same project. LESSONS-LEARNED §50.
 *
 * Schema is Shape A (top-level `owner` field is authoritative; `members`
 * map also contains the owner UID with role 'owner'). Guards 3 and 4
 * read from the top-level field.
 */
export async function removeCollaborator(
  db: Firestore,
  uid: string,
  projectId: string,
  targetUid: string
): Promise<void> {
  // Guard 1 (pre-transaction fast-fail): self-removal never makes sense —
  // even an owner trying to remove themselves should hit this clearer
  // message rather than the generic "cannot remove the project owner".
  if (targetUid === uid) {
    throw new Error('Cannot remove yourself from a project.');
  }

  const projectRef = doc(db, `ganttapp_projects/${projectId}`);

  await runTransaction(db, async (tx) => {
    const projectSnap = await tx.get(projectRef);

    // Guard 2: project must exist.
    if (!projectSnap.exists()) {
      throw new Error('Project not found.');
    }

    const meta = projectSnap.data() as FirestoreProjectMeta;

    // Guard 3: caller must be the owner (Shape A authoritative field).
    if (meta.owner !== uid) {
      throw new Error('Only the project owner can remove members.');
    }

    // Guard 4: target must not be the owner (defense-in-depth — guard 1
    // already blocks the only path where this can fire under Shape A).
    if (meta.owner === targetUid) {
      throw new Error('Cannot remove the project owner.');
    }

    const updatedLog = appendChangeLogEntry(meta._changeLog ?? [], {
      timestamp: new Date().toISOString(),
      uid,
      action: 'delete',
      target: `member:${targetUid}`,
    });

    tx.update(projectRef, {
      [`members.${targetUid}`]: deleteField(),
      updatedAt: new Date().toISOString(),
      _changeLog: updatedLog,
    });
  });
}

/** Get all members of a project with their roles and emails. */
export async function getProjectMembers(
  db: Firestore,
  projectId: string
): Promise<{ uid: string; role: ProjectRole; email?: string }[]> {
  const projectRef = doc(db, `ganttapp_projects/${projectId}`);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) return [];

  const meta = projectSnap.data() as FirestoreProjectMeta;
  const members: { uid: string; role: ProjectRole; email?: string }[] = [];

  for (const [memberUid, role] of Object.entries(meta.members)) {
    // Try to load user profile for email
    const profileDoc = await getDoc(doc(db, `ganttapp_profiles/${memberUid}`));
    const email = profileDoc.exists() ? (profileDoc.data() as { email?: string }).email : undefined;
    members.push({ uid: memberUid, role, email });
  }

  return members;
}

// createUserProfile removed in v18.0.0 (D2). Profile writes are now performed
// by writeUserProfile in AuthContext, which dual-writes ganttapp_profiles
// + spertsuite_profiles on every auth resolution. The cross-app
// spertsuite_profiles write enables email→uid lookup for the bulk
// invitation flow.

function tsToMillis(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return 0;
}

/**
 * List pending invitations where the calling user is the inviter.
 * Filters status === 'pending' in code (not as a third where clause)
 * to stay within the existing (inviterUid, modelId, createdAt) composite
 * index. Note: Firestore uses 'modelId' regardless of GanttApp terminology.
 */
export async function listPendingInvites(
  db: Firestore,
  uid: string,
  projectId: string,
): Promise<PendingInvite[]> {
  const q = query(
    collection(db, 'spertsuite_invitations'),
    where('inviterUid', '==', uid),
    where('modelId', '==', projectId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        tokenId: d.id,
        appId: data.appId,
        modelId: data.modelId,
        modelName: data.modelName,
        inviteeEmail: data.inviteeEmail,
        role: data.role,
        isVoting: data.isVoting ?? false,
        inviterUid: data.inviterUid,
        inviterName: data.inviterName,
        inviterEmail: data.inviterEmail,
        status: data.status,
        createdAt: tsToMillis(data.createdAt),
        expiresAt: tsToMillis(data.expiresAt),
        acceptedAt: data.acceptedAt ? tsToMillis(data.acceptedAt) : undefined,
        acceptedByUid: data.acceptedByUid,
        lastEmailSentAt: tsToMillis(data.lastEmailSentAt),
        emailSendCount: data.emailSendCount ?? 0,
        updatedAt: tsToMillis(data.updatedAt),
      } as PendingInvite;
    })
    .filter((inv) => inv.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt);
}
