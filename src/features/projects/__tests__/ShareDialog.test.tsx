// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { ShareDialog } from '../ShareDialog';
import { ThemeWrapper } from '../../../test/ThemeWrapper';
import type { CloudGanttStorageService } from '../../../shared/storage';

// Create a mock cloud storage service
function createMockCloudStorage(overrides?: Partial<CloudGanttStorageService>): CloudGanttStorageService {
  return {
    mode: 'cloud',
    loadAppData: vi.fn().mockResolvedValue(null),
    saveAppData: vi.fn().mockResolvedValue(undefined),
    loadSnapshots: vi.fn().mockResolvedValue([]),
    saveSnapshots: vi.fn().mockResolvedValue(undefined),
    subscribeToProject: vi.fn().mockReturnValue(vi.fn()),
    removeCollaborator: vi.fn().mockResolvedValue(undefined),
    getProjectMembers: vi.fn().mockResolvedValue([
      { uid: 'owner-uid', role: 'owner', email: 'owner@example.com' },
    ]),
    listPendingInvites: vi.fn().mockResolvedValue([]),
    revokeInvite: vi.fn().mockResolvedValue(undefined),
    resendInvite: vi.fn().mockResolvedValue(undefined),
    flushPendingWrites: vi.fn().mockResolvedValue(undefined),
    cancelPendingSaves: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as unknown as CloudGanttStorageService;
}

const OWNER = { uid: 'u1', role: 'owner' as const, email: 'owner@test.com' };
const EDITOR = { uid: 'u2', role: 'editor' as const, email: 'editor@test.com' };

function renderDialog(cloudStorage: CloudGanttStorageService) {
  return render(
    <ShareDialog projectId="p1" projectName="Test" cloudStorage={cloudStorage} onClose={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );
}

describe('ShareDialog', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', async () => {
    const mockStorage = createMockCloudStorage();
    render(
      <ShareDialog
        projectId="p1"
        projectName="Test Project"
        cloudStorage={mockStorage}
        onClose={mockOnClose}
      />,
      { wrapper: ThemeWrapper }
    );
    expect(screen.getByText('Share Project')).toBeTruthy();
  });

  it('displays the project name', () => {
    const mockStorage = createMockCloudStorage();
    render(
      <ShareDialog
        projectId="p1"
        projectName="My Project"
        cloudStorage={mockStorage}
        onClose={mockOnClose}
      />,
      { wrapper: ThemeWrapper }
    );
    expect(screen.getByText('My Project')).toBeTruthy();
  });

  it('loads and displays members', async () => {
    const mockStorage = createMockCloudStorage({
      getProjectMembers: vi.fn().mockResolvedValue([
        { uid: 'u1', role: 'owner', email: 'owner@test.com' },
        { uid: 'u2', role: 'editor', email: 'editor@test.com' },
      ]),
    });

    render(
      <ShareDialog
        projectId="p1"
        projectName="Test"
        cloudStorage={mockStorage}
        onClose={mockOnClose}
      />,
      { wrapper: ThemeWrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('owner@test.com')).toBeTruthy();
      expect(screen.getByText('editor@test.com')).toBeTruthy();
    });
  });

  it('shows bulk email textarea and role selector (flag-on, v18.0.0)', () => {
    const mockStorage = createMockCloudStorage();
    render(
      <ShareDialog
        projectId="p1"
        projectName="Test"
        cloudStorage={mockStorage}
        onClose={mockOnClose}
      />,
      { wrapper: ThemeWrapper }
    );
    // INVITATIONS_ENABLED=true: bulk textarea replaces single-email input.
    expect(screen.getByPlaceholderText('alice@example.com, bob@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send Invitations' })).toBeTruthy();
  });

  it('shows Close button', () => {
    const mockStorage = createMockCloudStorage();
    render(
      <ShareDialog
        projectId="p1"
        projectName="Test"
        cloudStorage={mockStorage}
        onClose={mockOnClose}
      />,
      { wrapper: ThemeWrapper }
    );
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('does not show Remove button for owner', async () => {
    const mockStorage = createMockCloudStorage({
      getProjectMembers: vi.fn().mockResolvedValue([
        { uid: 'u1', role: 'owner', email: 'owner@test.com' },
      ]),
    });

    render(
      <ShareDialog
        projectId="p1"
        projectName="Test"
        cloudStorage={mockStorage}
        onClose={mockOnClose}
      />,
      { wrapper: ThemeWrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('owner@test.com')).toBeTruthy();
    });

    // Owner should not have a Remove button
    expect(screen.queryByRole('button', { name: 'Remove member' })).toBeNull();
  });

  it('shows Remove button for non-owner members', async () => {
    const mockStorage = createMockCloudStorage({
      getProjectMembers: vi.fn().mockResolvedValue([
        { uid: 'u1', role: 'owner', email: 'owner@test.com' },
        { uid: 'u2', role: 'editor', email: 'editor@test.com' },
      ]),
    });

    render(
      <ShareDialog
        projectId="p1"
        projectName="Test"
        cloudStorage={mockStorage}
        onClose={mockOnClose}
      />,
      { wrapper: ThemeWrapper }
    );

    await waitFor(() => {
      expect(screen.getByText('editor@test.com')).toBeTruthy();
    });

    // Non-owner should have a Remove button
    expect(screen.getByRole('button', { name: 'Remove member' })).toBeTruthy();
  });

  it('renders bulk send button — error path covered by mapInvitationError tests (flag-on, v18.0.0)', () => {
    // Pre-v18.0.0 the flag-off Share button drove the error path through
    // shareProject. v18.0.0 routes errors through mapInvitationError instead;
    // unit coverage lives in src/lib/__tests__/invitation-errors.test.ts. This
    // test only confirms the bulk send button is in the DOM and reachable.
    const mockStorage = createMockCloudStorage();
    render(
      <ShareDialog
        projectId="p1"
        projectName="Test"
        cloudStorage={mockStorage}
        onClose={mockOnClose}
      />,
      { wrapper: ThemeWrapper }
    );
    expect(screen.getByRole('button', { name: 'Send Invitations' })).toBeTruthy();
  });

  describe('when the members cannot be loaded', () => {
    it('replaces the invite form with a message asking for a refresh', async () => {
      // Driven by a rejected members load only. A project added in cloud mode
      // whose first save has not landed also reaches this message today; that
      // is a known defect and is deliberately not exercised here.
      const mockStorage = createMockCloudStorage({
        getProjectMembers: vi.fn().mockRejectedValue(new Error('Missing or insufficient permissions.')),
      });
      renderDialog(mockStorage);

      expect(await screen.findByText("Couldn't load sharing details. Refresh the page to try again.")).toBeInTheDocument();
      expect(screen.queryByLabelText('Email addresses')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Send Invitations' })).toBeNull();
    });
  });

  describe('removing a member', () => {
    /** Presses the member's Remove button and returns the confirm that opens. */
    async function openRemoveConfirm() {
      fireEvent.click(await screen.findByRole('button', { name: 'Remove member' }));
      return screen.getByRole('dialog', { name: 'Remove Member' });
    }

    it('removes the member after the confirm, then shows the refreshed member list', async () => {
      const getProjectMembers = vi.fn()
        .mockResolvedValueOnce([OWNER, EDITOR])
        .mockResolvedValueOnce([OWNER]);
      const mockStorage = createMockCloudStorage({ getProjectMembers });
      renderDialog(mockStorage);

      const confirm = await openRemoveConfirm();
      expect(within(confirm).getByText('Remove this member from the project?')).toBeInTheDocument();
      fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));

      await waitFor(() => expect(mockStorage.removeCollaborator).toHaveBeenCalledWith('p1', 'u2'));
      await waitFor(() => expect(screen.queryByText('editor@test.com')).toBeNull());
      expect(screen.getByText('owner@test.com')).toBeInTheDocument();
      expect(getProjectMembers).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('dialog', { name: 'Remove Member' })).toBeNull();
    });

    it('keeps the member when the confirm is cancelled', async () => {
      const mockStorage = createMockCloudStorage({ getProjectMembers: vi.fn().mockResolvedValue([OWNER, EDITOR]) });
      renderDialog(mockStorage);

      const confirm = await openRemoveConfirm();
      expect(confirm).toBeInTheDocument();
      fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog', { name: 'Remove Member' })).toBeNull();
      expect(mockStorage.removeCollaborator).not.toHaveBeenCalled();
      expect(screen.getByText('editor@test.com')).toBeInTheDocument();
    });

    it('shows the reason when removing the member fails', async () => {
      const mockStorage = createMockCloudStorage({
        getProjectMembers: vi.fn().mockResolvedValue([OWNER, EDITOR]),
        removeCollaborator: vi.fn().mockRejectedValue(new Error('Only the project owner can remove members.')),
      });
      renderDialog(mockStorage);

      fireEvent.click(within(await openRemoveConfirm()).getByRole('button', { name: 'Remove' }));

      expect(await screen.findByText('Only the project owner can remove members.')).toBeInTheDocument();
      expect(screen.getByText('editor@test.com')).toBeInTheDocument();
    });
  });

  describe('the member list', () => {
    it('shows a member with no known email by their user id', async () => {
      const mockStorage = createMockCloudStorage({
        getProjectMembers: vi.fn().mockResolvedValue([OWNER, { uid: 'uid-without-profile', role: 'viewer' }]),
      });
      renderDialog(mockStorage);

      expect(await screen.findByText('owner@test.com')).toBeInTheDocument();
      expect(screen.getByText('uid-without-profile')).toBeInTheDocument();
    });

    it('says there are no members when the list comes back empty', async () => {
      renderDialog(createMockCloudStorage({ getProjectMembers: vi.fn().mockResolvedValue([]) }));

      expect(await screen.findByText('No members')).toBeInTheDocument();
    });
  });
});
