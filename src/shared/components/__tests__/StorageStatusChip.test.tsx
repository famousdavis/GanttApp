// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// StorageStatusChip tests — covers all four compound states:
//   (a) signed out + local  — "Local only / Sign in"
//   (b) signed out + cloud  — unreachable, collapses to (a)
//   (c) signed in + cloud   — avatar + name + cloud icon + account popover
//   (d) signed in + local   — avatar + name + lock icon + account popover (v16.6)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StorageStatusChip } from '../StorageStatusChip';
import { LIGHT_THEME } from '../../utils/theme';
import type { User } from 'firebase/auth';

// Mock the three consumed hooks directly — simpler than constructing a
// full provider tree with synthetic auth/storage state.
const mockUseStorage = vi.fn();
const mockUseAuth = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('../../../context/StorageContext', () => ({
  useStorage: () => mockUseStorage(),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

function setupMocks({
  mode = 'local',
  user = null,
  performSignOutWithCleanup = vi.fn().mockResolvedValue(undefined),
}: {
  mode?: 'local' | 'cloud';
  user?: User | null;
  performSignOutWithCleanup?: () => Promise<void>;
} = {}) {
  mockUseStorage.mockReturnValue({ mode, performSignOutWithCleanup });
  mockUseAuth.mockReturnValue({ user });
  mockUseTheme.mockReturnValue({ colors: LIGHT_THEME });
  return { performSignOutWithCleanup };
}

describe('StorageStatusChip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('state (a): signed out + local', () => {
    beforeEach(() => setupMocks({ mode: 'local', user: null }));

    it('renders "Local only" label and "Sign in" call-to-action', () => {
      render(<StorageStatusChip onSettingsClick={vi.fn()} />);
      expect(screen.getByText('Local only')).toBeInTheDocument();
      expect(screen.getByText('Sign in')).toBeInTheDocument();
    });

    it('clicking pill calls onSettingsClick', () => {
      const onSettingsClick = vi.fn();
      render(<StorageStatusChip onSettingsClick={onSettingsClick} />);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      expect(onSettingsClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('state (c): signed in + cloud', () => {
    const user = {
      uid: 'u1', displayName: 'William Davis', email: 'test@example.com',
    } as User;

    it('renders avatar + first name + cloud icon', () => {
      setupMocks({ mode: 'cloud', user });
      render(<StorageStatusChip onSettingsClick={vi.fn()} />);
      expect(screen.getByText('William')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    });

    it('Microsoft "Last, First" displayName produces first name via shared utility', () => {
      const msUser = { ...user, displayName: 'Davis, William' } as User;
      setupMocks({ mode: 'cloud', user: msUser });
      render(<StorageStatusChip onSettingsClick={vi.fn()} />);
      expect(screen.getByText('William')).toBeInTheDocument();
      expect(screen.queryByText('Davis,')).not.toBeInTheDocument();
    });

    it('clicking pill opens account popover with Sign Out and Cancel', () => {
      setupMocks({ mode: 'cloud', user });
      render(<StorageStatusChip onSettingsClick={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('state (d): signed in + local (v16.6 F2-d)', () => {
    const user = {
      uid: 'u1', displayName: 'William Davis', email: 'test@example.com',
    } as User;

    it('renders avatar + first name when mode=local and user is present', () => {
      setupMocks({ mode: 'local', user });
      render(<StorageStatusChip onSettingsClick={vi.fn()} />);
      expect(screen.getByText('William')).toBeInTheDocument();
      // The signed-in-local pill uses aria-label "Account menu" — same as
      // the signed-in-cloud pill. This proves we've left the signed-out
      // branch where aria-label would be "Sign in".
      expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    });

    it('Microsoft "Last, First" displayName works in local branch too', () => {
      const msUser = { ...user, displayName: 'Davis, William' } as User;
      setupMocks({ mode: 'local', user: msUser });
      render(<StorageStatusChip onSettingsClick={vi.fn()} />);
      expect(screen.getByText('William')).toBeInTheDocument();
    });

    it('clicking pill opens account popover with three buttons', () => {
      setupMocks({ mode: 'local', user });
      render(<StorageStatusChip onSettingsClick={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
      expect(screen.getByText('Switch to Cloud Storage')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('"Switch to Cloud Storage" calls onSettingsClick and does NOT call switchMode (ARCH-4)', () => {
      const onSettingsClick = vi.fn();
      const switchMode = vi.fn(); // shouldn't be called — but also not on the context in our mock
      mockUseStorage.mockReturnValue({
        mode: 'local',
        performSignOutWithCleanup: vi.fn(),
        switchMode, // included but must not be invoked
      });
      mockUseAuth.mockReturnValue({ user });
      mockUseTheme.mockReturnValue({ colors: LIGHT_THEME });

      render(<StorageStatusChip onSettingsClick={onSettingsClick} />);
      fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
      fireEvent.click(screen.getByText('Switch to Cloud Storage'));

      expect(onSettingsClick).toHaveBeenCalledTimes(1);
      expect(switchMode).not.toHaveBeenCalled();
    });

    it('"Sign Out" calls performSignOutWithCleanup', async () => {
      const performSignOutWithCleanup = vi.fn().mockResolvedValue(undefined);
      setupMocks({ mode: 'local', user, performSignOutWithCleanup });

      render(<StorageStatusChip onSettingsClick={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
      await act(async () => {
        fireEvent.click(screen.getByText('Sign Out'));
      });

      expect(performSignOutWithCleanup).toHaveBeenCalledTimes(1);
    });

    it('"Cancel" closes popover without calling any side effects', () => {
      const performSignOutWithCleanup = vi.fn();
      const onSettingsClick = vi.fn();
      setupMocks({ mode: 'local', user, performSignOutWithCleanup });

      render(<StorageStatusChip onSettingsClick={onSettingsClick} />);
      fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
      fireEvent.click(screen.getByText('Cancel'));

      // Popover gone
      expect(screen.queryByText('Switch to Cloud Storage')).not.toBeInTheDocument();
      expect(performSignOutWithCleanup).not.toHaveBeenCalled();
      // onSettingsClick was not called because the user cancelled.
      expect(onSettingsClick).not.toHaveBeenCalled();
    });
  });

  describe('state (b): signed out + cloud (unreachable, collapses to (a))', () => {
    it('renders the signed-out pill when user is null even if mode stored as cloud', () => {
      // This edge case was documented as "should not be reachable" in the
      // audit. With UX-1 + the performSignOutWithCleanup storage mode reset
      // this state is now effectively impossible post-sign-out. Still, if
      // it ever occurred, it should render safely.
      setupMocks({ mode: 'cloud', user: null });
      render(<StorageStatusChip onSettingsClick={vi.fn()} />);
      // Falls through to signed-out branch because isCloudSignedIn = false.
      expect(screen.getByText('Local only')).toBeInTheDocument();
    });
  });
});
