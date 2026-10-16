// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// CloudStorageModal sign-in errors, rendered with the REAL useSignInWithTosGate
// hook (CloudStorageModal.test.tsx mocks that hook for its whole file, so the
// modal's own error handling never runs there). The Google and Microsoft
// sign-in functions reject with coded Firebase errors, so each test can tell
// the modal's handling of a code apart from the generic message that
// sanitizeFirebaseError gives the same code.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CloudStorageModal } from '../CloudStorageModal';
import { LIGHT_THEME } from '../../utils/theme';
import { TOS_VERSION } from '../../../lib/version';
import type { AppData } from '../../types/app';

const mockSignInWithGoogle = vi.fn();
const mockSignInWithMicrosoft = vi.fn();
const mockUseStorage = vi.fn();
const mockUseAppData = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    signInWithGoogle: mockSignInWithGoogle,
    signInWithMicrosoft: mockSignInWithMicrosoft,
  }),
}));
vi.mock('../../../context/StorageContext', () => ({
  useStorage: () => mockUseStorage(),
}));
vi.mock('../../../context/AppDataContext', () => ({
  useAppData: () => mockUseAppData(),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));
vi.mock('../../../lib/firebase', () => ({
  isFirebaseAvailable: true,
}));

const emptyAppData: AppData = { projects: [], releases: [] };

/** An Error carrying a Firebase `code`, the way the Auth SDK rejects. */
function firebaseError(code: string): Error {
  return Object.assign(new Error(`Firebase: Error (${code}).`), { code });
}

function renderSignedOutModal() {
  render(<CloudStorageModal open onClose={vi.fn()} />);
  return screen.getByRole('dialog');
}

/** Click a sign-in button and let the rejected sign-in settle. */
async function clickAndSettle(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByText(label));
  });
}

describe('CloudStorageModal sign-in errors (real terms gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignInWithGoogle.mockReset();
    mockSignInWithMicrosoft.mockReset();
    localStorage.clear();
    // Terms already accepted at the current version, so a click signs in directly.
    localStorage.setItem('spert_tos_accepted_version', TOS_VERSION);
    mockUseStorage.mockReturnValue({
      storage: {} as never,
      mode: 'local',
      switchMode: vi.fn().mockResolvedValue(undefined),
      isSwitching: false,
      uploadResult: null,
      clearUploadResult: vi.fn(),
      performSignOutWithCleanup: vi.fn().mockResolvedValue(undefined),
      needsCloudToLocalPrompt: null,
      confirmKeepLocalCopy: vi.fn().mockResolvedValue(undefined),
      confirmDiscardCloudData: vi.fn().mockResolvedValue(undefined),
    });
    mockUseAppData.mockReturnValue({
      data: emptyAppData,
      exportAttribution: undefined,
      setExportAttribution: vi.fn(),
    });
    mockUseTheme.mockReturnValue({ colors: LIGHT_THEME });
  });

  it('shows no error when the user closes the Google sign-in popup', async () => {
    mockSignInWithGoogle.mockRejectedValue(firebaseError('auth/popup-closed-by-user'));
    const dialog = renderSignedOutModal();
    const textBefore = dialog.textContent;
    await clickAndSettle('Sign in with Google');
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    // The generic message the same code would otherwise get:
    expect(screen.queryByText('Sign-in was cancelled.')).not.toBeInTheDocument();
    expect(dialog.textContent).toBe(textBefore);
  });

  it('shows no error when a newer popup request cancels the Microsoft sign-in', async () => {
    mockSignInWithMicrosoft.mockRejectedValue(firebaseError('auth/cancelled-popup-request'));
    const dialog = renderSignedOutModal();
    const textBefore = dialog.textContent;
    await clickAndSettle('Sign in with Microsoft');
    expect(mockSignInWithMicrosoft).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('Another sign-in is already in progress. Please complete or cancel it first.')
    ).not.toBeInTheDocument();
    expect(dialog.textContent).toBe(textBefore);
  });

  it('asks the user to allow pop-ups when the browser blocks the sign-in popup', async () => {
    mockSignInWithGoogle.mockRejectedValue(firebaseError('auth/popup-blocked'));
    renderSignedOutModal();
    await clickAndSettle('Sign in with Google');
    expect(screen.getByText('Allow pop-ups in your browser to sign in.')).toBeInTheDocument();
    expect(
      screen.queryByText('Sign-in popup was blocked. Please allow popups for this site.')
    ).not.toBeInTheDocument();
  });

  it('shows the friendly message for any other sign-in error, not the raw error text', async () => {
    mockSignInWithMicrosoft.mockRejectedValue(firebaseError('auth/network-request-failed'));
    renderSignedOutModal();
    await clickAndSettle('Sign in with Microsoft');
    expect(
      screen.getByText('Network error. Please check your connection and try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Firebase: Error/)).not.toBeInTheDocument();
  });
});
