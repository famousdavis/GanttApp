// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import { ShareDialog } from '../ShareDialog';
import { ThemeWrapper } from '../../../test/ThemeWrapper';
import type { CloudGanttStorageService } from '../../../shared/storage';
import type { PendingInvite } from '../../../shared/types/firestore';

// The invitation callable, as getSendInvitationEmail() hands it to the dialog.
const mockSendInvitationEmail = vi.fn();
const mockGetSendInvitationEmail = vi.fn();
vi.mock('../../../lib/firebase', () => ({
  getSendInvitationEmail: () => mockGetSendInvitationEmail(),
}));

const OWNER = { uid: 'owner-uid', role: 'owner' as const, email: 'owner@example.com' };
const NEW_MEMBER = { uid: 'member-uid', role: 'editor' as const, email: 'member@example.com' };
const UNAVAILABLE = 'The service is currently unavailable.';

function createMockCloudStorage(overrides?: Partial<CloudGanttStorageService>): CloudGanttStorageService {
  return {
    mode: 'cloud',
    loadAppData: vi.fn().mockResolvedValue(null),
    saveAppData: vi.fn().mockResolvedValue(undefined),
    loadSnapshots: vi.fn().mockResolvedValue([]),
    saveSnapshots: vi.fn().mockResolvedValue(undefined),
    subscribeToProject: vi.fn().mockReturnValue(vi.fn()),
    removeCollaborator: vi.fn().mockResolvedValue(undefined),
    getProjectMembers: vi.fn().mockResolvedValue([OWNER]),
    listPendingInvites: vi.fn().mockResolvedValue([]),
    revokeInvite: vi.fn().mockResolvedValue(undefined),
    resendInvite: vi.fn().mockResolvedValue(undefined),
    flushPendingWrites: vi.fn().mockResolvedValue(undefined),
    cancelPendingSaves: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as unknown as CloudGanttStorageService;
}

function invite(overrides: Partial<PendingInvite> = {}): PendingInvite {
  return {
    tokenId: 't1', appId: 'ganttapp', modelId: 'p1', modelName: 'Test', inviteeEmail: 'pending@example.com',
    role: 'editor', isVoting: false, inviterUid: 'owner-uid', inviterName: 'Owner', inviterEmail: 'owner@example.com',
    status: 'pending', createdAt: 0, expiresAt: 0, lastEmailSentAt: 0, emailSendCount: 1, updatedAt: 0,
    ...overrides,
  };
}

/**
 * An error shaped like a real callable failure: the Functions SDK sets its code
 * to "functions/<code>". "unavailable" has no message of its own in any
 * context, so the dialog shows the action's general failure line followed by
 * the error's message, which differs from the raw message alone.
 */
function callableError(code: string, message: string) {
  return Object.assign(new Error(message), { code: `functions/${code}` });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

function renderDialog(cloudStorage: CloudGanttStorageService, projectId = 'p1') {
  return render(
    <ShareDialog projectId={projectId} projectName="Test" cloudStorage={cloudStorage} onClose={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );
}

/** Types into the address box and presses Send Invitations, letting the send's own updates settle. */
async function sendInvitations(addresses: string) {
  fireEvent.change(await screen.findByLabelText('Email addresses'), { target: { value: addresses } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send Invitations' }));
  });
}

/** Queries limited to the section under a heading ("Members", "Pending invitations"). */
function section(heading: string) {
  return within(screen.getByRole('heading', { name: heading }).parentElement as HTMLElement);
}

/** The whole text of a result line, found by its bold label (e.g. "Added 1:"). */
function lineText(label: string) {
  return screen.getByText(label).parentElement?.textContent;
}

/** Queries limited to the pending-invitation row for one invitee. */
async function inviteRow(email: string) {
  const name = await section('Pending invitations').findByText(email);
  return within(name.parentElement?.parentElement as HTMLElement);
}

/** Presses Revoke on an invitee's row and returns the confirm that opens. */
async function openRevokeConfirm(email: string) {
  fireEvent.click((await inviteRow(email)).getByRole('button', { name: 'Revoke invitation' }));
  return screen.getByRole('dialog', { name: 'Revoke Invitation' });
}

describe('ShareDialog invitations', () => {
  beforeEach(() => {
    mockSendInvitationEmail.mockReset();
    mockSendInvitationEmail.mockResolvedValue({ data: { added: [], invited: [], failed: [] } });
    mockGetSendInvitationEmail.mockReset();
    mockGetSendInvitationEmail.mockReturnValue(mockSendInvitationEmail);
    // A list that fails to refresh after a send is logged, not shown.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sending', () => {
    it('sends nothing, keeps the entry and lists the rejected entries when no address is valid', async () => {
      renderDialog(createMockCloudStorage());
      await sendInvitations('alice-at-example, bob@');

      expect(await screen.findByText('No valid email addresses. Fix the entries below and try again.')).toBeInTheDocument();
      expect(lineText('Skipped 2:')).toBe('Skipped 2: alice-at-example, bob@');
      expect(screen.getByLabelText('Email addresses')).toHaveValue('alice-at-example, bob@');
      expect(mockSendInvitationEmail).not.toHaveBeenCalled();
    });

    it('asks for an address and sends nothing when the entry holds only separators', async () => {
      renderDialog(createMockCloudStorage());
      await sendInvitations(' , ; ');

      expect(await screen.findByText('Enter one or more email addresses.')).toBeInTheDocument();
      expect(mockSendInvitationEmail).not.toHaveBeenCalled();
    });

    it('shows the send failure when invitations are not available', async () => {
      mockGetSendInvitationEmail.mockReturnValue(null);
      renderDialog(createMockCloudStorage());
      await sendInvitations('new@example.com');

      expect(await screen.findByText('Failed to send invitations. Invitations not configured.')).toBeInTheDocument();
    });

    it('sends the literal app id, the project id, only the valid addresses, the chosen role and no voting', async () => {
      renderDialog(createMockCloudStorage(), 'proj-42');
      fireEvent.change(await screen.findByLabelText('Role:'), { target: { value: 'viewer' } });
      await sendInvitations('Alice@Example.com; bob@example.com not-an-email');

      await waitFor(() => expect(mockSendInvitationEmail).toHaveBeenCalledTimes(1));
      // The app id is the string 'ganttapp' itself, as the dialog's code
      // requires, so it is asserted as that string and not as a constant.
      expect(mockSendInvitationEmail.mock.calls[0][0]).toStrictEqual({
        appId: 'ganttapp',
        modelId: 'proj-42',
        emails: ['alice@example.com', 'bob@example.com'],
        role: 'viewer',
        isVoting: false,
      });
    });

    it('reports who was added, who was invited and who was skipped with the reason', async () => {
      mockSendInvitationEmail.mockResolvedValue({ data: {
        added: ['member@example.com'],
        invited: ['new1@example.com', 'new2@example.com'],
        failed: [{ email: 'blocked@example.com', reason: 'already invited' }],
      } });
      renderDialog(createMockCloudStorage());
      await sendInvitations('member@example.com new1@example.com new2@example.com blocked@example.com');

      expect(await screen.findByText('Added 1:')).toBeInTheDocument();
      expect(lineText('Added 1:')).toBe('Added 1: member@example.com');
      expect(lineText('Invited 2:')).toBe('Invited 2: new1@example.com, new2@example.com');
      expect(lineText('Skipped 1:')).toBe('Skipped 1: blocked@example.com (already invited)');
    });

    it('clears the address box after a successful send', async () => {
      mockSendInvitationEmail.mockResolvedValue({ data: { added: [], invited: ['new@example.com'], failed: [] } });
      renderDialog(createMockCloudStorage());
      await sendInvitations('new@example.com');

      expect(await screen.findByText('Invited 1:')).toBeInTheDocument();
      expect(screen.getByLabelText('Email addresses')).toHaveValue('');
    });

    it('refreshes both the member list and the pending list after a send', async () => {
      mockSendInvitationEmail.mockResolvedValue({ data: { added: ['member@example.com'], invited: ['new@example.com'], failed: [] } });
      renderDialog(createMockCloudStorage({
        getProjectMembers: vi.fn().mockResolvedValueOnce([OWNER]).mockResolvedValueOnce([OWNER, NEW_MEMBER]),
        listPendingInvites: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([invite({ inviteeEmail: 'new@example.com' })]),
      }));
      await sendInvitations('member@example.com new@example.com');

      expect(await section('Pending invitations').findByText('new@example.com')).toBeInTheDocument();
      expect(section('Members').getByText('member@example.com')).toBeInTheDocument();
    });

    it('still shows the refreshed pending list, and no error, when the member refresh fails', async () => {
      mockSendInvitationEmail.mockResolvedValue({ data: { added: [], invited: ['new@example.com'], failed: [] } });
      renderDialog(createMockCloudStorage({
        getProjectMembers: vi.fn().mockResolvedValueOnce([OWNER]).mockRejectedValueOnce(new Error('members unavailable')),
        listPendingInvites: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([invite({ inviteeEmail: 'new@example.com' })]),
      }));
      await sendInvitations('new@example.com');

      expect(await section('Pending invitations').findByText('new@example.com')).toBeInTheDocument();
      expect(screen.queryByText(/^Failed to send invitations/)).toBeNull();
    });

    it('still shows the refreshed member list, and no error, when the pending refresh fails', async () => {
      mockSendInvitationEmail.mockResolvedValue({ data: { added: ['member@example.com'], invited: [], failed: [] } });
      renderDialog(createMockCloudStorage({
        getProjectMembers: vi.fn().mockResolvedValueOnce([OWNER]).mockResolvedValueOnce([OWNER, NEW_MEMBER]),
        listPendingInvites: vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('invitations unavailable')),
      }));
      await sendInvitations('member@example.com');

      expect(await section('Members').findByText('member@example.com')).toBeInTheDocument();
      expect(screen.queryByText(/^Failed to send invitations/)).toBeNull();
    });

    it('shows the failure worded for sending when the send fails', async () => {
      mockSendInvitationEmail.mockRejectedValue(callableError('unavailable', UNAVAILABLE));
      renderDialog(createMockCloudStorage());
      await sendInvitations('new@example.com');

      expect(await screen.findByText(`Failed to send invitations. ${UNAVAILABLE}`)).toBeInTheDocument();
    });

    it('disables the send button and labels it Sending… until the send finishes', async () => {
      const send = deferred<unknown>();
      mockSendInvitationEmail.mockReturnValue(send.promise);
      renderDialog(createMockCloudStorage());
      await sendInvitations('new@example.com');

      expect(await screen.findByRole('button', { name: 'Sending…' })).toBeDisabled();
      await act(async () => { send.resolve({ data: { added: [], invited: ['new@example.com'], failed: [] } }); });
      expect(await screen.findByRole('button', { name: 'Send Invitations' })).toBeInTheDocument();
    });
  });

  describe('resending', () => {
    it('resends an invitation and shows its updated send count', async () => {
      const cloudStorage = createMockCloudStorage({
        listPendingInvites: vi.fn()
          .mockResolvedValueOnce([invite({ tokenId: 't1', emailSendCount: 1 })])
          .mockResolvedValueOnce([invite({ tokenId: 't1', emailSendCount: 2 })]),
      });
      renderDialog(cloudStorage);
      const row = await inviteRow('pending@example.com');
      expect(row.getByText('sent 1/5')).toBeInTheDocument();

      fireEvent.click(row.getByRole('button', { name: 'Resend' }));

      await waitFor(() => expect(cloudStorage.resendInvite).toHaveBeenCalledWith('t1'));
      expect(await row.findByText('sent 2/5')).toBeInTheDocument();
    });

    it('shows the failure worded for resending when a resend fails', async () => {
      renderDialog(createMockCloudStorage({
        listPendingInvites: vi.fn().mockResolvedValue([invite()]),
        resendInvite: vi.fn().mockRejectedValue(callableError('unavailable', UNAVAILABLE)),
      }));
      fireEvent.click((await inviteRow('pending@example.com')).getByRole('button', { name: 'Resend' }));

      expect(await screen.findByText(`Failed to resend invitation. ${UNAVAILABLE}`)).toBeInTheDocument();
    });

    it('disables Resend once an invitation has been sent five times', async () => {
      renderDialog(createMockCloudStorage({
        listPendingInvites: vi.fn().mockResolvedValue([
          invite({ tokenId: 't4', inviteeEmail: 'four@example.com', emailSendCount: 4 }),
          invite({ tokenId: 't5', inviteeEmail: 'five@example.com', emailSendCount: 5 }),
        ]),
      }));
      const four = await inviteRow('four@example.com');
      const five = await inviteRow('five@example.com');

      expect(four.getByText('sent 4/5')).toBeInTheDocument();
      expect(four.getByRole('button', { name: 'Resend' })).toBeEnabled();
      expect(five.getByText('sent 5/5')).toBeInTheDocument();
      expect(five.getByRole('button', { name: 'Resend' })).toBeDisabled();
    });

    it('marks the invitation being resent and disables every invitation action until it finishes', async () => {
      const resend = deferred<void>();
      renderDialog(createMockCloudStorage({
        listPendingInvites: vi.fn().mockResolvedValue([
          invite({ tokenId: 't1', inviteeEmail: 'one@example.com' }),
          invite({ tokenId: 't2', inviteeEmail: 'two@example.com' }),
        ]),
        resendInvite: vi.fn().mockReturnValue(resend.promise),
      }));
      const one = await inviteRow('one@example.com');
      const two = await inviteRow('two@example.com');
      fireEvent.click(one.getByRole('button', { name: 'Resend' }));

      expect(await one.findByRole('button', { name: '...' })).toBeDisabled();
      expect(two.getByRole('button', { name: 'Resend' })).toBeDisabled();
      expect(one.getByRole('button', { name: 'Revoke invitation' })).toBeDisabled();
      expect(two.getByRole('button', { name: 'Revoke invitation' })).toBeDisabled();

      await act(async () => { resend.resolve(); });
      expect(await one.findByRole('button', { name: 'Resend' })).toBeEnabled();
      expect(two.getByRole('button', { name: 'Resend' })).toBeEnabled();
    });
  });

  describe('revoking', () => {
    it('names the invitee in the confirm, then revokes that invitation and refreshes the list', async () => {
      const cloudStorage = createMockCloudStorage({
        listPendingInvites: vi.fn()
          .mockResolvedValueOnce([
            invite({ tokenId: 't1', inviteeEmail: 'one@example.com' }),
            invite({ tokenId: 't2', inviteeEmail: 'two@example.com' }),
          ])
          .mockResolvedValueOnce([invite({ tokenId: 't1', inviteeEmail: 'one@example.com' })]),
      });
      renderDialog(cloudStorage);

      const confirm = await openRevokeConfirm('two@example.com');
      expect(within(confirm).getByText('Revoke the invitation to two@example.com?')).toBeInTheDocument();
      fireEvent.click(within(confirm).getByRole('button', { name: 'Revoke' }));

      await waitFor(() => expect(cloudStorage.revokeInvite).toHaveBeenCalledWith('t2'));
      await waitFor(() => expect(section('Pending invitations').queryByText('two@example.com')).toBeNull());
      expect(section('Pending invitations').getByText('one@example.com')).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Revoke Invitation' })).toBeNull();
    });

    it('keeps the invitation when the revoke confirm is cancelled', async () => {
      const cloudStorage = createMockCloudStorage({ listPendingInvites: vi.fn().mockResolvedValue([invite()]) });
      renderDialog(cloudStorage);

      const confirm = await openRevokeConfirm('pending@example.com');
      expect(confirm).toBeInTheDocument();
      fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('dialog', { name: 'Revoke Invitation' })).toBeNull();
      expect(cloudStorage.revokeInvite).not.toHaveBeenCalled();
      expect(section('Pending invitations').getByText('pending@example.com')).toBeInTheDocument();
    });

    it('shows the failure worded for revoking when revoking fails', async () => {
      renderDialog(createMockCloudStorage({
        listPendingInvites: vi.fn().mockResolvedValue([invite()]),
        revokeInvite: vi.fn().mockRejectedValue(callableError('unavailable', UNAVAILABLE)),
      }));

      const confirm = await openRevokeConfirm('pending@example.com');
      fireEvent.click(within(confirm).getByRole('button', { name: 'Revoke' }));

      expect(await screen.findByText(`Failed to revoke invitation. ${UNAVAILABLE}`)).toBeInTheDocument();
    });
  });
});
