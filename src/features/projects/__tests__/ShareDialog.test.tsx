// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    shareProject: vi.fn().mockResolvedValue(undefined),
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
});
