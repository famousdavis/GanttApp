// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// SettingsTab wiring tests — what the tab hands to its sections and what it does
// when the user signs in, signs out, changes storage mode or resets the work
// week. The auth, storage and app-data contexts it reads are mocked; the
// sign-in gate hook, the sections and the terms dialog are the real ones.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { SettingsTab } from '../SettingsTab';
import { ThemeWrapper } from '../../../test/ThemeWrapper';
import { TOS_VERSION } from '../../../lib/version';

const mockUseAuth = vi.fn();
const mockUseStorage = vi.fn();
const mockUseAppData = vi.fn();

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock('../../../context/StorageContext', () => ({
  useStorage: () => mockUseStorage(),
}));
vi.mock('../../../context/AppDataContext', () => ({
  useAppData: () => mockUseAppData(),
}));
vi.mock('../../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: true,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));
// With the contexts mocked nothing here should reach the Firebase SDK. Empty
// mocks make an accidental import fail loudly instead of loading it.
vi.mock('firebase/auth', () => ({}));
vi.mock('firebase/firestore', () => ({}));

const TOS_ACCEPTED_KEY = 'spert_tos_accepted_version';

const signedInUser = {
  uid: 'user-1',
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
} as User;

const threeProjects = [
  { id: 'p1', name: 'Alpha' },
  { id: 'p2', name: 'Beta' },
  { id: 'p3', name: 'Gamma' },
];

/** An error shaped like Firebase's: an Error with a `code` that sanitizeFirebaseError maps. */
function firebaseError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Firebase internals (${code}) for projects/p1`), { code });
}

const UNAVAILABLE_MESSAGE = 'Service temporarily unavailable. Please try again later.';

interface SetupOptions {
  user?: User | null;
  mode?: 'local' | 'cloud';
  projects?: { id: string; name: string }[];
  globalWorkDays?: number[];
  switchError?: string | null;
  signInWithGoogle?: ReturnType<typeof vi.fn>;
  performSignOutWithCleanup?: ReturnType<typeof vi.fn>;
}

function setup({
  user = null,
  mode = 'local',
  projects = [],
  globalWorkDays = [1, 2, 3, 4, 5],
  switchError = null,
  signInWithGoogle = vi.fn().mockResolvedValue(undefined),
  performSignOutWithCleanup = vi.fn().mockResolvedValue(undefined),
}: SetupOptions = {}) {
  const signInWithMicrosoft = vi.fn().mockResolvedValue(undefined);
  const switchMode = vi.fn().mockResolvedValue(undefined);
  const setGlobalWorkDays = vi.fn();
  mockUseAuth.mockReturnValue({
    user,
    isAuthenticated: user !== null,
    loading: false,
    signInWithGoogle,
    signInWithMicrosoft,
  });
  mockUseStorage.mockReturnValue({
    storage: {},
    mode,
    switchMode,
    isSwitching: false,
    switchError,
    saveError: null,
    uploadResult: null,
    clearUploadResult: vi.fn(),
    needsUploadPrompt: null,
    confirmUploadPrompt: vi.fn(),
    cancelUploadPrompt: vi.fn(),
    performSignOutWithCleanup,
    needsCloudToLocalPrompt: null,
    confirmKeepLocalCopy: vi.fn(),
    confirmDiscardCloudData: vi.fn(),
  });
  mockUseAppData.mockReturnValue({
    data: { projects, releases: [] },
    exportAttribution: undefined,
    setExportAttribution: vi.fn(),
    globalWorkDays,
    setGlobalWorkDays,
    solidBarLabel: '',
    setSolidBarLabel: vi.fn(),
    hatchedBarLabel: '',
    setHatchedBarLabel: vi.fn(),
    finishDateLabel: '',
    setFinishDateLabel: vi.fn(),
    mostLikelyLineLabel: '',
    setMostLikelyLineLabel: vi.fn(),
    inProgressLabel: '',
    setInProgressLabel: vi.fn(),
  });
  render(<SettingsTab />, { wrapper: ThemeWrapper });
  return { signInWithGoogle, signInWithMicrosoft, switchMode, setGlobalWorkDays, performSignOutWithCleanup };
}

const termsDialogHeading = () => screen.queryByRole('heading', { name: /Terms of Service & Privacy Policy/ });

async function click(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('SettingsTab wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('signing out', () => {
    it('shows a friendly message, not the raw error, when signing out fails', async () => {
      const ctx = setup({
        user: signedInUser,
        performSignOutWithCleanup: vi.fn().mockRejectedValue(firebaseError('unavailable')),
      });

      await click('Sign Out');

      expect(ctx.performSignOutWithCleanup).toHaveBeenCalledTimes(1);
      expect(screen.getByText(UNAVAILABLE_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByText(/Firebase internals/)).not.toBeInTheDocument();
    });

    it('clears the message from a failed sign-out when Sign Out is pressed again', async () => {
      const ctx = setup({
        user: signedInUser,
        performSignOutWithCleanup: vi.fn()
          .mockRejectedValueOnce(firebaseError('unavailable'))
          .mockResolvedValueOnce(undefined),
      });
      await click('Sign Out');
      expect(screen.getByText(UNAVAILABLE_MESSAGE)).toBeInTheDocument();

      await click('Sign Out');

      expect(ctx.performSignOutWithCleanup).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(UNAVAILABLE_MESSAGE)).not.toBeInTheDocument();
    });
  });

  describe('signing in', () => {
    it('opens the terms dialog instead of signing in when the terms have not been accepted', async () => {
      const ctx = setup();

      await click('Sign in with Google');

      expect(termsDialogHeading()).toBeInTheDocument();
      expect(ctx.signInWithGoogle).not.toHaveBeenCalled();
    });

    it('signs in with the chosen provider once the terms are accepted', async () => {
      const ctx = setup();
      await click('Sign in with Microsoft');
      expect(termsDialogHeading()).toBeInTheDocument();

      fireEvent.click(screen.getByRole('checkbox', { name: /I have read and agree/ }));
      await click('Enable Cloud Storage');

      expect(ctx.signInWithMicrosoft).toHaveBeenCalledTimes(1);
      expect(ctx.signInWithGoogle).not.toHaveBeenCalled();
      expect(termsDialogHeading()).not.toBeInTheDocument();
    });

    it('closes the terms dialog without signing in when it is cancelled', async () => {
      const ctx = setup();
      await click('Sign in with Google');
      expect(termsDialogHeading()).toBeInTheDocument();

      await click('Cancel');

      expect(termsDialogHeading()).not.toBeInTheDocument();
      expect(ctx.signInWithGoogle).not.toHaveBeenCalled();
    });

    it('shows the message from a failed sign-in', async () => {
      localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
      const ctx = setup({ signInWithGoogle: vi.fn().mockRejectedValue(firebaseError('auth/popup-blocked')) });

      await click('Sign in with Google');

      expect(ctx.signInWithGoogle).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Sign-in popup was blocked. Please allow popups for this site.')).toBeInTheDocument();
    });
  });

  describe('storage mode', () => {
    it('passes the number of projects in memory when switching to local storage', async () => {
      const ctx = setup({ user: signedInUser, mode: 'cloud', projects: threeProjects });

      await act(async () => {
        fireEvent.click(screen.getByRole('radio', { name: /Local \(browser only\)/ }));
      });

      expect(ctx.switchMode).toHaveBeenCalledTimes(1);
      expect(ctx.switchMode).toHaveBeenCalledWith('local', 3);
    });

    it('shows the error from a failed storage switch', () => {
      setup({ switchError: 'Could not reach the cloud. Your data is still in this browser.' });

      expect(screen.getByText('Could not reach the cloud. Your data is still in this browser.')).toBeInTheDocument();
    });
  });

  describe('work week', () => {
    it('Reset to default sets the work week to Monday through Friday', () => {
      const ctx = setup({ globalWorkDays: [0, 6] });

      fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));

      expect(ctx.setGlobalWorkDays).toHaveBeenCalledTimes(1);
      expect(ctx.setGlobalWorkDays).toHaveBeenCalledWith([1, 2, 3, 4, 5]);
    });
  });
});
