// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// cloud-load-guards tests (v0.29.10) — what the checks on cloud-read project
// data set aside, and, as importantly, that nothing the app itself writes is
// ever set aside: a value set aside here is dropped from the cloud by the
// next save, so a check stricter than the app's writers would lose data.

import { describe, it, expect, vi } from 'vitest';
import {
  isLoadableDate,
  cloudOrder,
  cloudOrderOf,
  optionalCloudDate,
  cloudRelease,
  cloudLegendLabels,
  cloudPreparedBy,
} from '../cloud-load-guards';
import { formatDateISO, parseDateLocal } from '../dates';

describe('isLoadableDate', () => {
  it('accepts the dates the release form allows', () => {
    expect(isLoadableDate('2000-01-01')).toBe(true);
    expect(isLoadableDate('2026-10-29')).toBe(true);
    expect(isLoadableDate('2050-12-31')).toBe(true);
  });

  it('accepts every date duplicating a release can produce, up to the last year a Date holds', () => {
    // duplicateRelease moves a release forward by its own length and writes
    // formatDateISO's output, which does not pad the year: five digits past 9999.
    for (let year = 2000; year <= 275_000; year += 997) {
      const written = formatDateISO(new Date(year, 11, 31).getTime());
      expect(isLoadableDate(written)).toBe(true);
    }
    expect(isLoadableDate('10000-01-01')).toBe(true);
  });

  it('rejects what no writer produces: non-strings, other formats, and years no Date holds', () => {
    for (const value of [undefined, null, 123, NaN, {}, [], true, '', 'garbage', '2026-1-1', '26-01-01',
      '2026/01/01', '2026-01-01T00:00:00Z', '999999-01-01', '1234567-01-01']) {
      expect(isLoadableDate(value)).toBe(false);
    }
  });
});

describe('cloudOrder / cloudOrderOf', () => {
  it('keeps a finite number and reads anything else as 0', () => {
    expect(cloudOrder(7)).toBe(7);
    expect(cloudOrder(-2)).toBe(-2);
    for (const value of [undefined, null, 'x', NaN, Infinity, {}]) expect(cloudOrder(value)).toBe(0);
  });

  it('reads the order of an array element that is not an object as 0', () => {
    expect(cloudOrderOf({ order: 3 })).toBe(3);
    expect(cloudOrderOf(null)).toBe(0);
    expect(cloudOrderOf('release')).toBe(0);
  });
});

describe('optionalCloudDate', () => {
  it('keeps a loadable date and leaves an absent one absent, reporting neither', () => {
    const report = vi.fn();
    expect(optionalCloudDate('2026-04-01', 'p1', 'project-finish-date', report)).toBe('2026-04-01');
    expect(optionalCloudDate(undefined, 'p1', 'project-finish-date', report)).toBeUndefined();
    // projectToFirestoreMeta writes null for a project with no finish date.
    expect(optionalCloudDate(null, 'p1', 'project-finish-date', report)).toBeUndefined();
    expect(optionalCloudDate('', 'p1', 'project-finish-date', report)).toBeUndefined();
    expect(report).not.toHaveBeenCalled();
  });

  it('drops anything else and reports the rule, not the value', () => {
    const report = vi.fn();
    expect(optionalCloudDate({ year: 2026 }, 'p1', 'project-finish-date', report)).toBeUndefined();
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'project-finish-date');
  });
});

describe('cloudRelease', () => {
  // The largest release the app writes: a 100-character name (sanitizeString's
  // cap), every optional field, and dates at the form's limits.
  const fullRelease = {
    name: 'N'.repeat(100),
    startDate: '2000-01-01',
    earlyFinishDate: '2025-06-30',
    lateFinishDate: '2050-12-31',
    mostLikelyFinishDate: '2040-01-15',
    hidden: true,
    status: 'in-progress',
    order: 11,
  };

  it('loads the largest release the app writes unchanged, setting nothing aside', () => {
    const report = vi.fn();
    expect(cloudRelease('r1', 'p1', fullRelease, report)).toStrictEqual({
      id: 'r1',
      projectId: 'p1',
      name: 'N'.repeat(100),
      startDate: '2000-01-01',
      earlyFinishDate: '2025-06-30',
      lateFinishDate: '2050-12-31',
      mostLikelyFinishDate: '2040-01-15',
      hidden: true,
      status: 'in-progress',
    });
    expect(report).not.toHaveBeenCalled();
  });

  it('loads a release that duplicates carried past 2050, and past year 9999', () => {
    const report = vi.fn();
    const release = cloudRelease('r2', 'p1', {
      name: 'Release (copy) (copy)', startDate: '9999-06-01', earlyFinishDate: '10000-01-01', lateFinishDate: '10050-12-31', order: 2,
    }, report);
    expect(release?.lateFinishDate).toBe('10050-12-31');
    expect(report).not.toHaveBeenCalled();
  });

  it.each([
    ['a number', { startDate: 20260101 }],
    ['an object', { earlyFinishDate: { seconds: 1 } }],
    ['null', { lateFinishDate: null }],
    ['missing', { lateFinishDate: undefined }],
    ['not a date', { startDate: 'soon' }],
  ])('sets the release aside when a required date is %s', (_label, change) => {
    const report = vi.fn();
    expect(cloudRelease('r1', 'p1', { ...fullRelease, ...change }, report)).toBeNull();
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'release-dates');
  });

  it('sets aside a document that is not an object at all', () => {
    const report = vi.fn();
    expect(cloudRelease('r1', 'p1', 'release', report)).toBeNull();
    expect(cloudRelease('r1', 'p1', null, report)).toBeNull();
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('drops a bad most-likely date and keeps the release', () => {
    const report = vi.fn();
    const release = cloudRelease('r1', 'p1', { ...fullRelease, mostLikelyFinishDate: ['2040-01-15'] }, report);
    expect(release?.name).toBe('N'.repeat(100));
    expect(release).not.toHaveProperty('mostLikelyFinishDate');
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'release-most-likely');
  });

  it('drops a "hidden" that is not a boolean and keeps the release', () => {
    const report = vi.fn();
    const release = cloudRelease('r1', 'p1', { ...fullRelease, hidden: 'yes' }, report);
    expect(release).not.toHaveProperty('hidden');
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'release-hidden');
  });

  it('reads a name that is not text as empty, as the converters always have', () => {
    expect(cloudRelease('r1', 'p1', { ...fullRelease, name: { text: 'x' } })?.name).toBe('');
  });

  it('keeps the legacy completed flag as the complete status', () => {
    const { status: _status, ...legacy } = fullRelease;
    expect(cloudRelease('r1', 'p1', { ...legacy, completed: true })?.status).toBe('complete');
  });

  it('never throws, whatever the document holds', () => {
    for (const value of [undefined, null, 0, 'x', [], [1, 2], { startDate: Symbol.iterator }]) {
      expect(() => cloudRelease('r1', 'p1', value)).not.toThrow();
    }
  });

  it('keeps a far-future date that is a date string: the chart span bounds it, not this check', () => {
    // Year 100000 is a valid Date. Setting it aside here would also set aside
    // the dates duplicates reach; clampChartSpan bounds the work it drives.
    const release = cloudRelease('r1', 'p1', { ...fullRelease, lateFinishDate: '100000-01-01', mostLikelyFinishDate: undefined });
    expect(Number.isFinite(parseDateLocal(release!.lateFinishDate))).toBe(true);
  });
});

describe('cloudLegendLabels', () => {
  it('keeps every label that is text, as written, with no length cap', () => {
    const report = vi.fn();
    const labels = { solidBar: 'S'.repeat(80), hatchedBar: 'H', finishDateLine: 'F', mostLikelyLine: 'M', inProgress: 'I' };
    expect(cloudLegendLabels(labels, 'p1', report)).toStrictEqual(labels);
    expect(report).not.toHaveBeenCalled();
  });

  it('drops a label that is not text and reports it once', () => {
    const report = vi.fn();
    expect(cloudLegendLabels({ solidBar: { $$typeof: 'x' }, hatchedBar: 'H', inProgress: 5 }, 'p1', report))
      .toStrictEqual({ hatchedBar: 'H' });
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'snapshot-legend-labels');
  });

  it('reads absent labels as absent, and labels that are not an object as absent with a report', () => {
    const report = vi.fn();
    expect(cloudLegendLabels(undefined, 'p1', report)).toBeUndefined();
    expect(report).not.toHaveBeenCalled();
    expect(cloudLegendLabels('labels', 'p1', report)).toBeUndefined();
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'snapshot-legend-labels');
  });
});

describe('cloudPreparedBy', () => {
  it('keeps text, including empty text, and leaves absent absent', () => {
    const report = vi.fn();
    expect(cloudPreparedBy('Jane Smith', 'p1', report)).toBe('Jane Smith');
    expect(cloudPreparedBy('', 'p1', report)).toBe('');
    expect(cloudPreparedBy(undefined, 'p1', report)).toBeUndefined();
    expect(cloudPreparedBy(null, 'p1', report)).toBeUndefined();
    expect(report).not.toHaveBeenCalled();
  });

  it('drops anything else and reports it', () => {
    const report = vi.fn();
    expect(cloudPreparedBy({ name: 'x' }, 'p1', report)).toBeUndefined();
    expect(report).toHaveBeenCalledExactlyOnceWith('p1', 'snapshot-prepared-by');
  });
});
