// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { ShareDialog } from '../ShareDialog';
import { ThemeWrapper } from '../../../test/ThemeWrapper';
import type { CloudGanttStorageService } from '../../../shared/storage';
import { projectsTabPalette } from '../projectsTabPalette';
import { FunctionsError } from 'firebase/functions';
import { FirestoreError } from 'firebase/firestore';
import { getSendInvitationEmail } from '../../../lib/firebase';

// Only the send callable's getter is replaced, so a test can see what reaches
// the server; it returns null (no Firebase config) unless a test says otherwise.
vi.mock('../../../lib/firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/firebase')>()),
  getSendInvitationEmail: vi.fn(() => null),
}));

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

    it('Escape closes the Remove Member confirm, keeps the member, and leaves the sharing dialog open', async () => {
      const mockStorage = createMockCloudStorage({ getProjectMembers: vi.fn().mockResolvedValue([OWNER, EDITOR]) });
      renderDialog(mockStorage);

      const confirm = await openRemoveConfirm();
      fireEvent.keyDown(within(confirm).getByRole('button', { name: 'Cancel' }), { key: 'Escape', bubbles: true, cancelable: true });

      expect(screen.queryByRole('dialog', { name: 'Remove Member' })).toBeNull();
      expect(mockStorage.removeCollaborator).not.toHaveBeenCalled();
      expect(screen.getByText('editor@test.com')).toBeInTheDocument();
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

    it.each(['light', 'dark'] as const)('in %s mode the reason a removal failed is in the tab\'s red', async (theme) => {
      localStorage.setItem('gantt-theme', theme);
      try {
        renderDialog(createMockCloudStorage({
          getProjectMembers: vi.fn().mockResolvedValue([OWNER, EDITOR]),
          removeCollaborator: vi.fn().mockRejectedValue(new Error('Only the project owner can remove members.')),
        }));
        fireEvent.click(within(await openRemoveConfirm()).getByRole('button', { name: 'Remove' }));
        expect(await screen.findByText('Only the project owner can remove members.'))
          .toHaveStyle({ color: projectsTabPalette(theme).error });
      } finally {
        localStorage.removeItem('gantt-theme');
      }
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

describe("ShareDialog's colours, by theme", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // The dialog opens only from the Projects tab and takes that tab's colours:
  // the shared theme's muted text, borders, red and blue fall short of 4.5:1
  // (text) or 3:1 (borders) on its backgrounds.
  it.each(['light', 'dark'] as const)('in %s mode the member list, fields and Close use the tab\'s colours', async (theme) => {
    localStorage.setItem('gantt-theme', theme);
    const p = projectsTabPalette(theme);
    renderDialog(createMockCloudStorage({ getProjectMembers: vi.fn().mockResolvedValue([OWNER, EDITOR]) }));

    expect(await screen.findByText('editor@test.com')).toBeInTheDocument();
    expect(screen.getByText('owner')).toHaveStyle({ color: p.link });
    expect(screen.getByText('editor')).toHaveStyle({ color: p.meta });
    expect(screen.getByLabelText('Email addresses')).toHaveStyle({ border: `1px solid ${p.btnBorder}` });
    expect(screen.getByLabelText('Role:')).toHaveStyle({ border: `1px solid ${p.btnBorder}` });
    expect(screen.getByRole('button', { name: 'Close' })).toHaveStyle({ border: `1px solid ${p.btnBorder}` });
    expect(await screen.findByText('No pending invitations')).toHaveStyle({ color: p.meta });

    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));
    const confirm = screen.getByRole('dialog', { name: 'Remove Member' });
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveStyle({ border: `1px solid ${p.btnBorder}` });
  });

  it.each(['light', 'dark'] as const)('in %s mode Resend is the tab\'s blue, and its muted grey once the five sends are used', async (theme) => {
    localStorage.setItem('gantt-theme', theme);
    const p = projectsTabPalette(theme);
    const invite = (tokenId: string, inviteeEmail: string, emailSendCount: number) => ({
      tokenId, appId: 'ganttapp', modelId: 'p1', modelName: 'Test', inviteeEmail, inviterUid: 'u1', role: 'editor',
      status: 'pending', createdAt: 0, expiresAt: 0, lastEmailSentAt: 0, emailSendCount, updatedAt: 0,
    });
    renderDialog(createMockCloudStorage({
      listPendingInvites: vi.fn().mockResolvedValue([invite('t1', 'one@example.com', 1), invite('t5', 'five@example.com', 5)]),
    }));

    const rowOf = async (email: string) => (await screen.findByText(email)).closest('div[style]')?.parentElement as HTMLElement;
    const open = within(await rowOf('one@example.com')).getByRole('button', { name: 'Resend' });
    const spent = within(await rowOf('five@example.com')).getByRole('button', { name: 'Resend' });
    expect(open).toBeEnabled();
    expect(open).toHaveStyle({ color: p.link, border: `1px solid ${p.link}` });
    expect(spent).toBeDisabled();
    expect(spent).toHaveStyle({ color: p.meta, border: `1px solid ${p.btnBorder}` });
  });

  it.each(['light', 'dark'] as const)('in %s mode Resend is muted while a resend is in flight', async (theme) => {
    localStorage.setItem('gantt-theme', theme);
    const p = projectsTabPalette(theme);
    const invite = {
      tokenId: 't1', appId: 'ganttapp', modelId: 'p1', modelName: 'Test', inviteeEmail: 'one@example.com', inviterUid: 'u1', role: 'editor',
      status: 'pending', createdAt: 0, expiresAt: 0, lastEmailSentAt: 0, emailSendCount: 1, updatedAt: 0,
    };
    renderDialog(createMockCloudStorage({
      listPendingInvites: vi.fn().mockResolvedValue([invite]),
      resendInvite: vi.fn(() => new Promise<void>(() => {})), // never settles: the resend stays in flight
    }));

    const row = (await screen.findByText('one@example.com')).closest('div[style]')?.parentElement as HTMLElement;
    const resend = within(row).getByRole('button', { name: 'Resend' });
    expect(resend).toHaveStyle({ color: p.link, border: `1px solid ${p.link}` });
    fireEvent.click(resend);

    await waitFor(() => expect(resend).toBeDisabled()); // the same button, labelled "..." while busy
    expect(resend).toHaveTextContent('...');
    expect(resend).toHaveStyle({ color: p.meta, border: `1px solid ${p.btnBorder}` });
  });

  it.each(['light', 'dark'] as const)('in %s mode the could-not-load message uses the tab\'s red', async (theme) => {
    localStorage.setItem('gantt-theme', theme);
    renderDialog(createMockCloudStorage({ getProjectMembers: vi.fn().mockRejectedValue(new Error('denied')) }));

    expect(await screen.findByText("Couldn't load sharing details. Refresh the page to try again."))
      .toHaveStyle({ color: projectsTabPalette(theme).error });
  });
});

describe("ShareDialog's invitation errors", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const invite = {
    tokenId: 't1', appId: 'ganttapp', modelId: 'p1', modelName: 'Test', inviteeEmail: 'one@example.com', inviterUid: 'u1', role: 'editor',
    status: 'pending', createdAt: 0, expiresAt: 0, lastEmailSentAt: 0, emailSendCount: 1, updatedAt: 0,
  };

  // The callable rejects with the real FunctionsError class, whose code is
  // 'functions/resource-exhausted'. From v18.0.0 the mapper's own tests used a
  // look-alike { code: 'resource-exhausted' }, which hid that no specific
  // message ever reached the screen.
  it('shows the resend-limit message when the resend callable reports resource-exhausted', async () => {
    renderDialog(createMockCloudStorage({
      listPendingInvites: vi.fn().mockResolvedValue([invite]),
      resendInvite: vi.fn().mockRejectedValue(new FunctionsError('resource-exhausted', 'Resend limit reached.')),
    }));

    const row = (await screen.findByText('one@example.com')).closest('div[style]')?.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Resend' }));

    expect(await screen.findByText('This invitation has reached its resend limit (5). Revoke and re-invite to start over.'))
      .toBeInTheDocument();
    expect(screen.queryByText(/Failed to resend invitation/)).not.toBeInTheDocument();
  });

  // The list reload after a resend or revoke is a Firestore read, and a real
  // FirestoreError (private constructor in the typings) is what it throws.
  const listReloadError = () =>
    new (FirestoreError as unknown as new (code: string, message: string) => Error)(
      'permission-denied', 'Missing or insufficient permissions.');

  it.each([
    ['resend', 'Invitation resent'],
    ['revoke', 'Invitation revoked'],
  ] as const)('after a %s that worked, a failed list reload says it worked', async (action, done) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = createMockCloudStorage({
      listPendingInvites: vi.fn().mockResolvedValueOnce([invite]).mockRejectedValueOnce(listReloadError()),
    });
    renderDialog(storage);

    const row = (await screen.findByText('one@example.com')).closest('div[style]')?.parentElement as HTMLElement;
    if (action === 'resend') {
      fireEvent.click(within(row).getByRole('button', { name: 'Resend' }));
    } else {
      fireEvent.click(within(row).getByRole('button', { name: 'Revoke invitation' }));
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Revoke Invitation' })).getByRole('button', { name: 'Revoke' }));
    }

    expect(await screen.findByText(`${done}, but the list below could not be updated. Close and reopen this dialog to see the latest.`))
      .toBeInTheDocument();
    expect(storage[action === 'resend' ? 'resendInvite' : 'revokeInvite']).toHaveBeenCalledWith('t1');
    expect(storage.listPendingInvites).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/^Failed to/)).not.toBeInTheDocument();
  });

  it('a resend the server refuses shows its reason and does not reload the list', async () => {
    const storage = createMockCloudStorage({
      listPendingInvites: vi.fn().mockResolvedValue([invite]),
      resendInvite: vi.fn().mockRejectedValue(new FunctionsError('failed-precondition', 'This invitation can no longer be resent.')),
    });
    renderDialog(storage);

    const row = (await screen.findByText('one@example.com')).closest('div[style]')?.parentElement as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Resend' }));

    expect(await screen.findByText('This invitation can no longer be resent.')).toBeInTheDocument();
    expect(storage.listPendingInvites).toHaveBeenCalledTimes(1);
  });
});

describe("ShareDialog's limit of 25 addresses per send", () => {
  // The server rejects more than 25 addresses in one call (PER_CALL_CAP in
  // spert-landing-page/functions/src/sendInvitationEmail.tsx) with a message
  // written for developers. The dialog checks first.
  const addresses = (n: number) => Array.from({ length: n }, (_, i) => `person${i + 1}@example.com`);
  const callable = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    callable.mockReset().mockRejectedValue(
      new FunctionsError('resource-exhausted', "You've reached today's invitation limit (25). Try again tomorrow."));
    vi.mocked(getSendInvitationEmail).mockReturnValue(callable as unknown as ReturnType<typeof getSendInvitationEmail>);
  });

  const send = (text: string) => {
    renderDialog(createMockCloudStorage());
    const box = screen.getByLabelText('Email addresses');
    fireEvent.change(box, { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invitations' }));
    return box;
  };

  it.each([
    [26, 'Remove 1 address and try again.'],
    [28, 'Remove 3 addresses and try again.'],
  ])('with %i addresses, sends nothing, keeps the text and says how many to remove', async (n, tail) => {
    const text = addresses(n).join('\n');
    const box = send(text);

    expect(await screen.findByText(`You can invite at most 25 people at a time. ${tail}`)).toBeInTheDocument();
    expect(callable).not.toHaveBeenCalled();
    expect(box).toHaveValue(text);
  });

  it('sends exactly 25 addresses', async () => {
    send(addresses(25).join(', '));

    expect(await screen.findByText("You've reached today's invitation limit (25). Try again tomorrow.")).toBeInTheDocument();
    expect(callable).toHaveBeenCalledTimes(1);
    expect(callable.mock.calls[0][0].emails).toHaveLength(25);
  });

  it('counts each address once: 26 entries with one repeated are sent', async () => {
    const list = addresses(25);
    send([...list, list[0].toUpperCase()].join('\n'));

    expect(await screen.findByText("You've reached today's invitation limit (25). Try again tomorrow.")).toBeInTheDocument();
    expect(callable.mock.calls[0][0].emails).toHaveLength(25);
  });
});
