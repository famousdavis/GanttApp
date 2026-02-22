// Converters between GanttApp's flat AppData model and Firestore's per-project document model.
// These are pure functions with no Firestore SDK dependencies — they only transform data shapes.

import { Project, Release, ChartColors, ChartDisplaySettings } from '../types/models';
import { AppData } from '../types/app';
import { Snapshot } from '../types/snapshots';
import {
  FirestoreProjectMeta,
  FirestoreRelease,
  FirestoreSnapshot,
  FirestoreUserSettings,
  ChangeLogEntry,
  MAX_CHANGELOG_ENTRIES,
} from '../types/firestore';
import { sanitizeId } from './validation';

// --- Flat AppData → Firestore ---

/** Extract one project's Firestore document from flat AppData. */
export function projectToFirestoreMeta(
  project: Project,
  uid: string,
  existingMeta?: Partial<FirestoreProjectMeta>
): FirestoreProjectMeta {
  const now = new Date().toISOString();
  return {
    name: project.name,
    owner: existingMeta?.owner ?? uid,
    members: existingMeta?.members ?? { [uid]: 'owner' },
    ...(project.finishDate ? { finishDate: project.finishDate } : { finishDate: null }),
    schemaVersion: 1,
    _originRef: existingMeta?._originRef ?? `uid:${uid}`,
    _changeLog: existingMeta?._changeLog ?? [],
    createdAt: existingMeta?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Convert a Release to a FirestoreRelease (adds explicit order field). */
export function releaseToFirestore(release: Release, order: number): FirestoreRelease {
  return {
    name: release.name,
    startDate: release.startDate,
    earlyFinishDate: release.earlyFinishDate,
    lateFinishDate: release.lateFinishDate,
    ...(release.hidden !== undefined && { hidden: release.hidden }),
    ...(release.completed !== undefined && { completed: release.completed }),
    ...(release.mostLikelyFinishDate && { mostLikelyFinishDate: release.mostLikelyFinishDate }),
    order,
  };
}

/** Convert app-level settings to Firestore user settings document. */
export function appDataToUserSettings(data: AppData): FirestoreUserSettings {
  return {
    ...(data.chartColors && { chartColors: data.chartColors }),
    ...(data.activePreset && { activePreset: data.activePreset }),
    ...(data.legendLabels && { legendLabels: data.legendLabels }),
    ...(data.showTodayLine !== undefined && { showTodayLine: data.showTodayLine }),
    ...(data.showFinishDateLine !== undefined && { showFinishDateLine: data.showFinishDateLine }),
    ...(data.showMostLikelyLine !== undefined && { showMostLikelyLine: data.showMostLikelyLine }),
    ...(data.chartDisplaySettings && { chartDisplaySettings: data.chartDisplaySettings }),
    ...(data.preparedBy !== undefined && { preparedBy: data.preparedBy }),
    ...(data.showPreparedBy !== undefined && { showPreparedBy: data.showPreparedBy }),
    ...(data.exportAttribution && { exportAttribution: data.exportAttribution }),
  };
}

/** Convert a Snapshot to a FirestoreSnapshot (strips projectId, converts releases). */
export function snapshotToFirestore(snapshot: Snapshot): FirestoreSnapshot {
  return {
    name: snapshot.name,
    timestamp: snapshot.timestamp,
    releases: snapshot.releases.map((r, i) => releaseToFirestore(r, i)),
    ...(snapshot.projectFinishDate && { projectFinishDate: snapshot.projectFinishDate }),
    ...(snapshot.chartColors && { chartColors: snapshot.chartColors }),
    ...(snapshot.legendLabels && { legendLabels: snapshot.legendLabels }),
    ...(snapshot.preparedBy !== undefined && { preparedBy: snapshot.preparedBy }),
  };
}

// --- Firestore → Flat AppData ---

/** Convert a Firestore project meta + its releases back to Project + Release[]. */
export function firestoreToProject(
  projectId: string,
  meta: FirestoreProjectMeta
): Project {
  return {
    id: projectId,
    name: meta.name,
    ...(meta.finishDate && { finishDate: meta.finishDate }),
    owner: sanitizeId(meta.owner),
  };
}

/** Convert Firestore releases back to flat Release[], preserving order. */
export function firestoreReleasesToFlat(
  projectId: string,
  releaseEntries: { id: string; data: FirestoreRelease }[]
): Release[] {
  return releaseEntries
    .sort((a, b) => a.data.order - b.data.order)
    .map(({ id, data }) => ({
      id,
      projectId,
      name: data.name,
      startDate: data.startDate,
      earlyFinishDate: data.earlyFinishDate,
      lateFinishDate: data.lateFinishDate,
      ...(data.hidden !== undefined && { hidden: data.hidden }),
      ...(data.completed !== undefined && { completed: data.completed }),
      ...(data.mostLikelyFinishDate && { mostLikelyFinishDate: data.mostLikelyFinishDate }),
    }));
}

/** Convert Firestore user settings back to the relevant AppData fields. */
export function userSettingsToAppData(settings: FirestoreUserSettings): Partial<AppData> {
  return {
    ...(settings.chartColors && { chartColors: settings.chartColors as ChartColors }),
    ...(settings.activePreset && { activePreset: settings.activePreset }),
    ...(settings.legendLabels && { legendLabels: settings.legendLabels }),
    ...(settings.showTodayLine !== undefined && { showTodayLine: settings.showTodayLine }),
    ...(settings.showFinishDateLine !== undefined && { showFinishDateLine: settings.showFinishDateLine }),
    ...(settings.showMostLikelyLine !== undefined && { showMostLikelyLine: settings.showMostLikelyLine }),
    ...(settings.chartDisplaySettings && { chartDisplaySettings: settings.chartDisplaySettings as ChartDisplaySettings }),
    ...(settings.preparedBy !== undefined && { preparedBy: settings.preparedBy }),
    ...(settings.showPreparedBy !== undefined && { showPreparedBy: settings.showPreparedBy }),
    ...(settings.exportAttribution && { exportAttribution: settings.exportAttribution }),
  };
}

/** Convert a Firestore snapshot document back to a Snapshot. */
export function firestoreSnapshotToFlat(
  snapshotId: string,
  projectId: string,
  data: FirestoreSnapshot
): Snapshot {
  return {
    id: snapshotId,
    projectId,
    name: data.name,
    timestamp: data.timestamp,
    releases: data.releases
      .sort((a, b) => a.order - b.order)
      .map((r, i) => ({
        id: `${snapshotId}-r${i}`,
        projectId,
        name: r.name,
        startDate: r.startDate,
        earlyFinishDate: r.earlyFinishDate,
        lateFinishDate: r.lateFinishDate,
        ...(r.hidden !== undefined && { hidden: r.hidden }),
        ...(r.completed !== undefined && { completed: r.completed }),
        ...(r.mostLikelyFinishDate && { mostLikelyFinishDate: r.mostLikelyFinishDate }),
      })),
    ...(data.projectFinishDate && { projectFinishDate: data.projectFinishDate }),
    ...(data.chartColors && { chartColors: data.chartColors as ChartColors }),
    ...(data.legendLabels && { legendLabels: data.legendLabels }),
    ...(data.preparedBy !== undefined && { preparedBy: data.preparedBy }),
  };
}

/**
 * Reconstruct flat AppData from multiple Firestore project documents + user settings.
 * This is the inverse of the project-centric decomposition.
 */
export function firestoreToFlatAppData(
  projects: { id: string; meta: FirestoreProjectMeta }[],
  releasesMap: Map<string, { id: string; data: FirestoreRelease }[]>,
  settings: FirestoreUserSettings | null
): AppData {
  const flatProjects: Project[] = projects.map(p => firestoreToProject(p.id, p.meta));

  const flatReleases: Release[] = projects.flatMap(p => {
    const entries = releasesMap.get(p.id) ?? [];
    return firestoreReleasesToFlat(p.id, entries);
  });

  const settingsFields = settings ? userSettingsToAppData(settings) : {};

  return {
    projects: flatProjects,
    releases: flatReleases,
    ...settingsFields,
  };
}

// --- Changelog helpers ---

/** Append an entry to a project's changelog, enforcing the cap. */
export function appendChangeLogEntry(
  existing: ChangeLogEntry[],
  entry: ChangeLogEntry
): ChangeLogEntry[] {
  const updated = [...existing, entry];
  if (updated.length > MAX_CHANGELOG_ENTRIES) {
    return updated.slice(updated.length - MAX_CHANGELOG_ENTRIES);
  }
  return updated;
}
