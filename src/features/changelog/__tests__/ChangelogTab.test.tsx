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

  /**
   * This used to be 29 hardcoded `versionTexts[N]).toContain('0.27.x')` assertions
   * whose own comment said the list "must be shifted by one on every release" —
   * so adding a changelog entry failed the suite until someone renumbered by hand.
   *
   * It is now expressed as the property those assertions were approximating: the
   * component renders exactly one heading per entry, in the data's order. That
   * needs no maintenance, and it is strictly stronger — it covers all 101 entries
   * rather than the first 28 and the last one.
   *
   * The ordering of the data itself is asserted separately below, including the
   * deliberate v0.20.0 → v19.0.0 renumbering boundary. Keep both: this one proves
   * the component does not drop or reorder what the data gives it, which is the
   * one property no other repo in the suite currently verifies at all.
   */
  it('renders one heading per entry, in the same order as the data', () => {
    const { container } = render(<ChangelogTab />, { wrapper: ThemeWrapper });
    const rendered = Array.from(container.querySelectorAll('h3')).map(h => h.textContent ?? '');

    expect(
      rendered.length,
      `${CHANGELOG_ENTRIES.length} entries in the data but ${rendered.length} headings rendered`,
    ).toBe(CHANGELOG_ENTRIES.length);

    const mismatched = CHANGELOG_ENTRIES.map((entry, i) => ({ entry, text: rendered[i] ?? '' }))
      .filter(({ entry, text }) => !text.includes(entry.version))
      .map(({ entry, text }, i) => `position ${i}: expected ${entry.version}, rendered "${text}"`);

    expect(mismatched, mismatched.join('; ')).toEqual([]);
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
