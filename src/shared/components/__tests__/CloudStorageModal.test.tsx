// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// CloudStorageModal tests — three reachable states + dismissal + sign-out routing.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CloudStorageModal } from '../CloudStorageModal';
import { LIGHT_THEME } from '../../utils/theme';
import type { User } from 'firebase/auth';
import type { AppData } from '../../types/app';

const mockUseAuth = vi.fn();
const mockUseStorage = vi.fn();
const mockUseAppData = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
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

// Hook mock — exercise it independently in useSignInWithTosGate.test.tsx.
const mockSignIn = vi.fn();
const mockOnTosAccept = vi.fn();
const mockOnTosCancel = vi.fn();
let mockGateState: {
  authError: string | null;
  tosModalOpen: boolean;
} = { authError: null, tosModalOpen: false };

vi.mock('../../hooks/useSignInWithTosGate', () => ({
  useSignInWithTosGate: () => ({
    authError: mockGateState.authError,
    setAuthError: vi.fn(),
    signIn: mockSignIn,
    tosModalOpen: mockGateState.tosModalOpen,
    onTosAccept: mockOnTosAccept,
    onTosCancel: mockOnTosCancel,
  }),
}));

const emptyAppData: AppData = { projects: [], releases: [] };

function setup({
  open = true,
  user = null,
  mode = 'local',
  performSignOutWithCleanup = vi.fn().mockResolvedValue(undefined),
  switchMode = vi.fn().mockResolvedValue(undefined),
  data = emptyAppData,
  needsCloudToLocalPrompt = null,
  authError = null,
  tosModalOpen = false,
}: {
  open?: boolean;
  user?: User | null;
  mode?: 'local' | 'cloud';
  performSignOutWithCleanup?: () => Promise<void>;
  switchMode?: ReturnType<typeof vi.fn>;
  data?: AppData;
  needsCloudToLocalPrompt?: { projectCount: number } | null;
  authError?: string | null;
  tosModalOpen?: boolean;
} = {}) {
  mockUseAuth.mockReturnValue({ user });
  mockUseStorage.mockReturnValue({
    storage: {} as never,
    mode,
    switchMode,
    isSwitching: false,
    uploadResult: null,
    clearUploadResult: vi.fn(),
    performSignOutWithCleanup,
    needsCloudToLocalPrompt,
    confirmKeepLocalCopy: vi.fn().mockResolvedValue(undefined),
    confirmDiscardCloudData: vi.fn().mockResolvedValue(undefined),
  });
  mockUseAppData.mockReturnValue({
    data,
    exportAttribution: undefined,
    setExportAttribution: vi.fn(),
  });
  mockUseTheme.mockReturnValue({ colors: LIGHT_THEME });
  mockGateState = { authError, tosModalOpen };
  return {
    onClose: vi.fn(),
    performSignOutWithCleanup,
    switchMode,
    open,
  };
}

describe('CloudStorageModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignIn.mockReset();
  });

  describe('open=false', () => {
    it('renders nothing when open is false', () => {
      const ctx = setup({ open: false });
      const { container } = render(<CloudStorageModal open={false} onClose={ctx.onClose} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('always-visible elements', () => {
    it('renders title "Cloud Storage"', () => {
      const ctx = setup();
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText('Cloud Storage')).toBeInTheDocument();
    });

    it('renders Storage radios with Local and Cloud labels', () => {
      const ctx = setup();
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText('Local')).toBeInTheDocument();
      expect(screen.getByText(/browser only/)).toBeInTheDocument();
      expect(screen.getByText('Cloud')).toBeInTheDocument();
      expect(screen.getByText(/sync across devices/)).toBeInTheDocument();
    });

    it('renders Export Attribution and Notifications sections', () => {
      const ctx = setup();
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText('Export Attribution')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  describe('State 1: signed out + local', () => {
    it('renders sign-in helper text and both provider buttons', () => {
      const ctx = setup({ user: null, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText('Sign in to enable cloud storage and sharing.')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Microsoft')).toBeInTheDocument();
    });

    it('Cloud radio is disabled', () => {
      const ctx = setup({ user: null, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      const cloudRadio = screen.getByDisplayValue('cloud') as HTMLInputElement;
      expect(cloudRadio.disabled).toBe(true);
    });

    it('does NOT render the "Keep using local storage" button', () => {
      const ctx = setup({ user: null, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.queryByText('Keep using local storage')).not.toBeInTheDocument();
    });

    it('clicking Google sign-in button calls gate.signIn("google")', () => {
      const ctx = setup({ user: null, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      fireEvent.click(screen.getByText('Sign in with Google'));
      expect(mockSignIn).toHaveBeenCalledWith('google');
    });

    it('clicking Microsoft sign-in button calls gate.signIn("microsoft")', () => {
      const ctx = setup({ user: null, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      fireEvent.click(screen.getByText('Sign in with Microsoft'));
      expect(mockSignIn).toHaveBeenCalledWith('microsoft');
    });

    it('renders authError below the button row when present', () => {
      const ctx = setup({
        user: null,
        mode: 'local',
        authError: 'Allow pop-ups in your browser to sign in.',
      });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText('Allow pop-ups in your browser to sign in.')).toBeInTheDocument();
    });
  });

  describe('State 2: signed in + local', () => {
    const user = { uid: 'u1', displayName: 'William Davis', email: 'w@example.com' } as User;

    it('renders identity card with normalized display name', () => {
      const ctx = setup({ user, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText('William Davis')).toBeInTheDocument();
      expect(screen.getByText('w@example.com')).toBeInTheDocument();
    });

    it('Microsoft "Last, First" displayName is normalized to "First Last"', () => {
      const msUser = { ...user, displayName: 'Davis, William W' } as User;
      const ctx = setup({ user: msUser, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText('William W Davis')).toBeInTheDocument();
    });

    it('renders Cloud radio enabled', () => {
      const ctx = setup({ user, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      const cloudRadio = screen.getByDisplayValue('cloud') as HTMLInputElement;
      expect(cloudRadio.disabled).toBe(false);
    });

    it('renders the "Keep using local storage" secondary button', () => {
      const ctx = setup({ user, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText('Keep using local storage')).toBeInTheDocument();
    });

    it('clicking "Keep using local storage" calls onClose without storage mutation', () => {
      const ctx = setup({ user, mode: 'local' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      fireEvent.click(screen.getByText('Keep using local storage'));
      expect(ctx.onClose).toHaveBeenCalledTimes(1);
      expect(ctx.switchMode).not.toHaveBeenCalled();
    });
  });

  describe('State 3: signed in + cloud', () => {
    const user = { uid: 'u1', displayName: 'William Davis', email: 'w@example.com' } as User;

    it('renders Cloud radio checked', () => {
      const ctx = setup({ user, mode: 'cloud' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      const cloudRadio = screen.getByDisplayValue('cloud') as HTMLInputElement;
      expect(cloudRadio.checked).toBe(true);
    });

    it('renders identity card', () => {
      const ctx = setup({ user, mode: 'cloud' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText('William Davis')).toBeInTheDocument();
    });

    it('does NOT render the "Keep using local storage" button', () => {
      const ctx = setup({ user, mode: 'cloud' });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.queryByText('Keep using local storage')).not.toBeInTheDocument();
    });

    it('clicking Local radio calls switchMode("local", projectCount)', () => {
      const ctx = setup({
        user,
        mode: 'cloud',
        data: { projects: [{ id: 'p1', name: 'P' }, { id: 'p2', name: 'Q' }], releases: [] },
      });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      const localRadio = screen.getByDisplayValue('local') as HTMLInputElement;
      fireEvent.click(localRadio);
      expect(ctx.switchMode).toHaveBeenCalledWith('local', 2);
    });

    it('renders cloud→local keep/discard prompt when needsCloudToLocalPrompt is set', () => {
      const ctx = setup({
        user,
        mode: 'cloud',
        needsCloudToLocalPrompt: { projectCount: 4 },
      });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      expect(screen.getByText(/Keep a local copy of your/)).toBeInTheDocument();
      expect(screen.getByText('Keep Local Copy')).toBeInTheDocument();
      expect(screen.getByText('Discard')).toBeInTheDocument();
    });
  });

  describe('Sign-out flow', () => {
    const user = { uid: 'u1', displayName: 'William', email: 'w@example.com' } as User;

    it('clicking Sign out routes through performSignOutWithCleanup and closes', async () => {
      const performSignOutWithCleanup = vi.fn().mockResolvedValue(undefined);
      const ctx = setup({ user, mode: 'cloud', performSignOutWithCleanup });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Sign out'));
      });
      expect(performSignOutWithCleanup).toHaveBeenCalledTimes(1);
      expect(ctx.onClose).toHaveBeenCalledTimes(1);
    });

    it('Sign out shows error and does NOT close on failure', async () => {
      const performSignOutWithCleanup = vi.fn().mockRejectedValue(new Error('boom'));
      const ctx = setup({ user, mode: 'cloud', performSignOutWithCleanup });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      await act(async () => {
        fireEvent.click(screen.getByText('Sign out'));
      });
      expect(ctx.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Dismissal — Escape key', () => {
    it('Escape calls onClose when no async operation is in progress', () => {
      const ctx = setup();
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(ctx.onClose).toHaveBeenCalledTimes(1);
    });

    it('Escape is suppressed when ToS modal is open', () => {
      const ctx = setup({ tosModalOpen: true });
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(ctx.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Dismissal — backdrop click', () => {
    it('clicking the backdrop (not the card) calls onClose', () => {
      const ctx = setup();
      const { container } = render(<CloudStorageModal open onClose={ctx.onClose} />);
      const backdrop = container.firstChild as HTMLElement;
      fireEvent.mouseDown(backdrop);
      expect(ctx.onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking inside the card does NOT call onClose', () => {
      const ctx = setup();
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      // Click on the title — well inside the card.
      fireEvent.mouseDown(screen.getByText('Cloud Storage'));
      expect(ctx.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Dismissal — × close button', () => {
    it('clicking × calls onClose', () => {
      const ctx = setup();
      render(<CloudStorageModal open onClose={ctx.onClose} />);
      fireEvent.click(screen.getByLabelText('Close'));
      expect(ctx.onClose).toHaveBeenCalledTimes(1);
    });
  });
});
