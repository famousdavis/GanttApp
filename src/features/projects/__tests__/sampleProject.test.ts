// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The sample project's name and dates, for any day of the press and any work week.

import { describe, it, expect } from 'vitest';
import { buildSampleProject, sampleAnchor, sampleProjectName } from '../sampleProject';
import { parseDateLocal } from '../../../shared/utils/dates';

const dow = (iso: string) => new Date(parseDateLocal(iso)).getDay();

// The name Load Sample gives (contract §7 "Load Sample", v0.35.0): "Sample: Mobile App Launch", then "(2)", "(3)"…, the
// lowest number free, counted against every project's name. The six cases the FRAME26 clean-up brief names, plus the
// gap a deleted copy leaves.
describe('sampleProjectName', () => {
  const BASE = 'Sample: Mobile App Launch';
  it('with no projects, is the base name', () => {
    expect(sampleProjectName([])).toBe(BASE);
    expect(sampleProjectName(['Other'])).toBe(BASE);
  });
  it('with the base taken, is "(2)"', () => {
    expect(sampleProjectName([BASE])).toBe(`${BASE} (2)`);
  });
  it('with the base and "(2)" taken, is "(3)"', () => {
    expect(sampleProjectName([BASE, `${BASE} (2)`])).toBe(`${BASE} (3)`);
  });
  it('with "(2)" taken but the base free, is the base: the base wins', () => {
    expect(sampleProjectName([`${BASE} (2)`])).toBe(BASE);
  });
  it('counts an archived project: archiving is a per-person setting, so its name is in the list', () => {
    // ProjectsTab passes every project's name, archived ones included (useProjects.addSampleProject).
    const archived = { name: BASE, archived: true };
    expect(sampleProjectName([archived.name])).toBe(`${BASE} (2)`);
  });
  it("counts a person's own project named like a sample, and fills the lowest gap", () => {
    expect(sampleProjectName([BASE, `${BASE} (3)`])).toBe(`${BASE} (2)`);
    expect(sampleProjectName([BASE, `${BASE} (2)`, `${BASE} (3)`])).toBe(`${BASE} (4)`);
  });
  it('matches names exactly, and ignores the pre-v0.35.0 names', () => {
    expect(sampleProjectName(['sample: mobile app launch', ` ${BASE}`, 'Mobile App Launch (Sample)'])).toBe(BASE);
  });
});

describe('sampleAnchor', () => {
  // 2026-06-07 is a Sunday; each case presses on a different day.
  it.each([
    { today: new Date(2026, 5, 12), days: [1, 2, 3, 4, 5], expected: '2026-06-12' }, // Friday, a work day
    { today: new Date(2026, 5, 13), days: [1, 2, 3, 4, 5], expected: '2026-06-15' }, // Saturday → Monday
    { today: new Date(2026, 5, 14), days: [1, 2, 3, 4, 5], expected: '2026-06-15' }, // Sunday → Monday, one day on
    { today: new Date(2026, 5, 12), days: [0, 1, 2, 3, 4], expected: '2026-06-14' }, // Friday → Sunday
    { today: new Date(2026, 5, 9), days: [6], expected: '2026-06-13' }, // Tuesday → Saturday
    { today: new Date(2026, 5, 12, 23, 30), days: [5], expected: '2026-06-12' }, // late on a work day
  ])('pressed on $today with week $days starts on $expected', ({ today, days, expected }) => {
    const a = sampleAnchor(today, days);
    const iso = `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-${String(a.getDate()).padStart(2, '0')}`;
    expect(iso).toBe(expected);
    expect(a.getHours()).toBe(0);
  });

  it('falls back to Monday to Friday for an empty week', () => {
    expect(sampleAnchor(new Date(2026, 5, 13), []).getDay()).toBe(1);
  });
});

describe('buildSampleProject', () => {
  it.each([
    { label: 'Monday to Friday, pressed on a Saturday', today: new Date(2026, 5, 13), days: [1, 2, 3, 4, 5] },
    { label: 'Sunday to Thursday, pressed on a Friday', today: new Date(2026, 5, 12), days: [0, 1, 2, 3, 4] },
    { label: 'Saturdays only, pressed on a Wednesday', today: new Date(2026, 5, 10), days: [6] },
  ])('with $label, every date is a work day and each release keeps its order', ({ today, days }) => {
    const s = buildSampleProject(today, days, []);
    const dates = [s.finishDate, ...s.releases.flatMap(r =>
      [r.startDate, r.earlyFinishDate, r.lateFinishDate, ...(r.mostLikelyFinishDate ? [r.mostLikelyFinishDate] : [])])];
    expect(dates).toHaveLength(1 + 5 * 3 + 3);
    dates.forEach(d => expect(days).toContain(dow(d)));
    s.releases.forEach(r => {
      expect(r.startDate < r.earlyFinishDate).toBe(true);
      expect(r.earlyFinishDate < r.lateFinishDate).toBe(true);
      if (r.mostLikelyFinishDate) {
        expect(r.mostLikelyFinishDate > r.earlyFinishDate && r.mostLikelyFinishDate < r.lateFinishDate).toBe(true);
      }
    });
  });

  it('has a finish date 140 days from the first work day, and five releases across the three statuses', () => {
    const s = buildSampleProject(new Date(2026, 5, 12), [0, 1, 2, 3, 4], ['Sample: Mobile App Launch']);
    expect(s.name).toBe('Sample: Mobile App Launch (2)');
    expect(s.finishDate).toBe('2026-11-01'); // Sunday 2026-06-14 + 140 days
    expect(s.releases.map(r => [r.name, r.status])).toEqual([
      ['Discovery & Design', 'complete'],
      ['MVP Build', 'complete'],
      ['Beta (TestFlight and Play test)', 'in-progress'],
      ['Public Launch 1.0', undefined],
      ['Release 1.1: Offline Mode', undefined],
    ]);
    expect(s.releases[0]).toEqual({
      name: 'Discovery & Design', status: 'complete',
      startDate: '2026-03-22', earlyFinishDate: '2026-04-19', lateFinishDate: '2026-04-26',
    });
    expect(s.releases[2].mostLikelyFinishDate).toBe('2026-07-05');
    expect('status' in s.releases[3]).toBe(false);
  });

  it('with no global week given, uses Monday to Friday', () => {
    const s = buildSampleProject(new Date(2026, 5, 13), undefined, []);
    expect(dow(s.finishDate)).toBe(1);
  });
});
