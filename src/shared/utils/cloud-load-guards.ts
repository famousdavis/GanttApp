// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Checks on project data read from the cloud (v0.29.10).
//
// Any editor of a shared project can write its documents, so what the
// converters read is not necessarily what this app wrote. These checks set
// aside what the app can never have written and keep the rest:
// - They check shape only: a value's type, and that a date is a date string
//   the chart can parse. Every value the app's own writers produce passes,
//   because the cloud save writes state back, and a check that set aside a
//   value the app wrote would drop it from the cloud at the next save.
// - Nothing here throws, and nothing here writes.
// - A date's RANGE is not checked here. The release form keeps dates within
//   2000–2050, but duplicateRelease carries them past 2050, so the range is
//   bounded where it drives work instead: clampChartSpan in dates.ts.

import { Release } from '../types/models';
import { parseDateLocal } from './dates';
import { sanitizeString, migrateReleaseStatus } from './validation';

/** A short name for the check that set something aside. Never the value. */
export type CloudSetAsideRule =
  | 'release-dates'
  | 'release-most-likely'
  | 'release-hidden'
  | 'project-finish-date'
  | 'snapshot-shape'
  | 'snapshot-finish-date'
  | 'snapshot-legend-labels'
  | 'snapshot-prepared-by';

/** Told of each value set aside, with the project it belongs to. */
export type CloudSetAsideReport = (projectId: string, rule: CloudSetAsideRule) => void;

// Four to six year digits: formatDateISO does not pad the year, so dates that
// duplicates carry past 9999 have five digits. Year 275760 is the last a
// JavaScript Date holds; the finite-parse test below rejects anything later.
const LOADABLE_DATE = /^\d{4,6}-\d{2}-\d{2}$/;

const LEGEND_LABEL_KEYS = ['solidBar', 'hatchedBar', 'finishDateLine', 'mostLikelyLine', 'inProgress'] as const;

type LegendLabels = Partial<Record<(typeof LEGEND_LABEL_KEYS)[number], string>>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function isAbsent(value: unknown): boolean {
  return value === undefined || value === null;
}

/** Whether a value is a date string the chart can parse. */
export function isLoadableDate(value: unknown): value is string {
  return typeof value === 'string' && LOADABLE_DATE.test(value) && Number.isFinite(parseDateLocal(value));
}

/** A cloud `order` value as a sort key: the number when finite, otherwise 0. */
export function cloudOrder(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** The `order` of an element of a cloud array, which may not be an object. */
export function cloudOrderOf(element: unknown): number {
  return cloudOrder(asRecord(element).order);
}

/** An optional date: kept when loadable; absent ('' and null included) stays absent; anything else is reported. */
export function optionalCloudDate(
  value: unknown,
  projectId: string,
  rule: CloudSetAsideRule,
  report?: CloudSetAsideReport
): string | undefined {
  if (isAbsent(value) || value === '') return undefined;
  if (isLoadableDate(value)) return value;
  report?.(projectId, rule);
  return undefined;
}

/**
 * One release read from the cloud, or null when it is set aside: when its
 * start, early or late date is not a loadable date. A bad optional field is
 * dropped and the release kept.
 */
export function cloudRelease(
  id: string,
  projectId: string,
  data: unknown,
  report?: CloudSetAsideReport
): Release | null {
  const r = asRecord(data);
  const { startDate, earlyFinishDate, lateFinishDate } = r;
  if (!isLoadableDate(startDate) || !isLoadableDate(earlyFinishDate) || !isLoadableDate(lateFinishDate)) {
    report?.(projectId, 'release-dates');
    return null;
  }
  const status = migrateReleaseStatus(r);
  const mostLikely = optionalCloudDate(r.mostLikelyFinishDate, projectId, 'release-most-likely', report);
  if (!isAbsent(r.hidden) && typeof r.hidden !== 'boolean') report?.(projectId, 'release-hidden');
  return {
    id,
    projectId,
    name: sanitizeString(r.name as string),
    startDate,
    earlyFinishDate,
    lateFinishDate,
    ...(typeof r.hidden === 'boolean' && { hidden: r.hidden }),
    ...(status ? { status } : {}),
    ...(mostLikely && { mostLikelyFinishDate: mostLikely }),
  };
}

/**
 * A snapshot's legend labels: each known label kept as written when it is a
 * string. Undefined when there were none to read.
 */
export function cloudLegendLabels(
  labels: unknown,
  projectId: string,
  report?: CloudSetAsideReport
): LegendLabels | undefined {
  if (isAbsent(labels)) return undefined;
  if (typeof labels !== 'object') {
    report?.(projectId, 'snapshot-legend-labels');
    return undefined;
  }
  const l = labels as Record<string, unknown>;
  const result: LegendLabels = {};
  let setAside = false;
  for (const key of LEGEND_LABEL_KEYS) {
    if (typeof l[key] === 'string') result[key] = l[key] as string;
    else if (!isAbsent(l[key])) setAside = true;
  }
  if (setAside) report?.(projectId, 'snapshot-legend-labels');
  return result;
}

/** A snapshot's "prepared by" text, kept as written when it is a string. */
export function cloudPreparedBy(
  value: unknown,
  projectId: string,
  report?: CloudSetAsideReport
): string | undefined {
  if (typeof value === 'string') return value;
  if (!isAbsent(value)) report?.(projectId, 'snapshot-prepared-by');
  return undefined;
}
