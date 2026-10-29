// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// CloudLoadNoticeBanner and its store (v0.29.10) — the notice names the
// project in which a cloud-load check set something aside, never the value;
// "Got it" closes it for the session; dispose (sign-out) forgets it.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CloudLoadNoticeBanner } from '../CloudLoadNoticeBanner';
import {
  noteCloudSetAside,
  clearCloudSetAsideNotices,
  getCloudSetAsideProjects,
} from '../../storage/cloud-load-notices';
import { LIGHT_THEME } from '../../utils/theme';

const mockUseAppData = vi.fn();

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: LIGHT_THEME, resolvedTheme: 'light' }),
}));
vi.mock('../../../context/AppDataContext', () => ({
  useAppData: () => mockUseAppData(),
}));

function setProjects(...projects: { id: string; name: string }[]) {
  mockUseAppData.mockReturnValue({ data: { projects, releases: [] } });
}

describe('CloudLoadNoticeBanner', () => {
  beforeEach(() => {
    clearCloudSetAsideNotices();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setProjects({ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows nothing when nothing was set aside', () => {
    const { container } = render(<CloudLoadNoticeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the project, and only the project', () => {
    render(<CloudLoadNoticeBanner />);
    act(() => noteCloudSetAside('p1', 'release-dates'));
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Some saved data could not be read in project “Alpha”.');
    expect(notice).not.toHaveTextContent('release-dates');
  });

  it('names each project once, in the order reported', () => {
    render(<CloudLoadNoticeBanner />);
    act(() => {
      noteCloudSetAside('p2', 'release-dates');
      noteCloudSetAside('p1', 'snapshot-shape');
      noteCloudSetAside('p2', 'release-hidden');
    });
    expect(screen.getByRole('status')).toHaveTextContent('in projects “Beta”, “Alpha”.');
  });

  it('logs the rule only, never the value or the project', () => {
    noteCloudSetAside('p1', 'project-finish-date');
    expect(console.warn).toHaveBeenCalledExactlyOnceWith('[GanttApp] cloud-load-guard: project-finish-date');
  });

  it('does not name a project that is no longer in the list', () => {
    setProjects({ id: 'p2', name: 'Beta' });
    noteCloudSetAside('p1', 'release-dates');
    const { container } = render(<CloudLoadNoticeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('closes on "Got it", and does not name that project again this session', () => {
    render(<CloudLoadNoticeBanner />);
    act(() => noteCloudSetAside('p1', 'release-dates'));
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => noteCloudSetAside('p1', 'release-dates'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    act(() => noteCloudSetAside('p2', 'release-dates'));
    expect(screen.getByRole('status')).toHaveTextContent('“Beta”');
  });

  it('forgets dismissed projects too when cleared at sign-out', () => {
    noteCloudSetAside('p1', 'release-dates');
    render(<CloudLoadNoticeBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    act(() => clearCloudSetAsideNotices());
    act(() => noteCloudSetAside('p1', 'release-dates'));
    expect(getCloudSetAsideProjects()).toStrictEqual(['p1']);
    expect(screen.getByRole('status')).toHaveTextContent('“Alpha”');
  });
});
