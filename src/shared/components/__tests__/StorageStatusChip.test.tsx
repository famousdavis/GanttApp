// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// StorageStatusChip tests — v17.0 contract:
//   The chip is purely a click target. All three variants route to a single
//   `onOpenModal` callback. Sign-in/sign-out logic moved into CloudStorageModal.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StorageStatusChip } from '../StorageStatusChip';
import { LIGHT_THEME } from '../../utils/theme';
import type { User } from 'firebase/auth';

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
}: {
  mode?: 'local' | 'cloud';
  user?: User | null;
} = {}) {
  mockUseStorage.mockReturnValue({ mode });
  mockUseAuth.mockReturnValue({ user });
  mockUseTheme.mockReturnValue({ colors: LIGHT_THEME });
}

describe('StorageStatusChip (v17.0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signed out + local', () => {
    beforeEach(() => setupMocks({ mode: 'local', user: null }));

    it('renders "Local only" label and "Sign in" call-to-action', () => {
      render(<StorageStatusChip onOpenModal={vi.fn()} />);
      expect(screen.getByText('Local only')).toBeInTheDocument();
      expect(screen.getByText('Sign in')).toBeInTheDocument();
    });

    it('clicking pill calls onOpenModal', () => {
      const onOpenModal = vi.fn();
      render(<StorageStatusChip onOpenModal={onOpenModal} />);
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
      expect(onOpenModal).toHaveBeenCalledTimes(1);
    });
  });

  describe('signed in + cloud', () => {
    const user = {
      uid: 'u1', displayName: 'William Davis', email: 'test@example.com',
    } as User;

    it('renders avatar + first name + cloud icon', () => {
      setupMocks({ mode: 'cloud', user });
      render(<StorageStatusChip onOpenModal={vi.fn()} />);
      expect(screen.getByText('William')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    });

    it('Microsoft "Last, First" displayName produces first name via shared utility', () => {
      const msUser = { ...user, displayName: 'Davis, William' } as User;
      setupMocks({ mode: 'cloud', user: msUser });
      render(<StorageStatusChip onOpenModal={vi.fn()} />);
      expect(screen.getByText('William')).toBeInTheDocument();
      expect(screen.queryByText('Davis,')).not.toBeInTheDocument();
    });

    it('clicking pill calls onOpenModal (no inline popover)', () => {
      setupMocks({ mode: 'cloud', user });
      const onOpenModal = vi.fn();
      render(<StorageStatusChip onOpenModal={onOpenModal} />);
      fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
      expect(onOpenModal).toHaveBeenCalledTimes(1);
      // v17.0: no popover content rendered inside the chip itself.
      expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
    });
  });

  describe('signed in + local (v16.6 F2-d, v17.0 routing)', () => {
    const user = {
      uid: 'u1', displayName: 'William Davis', email: 'test@example.com',
    } as User;

    it('renders avatar + first name when mode=local and user is present', () => {
      setupMocks({ mode: 'local', user });
      render(<StorageStatusChip onOpenModal={vi.fn()} />);
      expect(screen.getByText('William')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    });

    it('Microsoft "Last, First" displayName works in local branch too', () => {
      const msUser = { ...user, displayName: 'Davis, William' } as User;
      setupMocks({ mode: 'local', user: msUser });
      render(<StorageStatusChip onOpenModal={vi.fn()} />);
      expect(screen.getByText('William')).toBeInTheDocument();
    });

    it('clicking pill calls onOpenModal', () => {
      setupMocks({ mode: 'local', user });
      const onOpenModal = vi.fn();
      render(<StorageStatusChip onOpenModal={onOpenModal} />);
      fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
      expect(onOpenModal).toHaveBeenCalledTimes(1);
      // v17.0: no popover content rendered inside the chip itself.
      expect(screen.queryByText('Switch to Cloud Storage')).not.toBeInTheDocument();
      expect(screen.queryByText('Sign Out')).not.toBeInTheDocument();
    });
  });

  describe('signed out + cloud (unreachable, collapses to signed-out)', () => {
    it('renders the signed-out pill when user is null even if mode stored as cloud', () => {
      setupMocks({ mode: 'cloud', user: null });
      render(<StorageStatusChip onOpenModal={vi.fn()} />);
      expect(screen.getByText('Local only')).toBeInTheDocument();
    });
  });
});
