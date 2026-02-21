// Firestore sharing operations — extracted from FirestoreGanttStorageServiceImpl.
// Standalone functions for project sharing, member management, and user profiles.

import type { FirestoreProjectMeta, ProjectRole } from '../types/firestore';
import type { Firestore } from 'firebase/firestore';
import { doc, getDoc, getDocs, setDoc, collection } from 'firebase/firestore';
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
    throw new Error(`User with email "${targetEmail}" not found. They must sign in at least once first.`);
  }

  // Update project members
  const projectRef = doc(db, `ganttapp_projects/${projectId}`);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) throw new Error('Project not found');

  const meta = projectSnap.data() as FirestoreProjectMeta;
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

/** Remove a member from a project. Cannot remove the project owner. */
export async function removeProjectMember(
  db: Firestore,
  uid: string,
  projectId: string,
  targetUid: string
): Promise<void> {
  const projectRef = doc(db, `ganttapp_projects/${projectId}`);
  const projectSnap = await getDoc(projectRef);
  if (!projectSnap.exists()) throw new Error('Project not found');

  const meta = projectSnap.data() as FirestoreProjectMeta;
  if (meta.owner === targetUid) {
    throw new Error('Cannot remove the project owner');
  }

  delete meta.members[targetUid];
  meta.updatedAt = new Date().toISOString();
  meta._changeLog = appendChangeLogEntry(meta._changeLog ?? [], {
    timestamp: new Date().toISOString(),
    uid,
    action: 'delete',
    target: `member:${targetUid}`,
  });

  await setDoc(projectRef, meta);
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

/** Create or update a user profile (called on sign-in). */
export async function createUserProfile(
  db: Firestore,
  uid: string,
  displayName: string,
  email: string
): Promise<void> {
  const profileRef = doc(db, `ganttapp_profiles/${uid}`);
  const existing = await getDoc(profileRef);
  const now = new Date().toISOString();

  if (existing.exists()) {
    // Update lastLogin
    await setDoc(profileRef, { ...existing.data(), lastLogin: now, displayName, email }, { merge: true });
  } else {
    await setDoc(profileRef, { displayName, email, createdAt: now, lastLogin: now });
  }
}
