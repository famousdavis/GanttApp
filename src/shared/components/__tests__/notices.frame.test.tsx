// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The four app-wide notices in the frame's notices slot (FRAME26, contract §3 "Notices slot", v0.34.0): each is the
// frame's `.sf-notice` in its variant, with no ground, border, radius, padding, margin or text colour of its own (an
// inline value would beat the frame's), and only a "Got it" button takes the frame's 28 px `.sf-notice-dismiss`. The
// invitation's "×" and its sign-in buttons keep their own look.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FirstRunBanner } from '../FirstRunBanner';
import { LocalStorageWarningBanner } from '../LocalStorageWarningBanner';
import { CloudLoadNoticeBanner } from '../CloudLoadNoticeBanner';
import { InvitationBanner } from '../InvitationBanner';
import { noteCloudSetAside, clearCloudSetAsideNotices } from '../../storage/cloud-load-notices';
import { LIGHT_THEME } from '../../utils/theme';

const mockUseInvitationLanding = vi.fn();
vi.mock('../../../lib/feature-flags', () => ({ INVITATIONS_ENABLED: true }));
vi.mock('../../../lib/firebase', () => ({ auth: null, db: null, isFirebaseAvailable: false }));
vi.mock('../../hooks/useInvitationLanding', () => ({ useInvitationLanding: () => mockUseInvitationLanding() }));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ firebaseAvailable: true, signInWithGoogle: vi.fn(), signInWithMicrosoft: vi.fn() }),
}));
vi.mock('../../../context/AppDataContext', () => ({
  useAppData: () => ({ data: { projects: [{ id: 'p1', name: 'Alpha' }], releases: [] }, loading: false }),
}));
vi.mock('../../../context/ThemeContext', () => ({ useTheme: () => ({ colors: LIGHT_THEME, resolvedTheme: 'light' }) }));
vi.mock('../../../context/StorageContext', () => ({ useStorage: () => ({ mode: 'local' }) }));

/** The notice's own box: the frame's element, which must carry no look of its own. */
function expectFrameNotice(el: HTMLElement, variant: 'info' | 'caution' | 'success') {
  expect(el.className).toBe(`sf-notice sf-notice--${variant}`);
  expect(el.getAttribute('style'), 'the notice sets no inline style').toBeNull();
  // Nothing inside sets a ground, a border, a text colour or a margin of its own on the notice's text either,
  // except the invitation's own buttons and its own two extra lines (checked separately).
  for (const p of Array.from(el.querySelectorAll<HTMLElement>('p, a, strong'))) {
    expect(p.style.color, `${p.tagName} "${p.textContent?.slice(0, 30)}": inline colour`).toBe('');
  }
}

const dismissButtons = (root: ParentNode) => Array.from(root.querySelectorAll('.sf-notice-dismiss')).map((b) => b.textContent?.trim());

describe('the notices, in the frame', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCloudSetAsideNotices();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseInvitationLanding.mockReturnValue({ bannerState: 'idle', claimedProjectNames: [], dismiss: vi.fn() });
  });

  it('FirstRunBanner is an info notice; its "Got it" is the frame\'s, and its links take the notice\'s colour', () => {
    render(<FirstRunBanner />);
    const notice = screen.getByText(/SPERT® Suite web apps are free to use/).closest('div')!;
    expectFrameNotice(notice, 'info');
    expect(dismissButtons(notice)).toEqual(['Got it']);
    const gotIt = screen.getByRole('button', { name: 'Got it' });
    expect(gotIt).toHaveAttribute('type', 'button');
    expect(gotIt.getAttribute('style')).toBeNull();
    for (const a of Array.from(notice.querySelectorAll('a'))) expect(a.getAttribute('style'), a.textContent!).toBeNull();
  });

  it('LocalStorageWarningBanner is a caution notice with the frame\'s "Got it"', () => {
    render(<LocalStorageWarningBanner />);
    const notice = screen.getByText('Your data exists only in this browser').closest('div')!;
    expectFrameNotice(notice, 'caution');
    expect(dismissButtons(notice)).toEqual(['Got it']);
    expect(screen.getByRole('button', { name: 'Got it' }).getAttribute('style')).toBeNull();
  });

  it('CloudLoadNoticeBanner is a caution notice with the frame\'s "Got it", and keeps role="status"', () => {
    render(<CloudLoadNoticeBanner />);
    act(() => noteCloudSetAside('p1', 'release-dates'));
    const notice = screen.getByRole('status');
    expectFrameNotice(notice, 'caution');
    expect(dismissButtons(notice)).toEqual(['Got it']);
  });

  it('InvitationBanner before sign-in is an info notice at full width; "×" and the sign-in buttons keep their own look', () => {
    mockUseInvitationLanding.mockReturnValue({ bannerState: 'pre_auth', claimedProjectNames: [], dismiss: vi.fn() });
    render(<InvitationBanner />);
    const notice = screen.getByRole('status');
    expect(notice.className).toBe('sf-notice sf-notice--info');
    expect(notice.getAttribute('style'), 'no 512 px centred card, no ground of its own').toBeNull();
    expect(dismissButtons(notice)).toEqual([]);
    for (const name of ['Dismiss invitation banner', 'Sign in with Google', 'Sign in with Microsoft']) {
      const b = screen.getByRole('button', { name });
      expect(b.classList.contains('sf-notice-dismiss'), name).toBe(false);
      expect(b.getAttribute('style'), name).not.toBeNull();
    }
    // Its lines take the notice's text colour: no inline colour on its own text.
    for (const p of Array.from(notice.querySelectorAll<HTMLElement>('p')).slice(0, 2)) expect(p.style.color).toBe('');
  });

  it('InvitationBanner once claimed is a success notice; "×" keeps its own look', () => {
    mockUseInvitationLanding.mockReturnValue({ bannerState: 'claimed', claimedProjectNames: ['Alpha'], dismiss: vi.fn() });
    render(<InvitationBanner />);
    const notice = screen.getByRole('status');
    expectFrameNotice(notice, 'success');
    expect(dismissButtons(notice)).toEqual([]);
    expect(screen.getByRole('button', { name: 'Dismiss invitation banner' }).classList.contains('sf-notice-dismiss')).toBe(false);
  });
});
