// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// InvitationBanner tests — what each banner state renders, and the sign-in
// buttons. Sign-in runs through the real useSignInWithTosGate: only useAuth
// beneath it is mocked, so the consent dialog, the provider signed in after
// consent and the error message shown all come from the real gate. The
// landing hook is mocked so each test can set the banner state directly; its
// own behaviour is tested in useInvitationLanding.test.tsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InvitationBanner } from '../InvitationBanner';
import { LIGHT_THEME } from '../../utils/theme';
import { TOS_VERSION } from '../../../lib/version';
import type { InvitationBannerState } from '../../hooks/useInvitationLanding';

const mockUseInvitationLanding = vi.fn();
const mockUseAuth = vi.fn();
const mockUseAppData = vi.fn();
const mockUseTheme = vi.fn();
const mockDismiss = vi.fn();
const mockSignInWithGoogle = vi.fn();
const mockSignInWithMicrosoft = vi.fn();

vi.mock('../../../lib/feature-flags', () => ({
  INVITATIONS_ENABLED: true,
}));
vi.mock('../../../lib/firebase', () => ({
  isFirebaseAvailable: true,
}));
vi.mock('../../hooks/useInvitationLanding', () => ({
  useInvitationLanding: (opts: unknown) => mockUseInvitationLanding(opts),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock('../../../context/AppDataContext', () => ({
  useAppData: () => mockUseAppData(),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

const TOS_ACCEPTED_KEY = 'spert_tos_accepted_version';
const INVITED = "You've been invited to a GanttApp™ project";
const INSTRUCTION = 'Sign in with the email address that received this invitation.';
const UNAVAILABLE = 'Cloud sign-in is unavailable in this build.';
const TOS_HEADING = 'Terms of Service & Privacy Policy';
const GOOGLE = 'Sign in with Google';
const MICROSOFT = 'Sign in with Microsoft';
const DISMISS = 'Dismiss invitation banner';

function setLanding(bannerState: InvitationBannerState, claimedProjectNames: string[] = []) {
  mockUseInvitationLanding.mockReturnValue({ bannerState, claimedProjectNames, dismiss: mockDismiss });
}

function renderBanner({
  bannerState = 'pre_auth',
  claimedProjectNames = [],
  firebaseAvailable = true,
}: {
  bannerState?: InvitationBannerState;
  claimedProjectNames?: string[];
  firebaseAvailable?: boolean;
} = {}) {
  setLanding(bannerState, claimedProjectNames);
  mockUseAuth.mockReturnValue({
    firebaseAvailable,
    signInWithGoogle: mockSignInWithGoogle,
    signInWithMicrosoft: mockSignInWithMicrosoft,
  });
  return render(<InvitationBanner />);
}

// Sign-in is async; let the gate's promise chain settle inside act.
async function click(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

describe('InvitationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockSignInWithGoogle.mockResolvedValue(undefined);
    mockSignInWithMicrosoft.mockResolvedValue(undefined);
    mockUseAppData.mockReturnValue({ data: { projects: [], releases: [] }, loading: false });
    mockUseTheme.mockReturnValue({ colors: LIGHT_THEME, resolvedTheme: 'light' });
  });

  describe('idle', () => {
    it('renders nothing while there is no invitation activity', () => {
      const { container, rerender } = renderBanner({ bannerState: 'pre_auth' });
      expect(screen.getByRole('status')).toBeInTheDocument();

      setLanding('idle');
      rerender(<InvitationBanner />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('pre_auth', () => {
    it('shows the invitation text with Google and Microsoft sign-in buttons', () => {
      renderBanner();
      expect(screen.getByText(INVITED)).toBeInTheDocument();
      expect(screen.getByText(INSTRUCTION)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: GOOGLE })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: MICROSOFT })).toBeInTheDocument();
      expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
    });

    it('says cloud sign-in is unavailable, with no sign-in buttons, when Firebase is not configured', () => {
      renderBanner({ firebaseAvailable: false });
      expect(screen.getByText(INVITED)).toBeInTheDocument();
      expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: GOOGLE })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: MICROSOFT })).not.toBeInTheDocument();
    });

    it('opens the consent dialog when Google is chosen before the current terms are accepted', async () => {
      renderBanner();
      await click(screen.getByRole('button', { name: GOOGLE }));
      expect(screen.getByText(TOS_HEADING)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enable Cloud Storage' })).toBeDisabled();
      expect(mockSignInWithGoogle).not.toHaveBeenCalled();
    });

    it('signs in with Microsoft straight away when the current terms are already accepted', async () => {
      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      renderBanner();
      await click(screen.getByRole('button', { name: MICROSOFT }));
      expect(mockSignInWithMicrosoft).toHaveBeenCalledTimes(1);
      expect(mockSignInWithGoogle).not.toHaveBeenCalled();
      expect(screen.queryByText(TOS_HEADING)).not.toBeInTheDocument();
    });

    it('shows a failed sign-in as the friendly message for its Firebase error code', async () => {
      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      mockSignInWithGoogle.mockRejectedValue(
        Object.assign(new Error('Firebase: Error (auth/popup-blocked).'), { code: 'auth/popup-blocked' }),
      );
      renderBanner();
      await click(screen.getByRole('button', { name: GOOGLE }));
      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
      expect(
        await screen.findByText('Sign-in popup was blocked. Please allow popups for this site.'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/auth\/popup-blocked/)).not.toBeInTheDocument();
    });

    it.each([
      { provider: 'Google', button: GOOGLE, chosen: mockSignInWithGoogle, other: mockSignInWithMicrosoft },
      { provider: 'Microsoft', button: MICROSOFT, chosen: mockSignInWithMicrosoft, other: mockSignInWithGoogle },
    ])('accepting the terms in the consent dialog signs in with $provider, the provider clicked', async ({ button, chosen, other }) => {
      renderBanner();
      await click(screen.getByRole('button', { name: button }));
      fireEvent.click(screen.getByRole('checkbox'));
      await click(screen.getByRole('button', { name: 'Enable Cloud Storage' }));
      expect(chosen).toHaveBeenCalledTimes(1);
      expect(other).not.toHaveBeenCalled();
      expect(screen.queryByText(TOS_HEADING)).not.toBeInTheDocument();
    });

    it('Cancel in the consent dialog closes it without signing in', async () => {
      renderBanner();
      await click(screen.getByRole('button', { name: GOOGLE }));
      expect(screen.getByText(TOS_HEADING)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByText(TOS_HEADING)).not.toBeInTheDocument();
      expect(screen.getByText(INVITED)).toBeInTheDocument();
      expect(mockSignInWithGoogle).not.toHaveBeenCalled();
      expect(localStorage.getItem(TOS_ACCEPTED_KEY)).toBeNull();
    });

    it('calls dismiss when the invitation prompt is closed', () => {
      renderBanner();
      fireEvent.click(screen.getByRole('button', { name: DISMISS }));
      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('claimed', () => {
    it('lists every claimed project, with the plural wording for more than one', () => {
      renderBanner({ bannerState: 'claimed', claimedProjectNames: ['Alpha', 'Beta'] });
      expect(screen.getByText("You've been added to: Alpha, Beta")).toBeInTheDocument();
      expect(screen.getByText('The projects should now appear in your project list.')).toBeInTheDocument();
    });

    it('uses the singular wording for one claimed project', () => {
      renderBanner({ bannerState: 'claimed', claimedProjectNames: ['Alpha'] });
      expect(screen.getByText("You've been added to: Alpha")).toBeInTheDocument();
      expect(screen.getByText('The project should now appear in your project list.')).toBeInTheDocument();
    });

    it('calls dismiss when the claimed banner is closed', () => {
      renderBanner({ bannerState: 'claimed', claimedProjectNames: ['Alpha'] });
      fireEvent.click(screen.getByRole('button', { name: DISMISS }));
      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('landing hook inputs', () => {
    // These inputs hold back the automatic switch to cloud storage while
    // app data is loading or the browser already holds local projects.
    it('hands the landing hook the in-memory project count and the app-data loading state', () => {
      const projects = [{ id: 'p1', name: 'Alpha' }, { id: 'p2', name: 'Beta' }];
      mockUseAppData.mockReturnValue({ data: { projects, releases: [] }, loading: true });
      const { rerender } = renderBanner();
      expect(mockUseInvitationLanding).toHaveBeenLastCalledWith({ localProjectCount: 2, appDataLoading: true });

      mockUseAppData.mockReturnValue({ data: { projects, releases: [] }, loading: false });
      rerender(<InvitationBanner />);
      expect(mockUseInvitationLanding).toHaveBeenLastCalledWith({ localProjectCount: 2, appDataLoading: false });
    });
  });
});
