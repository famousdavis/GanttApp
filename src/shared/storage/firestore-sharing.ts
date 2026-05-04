// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Firestore sharing operations — extracted from FirestoreGanttStorageServiceImpl.
// Standalone functions for project sharing, member management, and user profiles.

import type { FirestoreProjectMeta, PendingInvite, ProjectRole } from '../types/firestore';
import type { Firestore } from 'firebase/firestore';
import { doc, getDoc, getDocs, setDoc, collection, deleteField, query, where, Timestamp } from 'firebase/firestore';
import { appendChangeLogEntry } from '../utils/firestore-converters';

/** Share a project with another user by email. */
export async function shareProject(
  db: Firestore,
  uid: string,
  projectId: string,
  targetEmail: string,
  role: ProjectRole
): Promise<void> {
  // Look up user by email
  const usersSnap = await getDocs(collection(db, 'ganttapp_profiles'));
  let targetUid: string | null = null;

  for (const userDoc of usersSnap.docs) {
    const profile = userDoc.data();
    if (profile.email === targetEmail) {
      targetUid = userDoc.id;
      break;
    }
  }

  if (!targetUid) {
    throw new Error('User not found. They must sign in at least once first.');
  }

  // Update project members
  const projectRef = doc(db, `ganttapp_projects/${projectId}`);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) throw new Error('Project not found');

  const meta = projectSnap.data() as FirestoreProjectMeta;
  if (meta.members[uid] !== 'owner') {
    throw new Error('Only the project owner can share projects.');
  }
  meta.members[targetUid] = role;
  meta.updatedAt = new Date().toISOString();
  meta._changeLog = appendChangeLogEntry(meta._changeLog ?? [], {
    timestamp: new Date().toISOString(),
    uid,
    action: 'update',
    target: `member:${targetUid}:${role}`,
  });

  await setDoc(projectRef, meta);
}

/**
 * Remove a member from a project. Cannot remove the project owner.
 * Renamed from removeProjectMember in v18.0.0 (D3). Uses deleteField()
 * on the specific members.{uid} key rather than overwriting the full
 * document — race-safe under concurrent membership changes.
 */
export async function removeCollaborator(
  db: Firestore,
  uid: string,
  projectId: string,
  targetUid: string
): Promise<void> {
  const projectRef = doc(db, `ganttapp_projects/${projectId}`);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) throw new Error('Project not found');

  const meta = projectSnap.data() as FirestoreProjectMeta;
  if (meta.members[uid] !== 'owner') {
    throw new Error('Only the project owner can remove members.');
  }
  if (meta.owner === targetUid) {
    throw new Error('Cannot remove the project owner');
  }

  // _changeLog append stays read-modify-write (owner-only, low concurrency risk).
  const updatedLog = appendChangeLogEntry(meta._changeLog ?? [], {
    timestamp: new Date().toISOString(),
    uid,
    action: 'delete',
    target: `member:${targetUid}`,
  });

  // deleteField() on the specific key — race-safe, no full-doc overwrite (D3).
  await setDoc(projectRef, {
    [`members.${targetUid}`]: deleteField(),
    updatedAt: new Date().toISOString(),
    _changeLog: updatedLog,
  }, { merge: true });
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
