// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { screenHeading } from '../screenHeading';

// The page's h1 on each screen (FRAME26, contract §7, v0.34.0).
describe('screenHeading', () => {
  it('Releases and the Gantt Chart are named after the selected project, with the full name in title', () => {
    const long = 'A project name long enough to be cut short with an ellipsis in the heading row';
    expect(screenHeading('releases', 'Mobile App Launch (Sample)')).toEqual({ text: 'Mobile App Launch (Sample)', title: 'Mobile App Launch (Sample)' });
    expect(screenHeading('chart', long)).toEqual({ text: long, title: long });
  });

  it('with no project to name, they take the tab\'s own name', () => {
    expect(screenHeading('releases', undefined)).toEqual({ text: 'Releases', title: 'Releases' });
    expect(screenHeading('chart', undefined)).toEqual({ text: 'Gantt Chart', title: 'Gantt Chart' });
    expect(screenHeading('chart', '')).toEqual({ text: 'Gantt Chart', title: 'Gantt Chart' });
  });

  it('every other screen has its fixed heading, whatever project is selected', () => {
    expect(screenHeading('projects', 'X').text).toBe('Projects');
    expect(screenHeading('settings', 'X').text).toBe('Settings');
    expect(screenHeading('about', 'X').text).toBe('About This App');
    expect(screenHeading('changelog', 'X').text).toBe('Changelog');
  });
});
