// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Which of a project's releases this browser has changed and not yet sent.
// The cloud service holds a listener's snapshot back while any are (R46), and
// tells a viewer when the save skipped one of them (R53).

import type { AppData } from '../types/app';
import type { Release } from '../types/models';
import { releaseChanged } from './firestore-save-executor';

/** One project's releases, in their order. */
export function releasesOf(data: AppData, projectId: string): Release[] {
  return data.releases.filter((r) => r.projectId === projectId);
}

/** Whether release `id` differs between two lists: in one only, changed, or at another position. */
function differs(id: string, mine: Release[], other: Release[]): boolean {
  const i = mine.findIndex((r) => r.id === id);
  const j = other.findIndex((r) => r.id === id);
  if (i < 0 || j < 0) return i !== j;
  return i !== j || releaseChanged(other[j], mine[i]);
}

/**
 * The releases of `projectId` that `candidate` holds as this browser's own
 * change: each differs both from the baseline (what the cloud held at the last
 * load or acknowledged save) and from `delivered` (the releases the project's
 * listener last delivered). The baseline never takes in what a listener
 * delivers, so after a delivered change the app's own echo of it differs from
 * the baseline alone, and is not a change of this browser's. With nothing
 * delivered yet, the baseline alone is the reference.
 *
 * Known edge: a user who, within the debounce, reverts a collaborator's
 * delivered change to the baseline's value makes a release that differs from
 * the delivered list but not from the baseline. It does not count, so a
 * snapshot can undo that revert.
 */
export function unsentReleaseIds(
  projectId: string,
  candidate: AppData,
  baseline: AppData,
  delivered?: Release[]
): string[] {
  const mine = releasesOf(candidate, projectId);
  const saved = releasesOf(baseline, projectId);
  const ids = new Set<string>();
  [mine, saved, delivered ?? []].forEach((list) => list.forEach((r) => ids.add(r.id)));
  return Array.from(ids).filter((id) => differs(id, mine, saved) && (!delivered || differs(id, mine, delivered)));
}
