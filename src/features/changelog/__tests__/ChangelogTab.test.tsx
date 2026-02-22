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

    // First version heading should be 12.1, second 12.0, etc.
    expect(versionTexts[0]).toContain('12.1');
    expect(versionTexts[1]).toContain('12.0');
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
    const versions = CHANGELOG_ENTRIES.map(e => parseFloat(e.version));
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeLessThan(versions[i - 1]);
    }
  });

  it('each entry has at least one item', () => {
    for (const entry of CHANGELOG_ENTRIES) {
      expect(entry.items.length).toBeGreaterThan(0);
    }
  });
});
