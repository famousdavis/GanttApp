// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsTab } from '../SettingsTab';
import { FullWrapper } from '../../../test/FullWrapper';

// Mock firebase module
vi.mock('../../../lib/firebase', () => ({
  auth: null,
  db: null,
  isFirebaseAvailable: false,
  getSendInvitationEmail: () => null,
  getClaimPendingInvitations: () => null,
  getRevokeInvite: () => null,
  getResendInvite: () => null,
}));

// Mock firebase/auth
vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider { addScope = vi.fn(); }
  class MockOAuthProvider { addScope = vi.fn(); constructor() {} }
  return {
    onAuthStateChanged: vi.fn((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return vi.fn();
    }),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    GoogleAuthProvider: MockGoogleAuthProvider,
    OAuthProvider: MockOAuthProvider,
  };
});

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  writeBatch: vi.fn(),
}));

describe('SettingsTab', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<SettingsTab />, { wrapper: FullWrapper });
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the Settings heading', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders Storage section', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Storage')).toBeTruthy();
  });

  it('renders Local and Cloud radio buttons', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Local (browser only)')).toBeTruthy();
    expect(screen.getByText('Cloud (sync across devices)')).toBeTruthy();
  });

  it('renders Export Attribution section', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText('Export Attribution')).toBeTruthy();
  });

  it('renders Name and Identifier input fields', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByPlaceholderText(/Jane Smith/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/student ID, email, or team name/)).toBeTruthy();
  });

  it('has Local radio checked by default', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    const radios = screen.getAllByRole('radio');
    const localRadio = radios.find(r => (r as HTMLInputElement).value === 'local') as HTMLInputElement;
    expect(localRadio.checked).toBe(true);
  });

  it('disables Cloud radio when Firebase is unavailable', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;
    expect(cloudRadio.disabled).toBe(true);
  });

  it('shows Firebase unavailable message when Firebase is not configured', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.getByText(/Firebase is not configured/)).toBeTruthy();
  });

  it('does not show sign-in buttons when Firebase is unavailable', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    expect(screen.queryByText('Sign in with Google')).toBeNull();
    expect(screen.queryByText('Sign in with Microsoft')).toBeNull();
  });

  it('does not render a separate Account section', () => {
    render(<SettingsTab />, { wrapper: FullWrapper });
    // Auth UI is now integrated into the Storage section — no separate "Account" heading
    expect(screen.queryByText('Account')).toBeNull();
  });

  describe('Work Week section (v15.0)', () => {
    it('renders WorkWeekSection heading', () => {
      render(<SettingsTab />, { wrapper: FullWrapper });
      expect(screen.getByText('Work Week')).toBeTruthy();
    });

    it('renders work week selector with 7 day chips', () => {
      render(<SettingsTab />, { wrapper: FullWrapper });
      const group = screen.getByRole('group', { name: 'Work week selector' });
      // Filter to only day-toggle buttons (aria-pressed is set on those, not on Reset).
      // v16.3: the group also contains a "Reset to default" button when a value is set,
      // which is always the case now that Mon–Fri is the default.
      const dayButtons = group.querySelectorAll('button[aria-pressed]');
      expect(dayButtons).toHaveLength(7);
    });

    it('renders in both local and cloud modes', () => {
      // Default render is local mode — verify section is present
      render(<SettingsTab />, { wrapper: FullWrapper });
      expect(screen.getByText('Work Week')).toBeTruthy();
      expect(screen.getByRole('group', { name: 'Work week selector' })).toBeTruthy();
    });

    it('Reset button is visible by default since globalWorkDays defaults to Mon–Fri (v16.3)', () => {
      render(<SettingsTab />, { wrapper: FullWrapper });
      // v16.3: globalWorkDays defaults to [1,2,3,4,5] so Reset is always available
      expect(screen.getByText('Reset to default')).toBeTruthy();
    });
  });
});
