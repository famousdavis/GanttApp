// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The sample project that Load Sample adds: a finish date and five releases
// across the three statuses, dated from the day of the press.

import type { Release, ReleaseStatus } from '../../shared/types';
import { formatDateISO } from '../../shared/utils/dates';
import { DEFAULT_WORK_DAYS } from '../../shared/utils/validation';

export const SAMPLE_NAME_BASE = 'Mobile App Launch';

/** "(Sample)" for the first, then "(Sample 2)", "(Sample 3)"…: the lowest free number. */
export function sampleProjectName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames);
  const nameFor = (n: number) => `${SAMPLE_NAME_BASE} (Sample${n === 1 ? '' : ` ${n}`})`;
  let n = 1;
  while (taken.has(nameFor(n))) n += 1;
  return nameFor(n);
}

const FINISH_OFFSET = 140;

// Days from the anchor. Every offset is a multiple of 7, so each date falls on
// the anchor's weekday: moving the anchor onto a working day moves every date
// there together and keeps each release's dates in order.
const SAMPLE_RELEASES: ReadonlyArray<{
  name: string;
  status?: ReleaseStatus;
  start: number;
  early: number;
  late: number;
  mostLikely?: number;
}> = [
  { name: 'Discovery & Design', status: 'complete', start: -84, early: -56, late: -49 },
  { name: 'MVP Build', status: 'complete', start: -49, early: -21, late: -14 },
  { name: 'Beta (TestFlight and Play test)', status: 'in-progress', start: -14, early: 14, late: 35, mostLikely: 21 },
  // Not started: the app never stores 'not-started'; an absent status means it.
  { name: 'Public Launch 1.0', start: 28, early: 63, late: 91, mostLikely: 77 },
  { name: 'Release 1.1: Offline Mode', start: 70, early: 105, late: 133, mostLikely: 119 },
];

export type SampleRelease = Omit<Release, 'id' | 'projectId'>;

export interface SampleContent {
  name: string;
  finishDate: string;
  releases: SampleRelease[];
}

/** The first day on or after `today` that is in the work week (local time, at midnight). */
export function sampleAnchor(today: Date, workDays: readonly number[]): Date {
  const days = workDays.length > 0 ? workDays : DEFAULT_WORK_DAYS;
  const anchor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let i = 0; i < 7 && !days.includes(anchor.getDay()); i += 1) {
    anchor.setDate(anchor.getDate() + 1);
  }
  return anchor;
}

export function buildSampleProject(
  today: Date,
  workDays: readonly number[] | undefined,
  existingNames: readonly string[],
): SampleContent {
  const anchor = sampleAnchor(today, workDays ?? DEFAULT_WORK_DAYS);
  const at = (offset: number) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + offset);
    return formatDateISO(d.getTime());
  };
  return {
    name: sampleProjectName(existingNames),
    finishDate: at(FINISH_OFFSET),
    releases: SAMPLE_RELEASES.map((r) => ({
      name: r.name,
      startDate: at(r.start),
      earlyFinishDate: at(r.early),
      lateFinishDate: at(r.late),
      ...(r.status && { status: r.status }),
      ...(r.mostLikely !== undefined && { mostLikelyFinishDate: at(r.mostLikely) }),
    })),
  };
}
