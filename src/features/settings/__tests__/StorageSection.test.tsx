// StorageSection tests — validates radio buttons, upload/cleanup dialogs,
// auth UI, download button, and status messages (v12.1).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StorageSection } from '../StorageSection';
import { LIGHT_THEME } from '../../../shared/utils/theme';
import type { User } from 'firebase/auth';
import type { GanttStorageService } from '../../../shared/types/storage';

// Minimal mock user
const mockUser = {
  uid: 'user-1',
  displayName: 'Test User',
  email: 'test@example.com',
} as User;

// Minimal mock storage service
const mockStorage: GanttStorageService = {
  mode: 'local',
  loadAppData: vi.fn(),
  saveAppData: vi.fn(),
  loadSnapshots: vi.fn(),
  saveSnapshots: vi.fn(),
  addSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  deleteSnapshotsForProject: vi.fn(),
};

function renderSection(overrides: Record<string, unknown> = {}) {
  const defaultProps = {
    colors: LIGHT_THEME,
    mode: 'local' as const,
    isSwitching: false,
    switchError: null,
    isFirebaseAvailable: true,
    onModeChange: vi.fn(),
    user: null as User | null,
    isAuthenticated: false,
    authLoading: false,
    authError: null,
    onSignIn: vi.fn(),
    onSignOut: vi.fn(),
    uploadResult: null,
    onClearUploadResult: vi.fn(),
    needsUploadPrompt: null,
    onConfirmUploadPrompt: vi.fn(),
    onCancelUploadPrompt: vi.fn(),
    storage: mockStorage,
  };
  const props = { ...defaultProps, ...overrides };
  return render(<StorageSection {...props} />);
}

describe('StorageSection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // === Radio buttons ===

  it('renders Local and Cloud radio buttons', () => {
    renderSection();
    expect(screen.getByText('Local (browser only)')).toBeInTheDocument();
    expect(screen.getByText('Cloud (sync across devices)')).toBeInTheDocument();
  });

  it('has Local radio checked when mode is local', () => {
    renderSection({ mode: 'local' });
    const radios = screen.getAllByRole('radio');
    const localRadio = radios.find(r => (r as HTMLInputElement).value === 'local') as HTMLInputElement;
    expect(localRadio.checked).toBe(true);
  });

  it('has Cloud radio checked when mode is cloud', () => {
    renderSection({ mode: 'cloud', user: mockUser, isAuthenticated: true });
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;
    expect(cloudRadio.checked).toBe(true);
  });

  it('disables Cloud radio when user is null', () => {
    renderSection({ user: null });
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;
    expect(cloudRadio.disabled).toBe(true);
  });

  it('disables Cloud radio when isSwitching is true', () => {
    renderSection({ user: mockUser, isSwitching: true });
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;
    expect(cloudRadio.disabled).toBe(true);
  });

  it('disables Cloud radio when Firebase is unavailable', () => {
    renderSection({ isFirebaseAvailable: false, user: mockUser });
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;
    expect(cloudRadio.disabled).toBe(true);
  });

  // === Upload confirmation (radio-click flow) ===

  it('shows upload confirmation when clicking Cloud radio with local data', () => {
    // Simulate local data in localStorage
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [{ id: 'p1', name: 'Test' }] }));

    renderSection({ user: mockUser, isAuthenticated: true });
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;

    fireEvent.click(cloudRadio);

    expect(screen.getByText('Upload to Cloud')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onModeChange when clicking Cloud radio with no local data', () => {
    const onModeChange = vi.fn();
    renderSection({ user: mockUser, isAuthenticated: true, onModeChange });
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;

    fireEvent.click(cloudRadio);

    // No local data → switch directly
    expect(onModeChange).toHaveBeenCalledWith('cloud');
  });

  it('calls onModeChange when Upload to Cloud is clicked in upload confirmation', async () => {
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [{ id: 'p1', name: 'Test' }] }));
    const onModeChange = vi.fn();

    renderSection({ user: mockUser, isAuthenticated: true, onModeChange });

    // Click Cloud radio to show confirmation
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;
    fireEvent.click(cloudRadio);

    // Click Upload to Cloud
    await act(async () => {
      fireEvent.click(screen.getByText('Upload to Cloud'));
    });

    expect(onModeChange).toHaveBeenCalledWith('cloud');
  });

  it('dismisses dialog and stays in local mode when Cancel is clicked (v12.3 fix)', () => {
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [{ id: 'p1', name: 'Test' }] }));
    const onModeChange = vi.fn();

    renderSection({ user: mockUser, isAuthenticated: true, onModeChange });

    // Click Cloud radio to show confirmation
    const radios = screen.getAllByRole('radio');
    const cloudRadio = radios.find(r => (r as HTMLInputElement).value === 'cloud') as HTMLInputElement;
    fireEvent.click(cloudRadio);

    // Click Cancel — should NOT call onModeChange, should dismiss dialog
    fireEvent.click(screen.getByText('Cancel'));

    expect(onModeChange).not.toHaveBeenCalled();
    // Dialog should be dismissed
    expect(screen.queryByText('Upload to Cloud')).not.toBeInTheDocument();
  });

  // === Cleanup confirmation ===

  it('shows cleanup confirmation when uploadResult has data', () => {
    const onClearUploadResult = vi.fn();
    renderSection({
      uploadResult: { uploaded: 2, skipped: 0 },
      onClearUploadResult,
    });

    expect(screen.getByText(/Clear Local Data/)).toBeInTheDocument();
    expect(screen.getByText(/Keep Local Copies/)).toBeInTheDocument();
    expect(onClearUploadResult).toHaveBeenCalled();
  });

  it('shows status message with upload count', () => {
    renderSection({
      uploadResult: { uploaded: 3, skipped: 1 },
      onClearUploadResult: vi.fn(),
    });

    expect(screen.getByText(/3 project\(s\) uploaded to the cloud/)).toBeInTheDocument();
    expect(screen.getByText(/1 already existed, skipped/)).toBeInTheDocument();
  });

  it('clears local data when Clear Local Data is clicked', () => {
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [{ id: 'p1', name: 'Test' }] }));
    localStorage.setItem('ganttAppSnapshots', JSON.stringify([{ id: 's1' }]));

    renderSection({
      uploadResult: { uploaded: 1, skipped: 0 },
      onClearUploadResult: vi.fn(),
    });

    fireEvent.click(screen.getByText('Clear Local Data'));

    expect(localStorage.getItem('ganttAppData')).toBeNull();
    expect(localStorage.getItem('ganttAppSnapshots')).toBeNull();
  });

  it('dismisses cleanup dialog when Keep Local Copies is clicked', () => {
    renderSection({
      uploadResult: { uploaded: 1, skipped: 0 },
      onClearUploadResult: vi.fn(),
    });

    fireEvent.click(screen.getByText('Keep Local Copies'));

    // Dialog should be gone
    expect(screen.queryByText('Clear Local Data')).not.toBeInTheDocument();
  });

  // === Re-sign-in upload prompt ===

  it('renders re-sign-in upload prompt when needsUploadPrompt is set', () => {
    renderSection({ needsUploadPrompt: { projectCount: 5 } });
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/local project\(s\)/)).toBeInTheDocument();
  });

  it('calls onConfirmUploadPrompt when Upload button is clicked in re-sign-in prompt', () => {
    const onConfirmUploadPrompt = vi.fn();
    renderSection({
      needsUploadPrompt: { projectCount: 3 },
      onConfirmUploadPrompt,
    });

    fireEvent.click(screen.getByText('Upload to Cloud'));
    expect(onConfirmUploadPrompt).toHaveBeenCalledOnce();
  });

  it('calls onCancelUploadPrompt when Cancel is clicked in re-sign-in prompt (v12.3)', () => {
    const onCancelUploadPrompt = vi.fn();
    renderSection({
      needsUploadPrompt: { projectCount: 3 },
      onCancelUploadPrompt,
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancelUploadPrompt).toHaveBeenCalledOnce();
  });

  // === Auth UI ===

  it('shows sign-in buttons when not authenticated and Firebase available', () => {
    renderSection({ isFirebaseAvailable: true, isAuthenticated: false });
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Microsoft')).toBeInTheDocument();
  });

  it('does not show sign-in buttons when Firebase is unavailable', () => {
    renderSection({ isFirebaseAvailable: false });
    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
  });

  it('shows signed-in user card when authenticated', () => {
    renderSection({ isFirebaseAvailable: true, isAuthenticated: true, user: mockUser });
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('calls onSignIn with google when Google button is clicked', () => {
    const onSignIn = vi.fn();
    renderSection({ onSignIn });
    fireEvent.click(screen.getByText('Sign in with Google'));
    expect(onSignIn).toHaveBeenCalledWith('google');
  });

  it('calls onSignIn with microsoft when Microsoft button is clicked', () => {
    const onSignIn = vi.fn();
    renderSection({ onSignIn });
    fireEvent.click(screen.getByText('Sign in with Microsoft'));
    expect(onSignIn).toHaveBeenCalledWith('microsoft');
  });

  it('calls onSignOut when Sign Out button is clicked', () => {
    const onSignOut = vi.fn();
    renderSection({ isFirebaseAvailable: true, isAuthenticated: true, user: mockUser, onSignOut });
    fireEvent.click(screen.getByText('Sign Out'));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  // === Download All Projects ===

  it('shows Download button in cloud mode when authenticated', () => {
    renderSection({ mode: 'cloud', isAuthenticated: true, user: mockUser });
    expect(screen.getByText('Download All Projects as JSON')).toBeInTheDocument();
  });

  it('does not show Download button in local mode', () => {
    renderSection({ mode: 'local', isAuthenticated: true, user: mockUser });
    expect(screen.queryByText('Download All Projects as JSON')).not.toBeInTheDocument();
  });

  // === Error states ===

  it('renders switchError when present', () => {
    renderSection({ switchError: 'Something went wrong' });
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders authError when present', () => {
    renderSection({ authError: 'Sign-in failed' });
    expect(screen.getByText('Sign-in failed')).toBeInTheDocument();
  });

  it('shows switching indicator when isSwitching is true', () => {
    renderSection({ isSwitching: true });
    expect(screen.getByText('Switching storage mode...')).toBeInTheDocument();
  });

  it('shows Firebase unavailable message', () => {
    renderSection({ isFirebaseAvailable: false });
    expect(screen.getByText(/Firebase is not configured/)).toBeInTheDocument();
  });

  it('shows auth loading message when authLoading is true', () => {
    renderSection({ authLoading: true, isFirebaseAvailable: true });
    expect(screen.getByText('Loading authentication...')).toBeInTheDocument();
  });
});
