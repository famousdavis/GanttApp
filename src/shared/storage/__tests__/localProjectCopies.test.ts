// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Removing projects' copies from this browser after they are safely in the
// cloud: each project goes with its releases and its snapshots, and when no
// project is left, the local project data goes entirely, settings included.

import { describe, it, expect, beforeEach } from 'vitest';
import * as localStorageService from '../local-gantt-storage-service';

type RemoveCopies = (projectIds: string[]) => Promise<void>;
// Reached through optional access, so that against a module without it a test
// fails at its assertion rather than at import.
const removeCopies: RemoveCopies = async (ids) => {
  const fn = (localStorageService as unknown as { removeLocalProjectCopies?: RemoveCopies }).removeLocalProjectCopies;
  await fn?.(ids);
};

const release = (id: string, projectId: string) =>
  ({ id, projectId, name: id, startDate: '2026-01-01', earlyFinishDate: '2026-02-01', lateFinishDate: '2026-03-01' });
const snapshot = (id: string, projectId: string) =>
  ({ id, projectId, name: id, timestamp: '2026-01-01T00:00:00.000Z', releases: [] });
const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null');
const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('removeLocalProjectCopies', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('ganttAppData', JSON.stringify({
      projects: [{ id: 'p1', name: 'One' }, { id: 'p2', name: 'Two' }, { id: 'p3', name: 'Three' }],
      releases: [release('r1', 'p1'), release('r2', 'p2'), release('r3', 'p3')],
      preparedBy: 'Local Person',
    }));
    localStorage.setItem('ganttAppSnapshots', JSON.stringify([snapshot('s1', 'p1'), snapshot('s3', 'p3')]));
    localStorage.setItem('gantt-theme', 'dark');
  });

  it('removes the named projects with their releases and snapshots, and keeps the rest and the settings', async () => {
    await removeCopies(['p1', 'p2']);

    expect(ids(stored('ganttAppData').projects)).toEqual(['p3']);
    expect(ids(stored('ganttAppData').releases)).toEqual(['r3']);
    expect(stored('ganttAppData').preparedBy).toBe('Local Person');
    expect(ids(stored('ganttAppSnapshots'))).toEqual(['s3']);
  });

  it('clears the local project data entirely when no project is left', async () => {
    await removeCopies(['p1', 'p2', 'p3']);

    expect(localStorage.getItem('ganttAppData')).toBeNull();
    expect(localStorage.getItem('ganttAppSnapshots')).toBeNull();
    expect(localStorage.getItem('gantt-theme')).toBe('dark'); // a preference, not project data
  });

  // Guard: cannot be red on code without the function.
  it('changes nothing for ids it does not hold', async () => {
    const before = [localStorage.getItem('ganttAppData'), localStorage.getItem('ganttAppSnapshots')];
    await removeCopies(['nope']);
    expect([localStorage.getItem('ganttAppData'), localStorage.getItem('ganttAppSnapshots')]).toEqual(before);
  });
});
