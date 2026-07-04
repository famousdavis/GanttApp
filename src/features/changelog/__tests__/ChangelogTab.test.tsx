// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChangelogTab } from '../ChangelogTab';
import { CHANGELOG_ENTRIES } from '../changelog-data';
import { ThemeWrapper } from '../../../test/ThemeWrapper';

describe('ChangelogTab', () => {
  it('renders without crashing', () => {
    const { container } = render(<ChangelogTab />, { wrapper: ThemeWrapper });
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the Changelog heading', () => {
    render(<ChangelogTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText('Changelog')).toBeTruthy();
  });

  it('renders Version 5.7 entry', () => {
    render(<ChangelogTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/Version 5\.7/)).toBeTruthy();
  });

  it('renders Version 5.6 entry', () => {
    render(<ChangelogTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/Version 5\.6/)).toBeTruthy();
  });

  it('renders versions in reverse chronological order', () => {
    const { container } = render(<ChangelogTab />, { wrapper: ThemeWrapper });
    const headings = container.querySelectorAll('h3');
    const versionTexts = Array.from(headings).map(h => h.textContent);

    // First version heading should be 0.27.8, then 0.27.7, then 0.27.6, then 0.27.5,
    // then 0.27.4, then 0.27.3, then 0.27.2, then 0.27.1, then 0.27.0, then 0.26.1,
    // then 0.26.0, then 0.25.0, then 0.24.0, then 0.23.1, then 0.23.0, then 0.22.2,
    // then 0.22.1, then 0.22.0, then 0.21.1, then 0.21.0, then 0.20.1, then 0.20.0 (renumbered)…
    expect(versionTexts[0]).toContain('0.27.8');
    expect(versionTexts[1]).toContain('0.27.7');
    expect(versionTexts[2]).toContain('0.27.6');
    expect(versionTexts[3]).toContain('0.27.5');
    expect(versionTexts[4]).toContain('0.27.4');
    expect(versionTexts[5]).toContain('0.27.3');
    expect(versionTexts[6]).toContain('0.27.2');
    expect(versionTexts[7]).toContain('0.27.1');
    expect(versionTexts[8]).toContain('0.27.0');
    expect(versionTexts[9]).toContain('0.26.1');
    expect(versionTexts[10]).toContain('0.26.0');
    expect(versionTexts[11]).toContain('0.25.0');
    expect(versionTexts[12]).toContain('0.24.0');
    expect(versionTexts[13]).toContain('0.23.1');
    expect(versionTexts[14]).toContain('0.23.0');
    expect(versionTexts[15]).toContain('0.22.2');
    expect(versionTexts[16]).toContain('0.22.1');
    expect(versionTexts[17]).toContain('0.22.0');
    expect(versionTexts[18]).toContain('0.21.1');
    expect(versionTexts[19]).toContain('0.21.0');
    expect(versionTexts[20]).toContain('0.20.1');
    expect(versionTexts[21]).toContain('0.20.0');
    // Last should be 1.0
    expect(versionTexts[versionTexts.length - 1]).toContain('1.0');
  });

  it('renders Version 11.0 entry', () => {
    render(<ChangelogTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/Version 11\.0/)).toBeTruthy();
  });

  it('renders Version 6.0 entry', () => {
    render(<ChangelogTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/Version 6\.0/)).toBeTruthy();
  });

  it('CHANGELOG_ENTRIES is sorted in reverse chronological order', () => {
    const compareVersions = (a: string, b: string): number => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    };
    const versionStrings = CHANGELOG_ENTRIES.map(e => e.version);
    for (let i = 1; i < versionStrings.length; i++) {
      // Skip the v0.20.0 → v19.0.0 boundary: deliberate renumbering to align
      // with SPERT Suite 0.x.x semver. See the v0.20.0 changelog entry.
      if (versionStrings[i - 1] === '0.20.0' && versionStrings[i] === '19.0.0') continue;
      expect(compareVersions(versionStrings[i], versionStrings[i - 1])).toBeLessThan(0);
    }
  });

  it('each entry has at least one item', () => {
    for (const entry of CHANGELOG_ENTRIES) {
      expect(entry.items.length).toBeGreaterThan(0);
    }
  });
});
