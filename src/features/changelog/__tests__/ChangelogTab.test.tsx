import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChangelogTab } from '../ChangelogTab';

describe('ChangelogTab', () => {
  it('renders without crashing', () => {
    const { container } = render(<ChangelogTab />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the Changelog heading', () => {
    render(<ChangelogTab />);
    expect(screen.getByText('Changelog')).toBeTruthy();
  });

  it('renders Version 5.2 entry', () => {
    render(<ChangelogTab />);
    expect(screen.getByText(/Version 5\.2/)).toBeTruthy();
  });

  it('renders Version 5.1 entry', () => {
    render(<ChangelogTab />);
    expect(screen.getByText(/Version 5\.1/)).toBeTruthy();
  });

  it('renders versions in reverse chronological order', () => {
    const { container } = render(<ChangelogTab />);
    const headings = container.querySelectorAll('h3');
    const versionTexts = Array.from(headings).map(h => h.textContent);

    // First version heading should be 5.2, second 5.1, etc.
    expect(versionTexts[0]).toContain('5.2');
    expect(versionTexts[1]).toContain('5.1');
    // Last should be 1.0
    expect(versionTexts[versionTexts.length - 1]).toContain('1.0');
  });
});
