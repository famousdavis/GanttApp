// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, beforeEach } from 'vitest';
import { clearLocalProjectData } from '../local-gantt-storage-service';

describe('clearLocalProjectData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes ganttAppData from localStorage', () => {
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [], releases: [] }));
    clearLocalProjectData();
    expect(localStorage.getItem('ganttAppData')).toBeNull();
  });

  it('removes ganttAppSnapshots from localStorage', () => {
    localStorage.setItem('ganttAppSnapshots', JSON.stringify([{ id: 'snap1' }]));
    clearLocalProjectData();
    expect(localStorage.getItem('ganttAppSnapshots')).toBeNull();
  });

  it('preserves ganttapp-storage-mode', () => {
    localStorage.setItem('ganttapp-storage-mode', 'cloud');
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [] }));
    clearLocalProjectData();
    expect(localStorage.getItem('ganttapp-storage-mode')).toBe('cloud');
  });

  // v16.6: HAS_UPLOADED_KEY ('ganttapp-has-uploaded-to-cloud') removed
  // from the app entirely. No preservation test because no one writes it.

  it('preserves gantt-theme', () => {
    localStorage.setItem('gantt-theme', 'dark');
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [] }));
    clearLocalProjectData();
    expect(localStorage.getItem('gantt-theme')).toBe('dark');
  });

  it('does not throw when keys do not exist', () => {
    expect(() => clearLocalProjectData()).not.toThrow();
  });
});
