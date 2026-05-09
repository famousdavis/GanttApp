// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ShareDialog — Modal for sharing a project with other users (cloud mode only)
// v18.0.0: bulk-invitation flow added behind INVITATIONS_ENABLED. Flag-off
// preserves the legacy single-email input panel byte-identical (Plan 16d);
// `removeCollaborator` (renamed from removeProjectMember in v18.0.0 / D3) is
// used in both flag states.

import { useState, useEffect, useId } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { TrashIconButton } from '../../shared/components/TrashIconButton';
import { sanitizeString } from '../../shared/utils/validation';
import { parseBulkEmails } from '../../shared/utils/parseBulkEmails';
import type { CloudGanttStorageService } from '../../shared/storage';
import type { PendingInvite, ProjectRole } from '../../shared/types/firestore';
import { INVITATIONS_ENABLED } from '../../lib/feature-flags';
import { getSendInvitationEmail } from '../../lib/firebase';
import { mapInvitationError } from '../../lib/invitation-errors';

interface ShareDialogProps {
  projectId: string;
  projectName: string;
  cloudStorage: CloudGanttStorageService;
  onClose: () => void;
}

interface Member {
  uid: string;
  role: ProjectRole;
  email?: string;
}

interface SendResult {
  added: string[];
  invited: string[];
  failed: { email: string; reason: string }[];
}

export function ShareDialog({ projectId, projectName, cloudStorage, onClose }: ShareDialogProps) {
  const { colors } = useTheme();

  // useId hooks for the flag-on form. Defined unconditionally per Rules of Hooks;
  // ignored in the flag-off branch.
  const bulkTextareaId = useId();
  const roleSelectId = useId();

  // Four-state share-section status. 'error' replaces the share UI with a
  // visible recovery message instead of leaving the user with a half-loaded
  // dialog (LESSONS-LEARNED §60). The Share button on the project tile is
  // already gated on ownership (see ProjectsTab), so reaching this dialog
  // implies the user is an owner — 'not-owner' is defensive only.
  type OwnerStatus = 'loading' | 'owner' | 'not-owner' | 'error';
  const [ownerStatus, setOwnerStatus] = useState<OwnerStatus>('loading');
  const loading = ownerStatus === 'loading';
  // Members list — shared across both flag states
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);          // member-list ops (remove)
  const [removeMemberUid, setRemoveMemberUid] = useState<string | null>(null);

  // Flag-off: single-email input
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');

  // Flag-on: bulk send + pending invites
  const [bulkEmail, setBulkEmail] = useState('');
  const [bulkSending, setBulkSending] = useState(false);              // bulk send in flight
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  // Tokens that failed EMAIL_RE in parseBulkEmails. Surfaced inline so the
  // user can see what the textarea-clear skipped (LESSONS-LEARNED §42).
  const [bulkInvalidEmails, setBulkInvalidEmails] = useState<string[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);  // per-invite tokenId in flight
  const [revokeConfirmToken, setRevokeConfirmToken] = useState<string | null>(null);

  // Load members on mount (both flag states). Status flips to 'error' on
  // rejection so the error-state render path can show a recovery message
  // rather than letting the bulk UI render against an empty members list.
  useEffect(() => {
    let cancelled = false;
    const loadMembers = async () => {
      try {
        const result = await cloudStorage.getProjectMembers(projectId);
        if (!cancelled) {
          setMembers(result);
          setOwnerStatus('owner');
        }
      } catch {
        if (!cancelled) setOwnerStatus('error');
      }
    };
    loadMembers();
    return () => { cancelled = true; };
  }, [projectId, cloudStorage]);

  // Load pending invites on mount (flag-on only)
  useEffect(() => {
    if (!INVITATIONS_ENABLED) return;
    let cancelled = false;
    const load = async () => {
      setPendingLoading(true);
      try {
        const result = await cloudStorage.listPendingInvites(projectId);
        if (!cancelled) setPendingInvites(result);
      } catch {
        // Pending list errors are non-fatal — leave list empty.
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [projectId, cloudStorage]);

  // ── Flag-off: legacy single-email handler ────────────────────────────────
  const handleShare = async () => {
    const sanitizedEmail = sanitizeString(email, 254);
    if (!sanitizedEmail) return;
    if (!sanitizedEmail.includes('@')) {
      setInviteError('Enter a valid email address');
      return;
    }
    setInviteError(null);
    setActionLoading(true);
    try {
      await cloudStorage.shareProject(projectId, sanitizedEmail, role);
      // Reload members
      const result = await cloudStorage.getProjectMembers(projectId);
      setMembers(result);
      setEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to share project');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Flag-on: bulk send handler ───────────────────────────────────────────
  const handleBulkSend = async () => {
    const { valid, invalid } = parseBulkEmails(bulkEmail);
    // Always reflect the latest parse so the chip can't go stale across sends.
    setBulkInvalidEmails(invalid);
    if (valid.length === 0) {
      // No valid addresses → no CF call, no textarea clear. The invalid chip
      // (if any) shows the user what to fix; the textarea retains content.
      setInviteError(invalid.length > 0
        ? 'No valid email addresses. Fix the entries below and try again.'
        : 'Enter one or more email addresses.');
      return;
    }
    setInviteError(null);
    setSendResult(null);
    setBulkSending(true);
    try {
      const callable = getSendInvitationEmail();
      if (!callable) throw new Error('Invitations not configured.');
      const res = await callable({
        appId: 'ganttapp',  // string literal — NOT APP_ID (LESSONS-LEARNED §15)
        modelId: projectId,
        emails: valid,
        role,
        isVoting: false,    // GanttApp has no voting model
      });
      setSendResult(res.data);
      setBulkEmail('');
      // Refresh both lists — added emails went straight into members,
      // invited emails became pending invites. allSettled (not all) so a
      // transient error on one resource cannot discard a fulfilled value
      // from the other (LESSONS-LEARNED §64).
      const [memRes, pendRes] = await Promise.allSettled([
        cloudStorage.getProjectMembers(projectId),
        cloudStorage.listPendingInvites(projectId),
      ]);
      if (memRes.status === 'fulfilled') setMembers(memRes.value);
      else console.warn('[ShareDialog] member refresh failed:', memRes.reason);
      if (pendRes.status === 'fulfilled') setPendingInvites(pendRes.value);
      else console.warn('[ShareDialog] pending refresh failed:', pendRes.reason);
    } catch (err) {
      setInviteError(mapInvitationError(err, 'send'));
    } finally {
      setBulkSending(false);
    }
  };

  // ── Flag-on: per-invite Resend / Revoke handlers ─────────────────────────
  const handleResend = async (tokenId: string) => {
    setInviteError(null);
    setActionBusy(tokenId);
    try {
      await cloudStorage.resendInvite(tokenId);
      const updated = await cloudStorage.listPendingInvites(projectId);
      setPendingInvites(updated);
    } catch (err) {
      setInviteError(mapInvitationError(err, 'resend'));
    } finally {
      setActionBusy(null);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    setInviteError(null);
    setRevokeConfirmToken(null);
    setActionBusy(tokenId);
    try {
      await cloudStorage.revokeInvite(tokenId);
      const updated = await cloudStorage.listPendingInvites(projectId);
      setPendingInvites(updated);
    } catch (err) {
      setInviteError(mapInvitationError(err, 'revoke'));
    } finally {
      setActionBusy(null);
    }
  };

  // ── Member removal — applies in BOTH flag states (D3 rename) ─────────────
  const confirmRemoveMember = async (uid: string) => {
    setRemoveMemberUid(null);
    setInviteError(null);
    setActionLoading(true);
    try {
      await cloudStorage.removeCollaborator(projectId, uid);
      const result = await cloudStorage.getProjectMembers(projectId);
      setMembers(result);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '520px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: colors.text,
          marginBottom: '0.5rem'
        }}>
          Share Project
        </h3>
        <p style={{ color: colors.textSecondary, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {projectName}
        </p>

        {ownerStatus === 'error' ? (
          /* Members fetch failed — replace the share UI with a recovery
             message rather than render an empty bulk form (LESSONS-LEARNED §60). */
          <p style={{
            color: '#e53e3e',
            fontSize: '0.9rem',
            marginBottom: '1rem',
            padding: '0.75rem',
            background: colors.background,
            border: `1px solid ${colors.border}`,
            borderRadius: '4px',
          }}>
            Couldn&apos;t load sharing details. Refresh the page to try again.
          </p>
        ) : INVITATIONS_ENABLED ? (
          /* Flag-on: bulk textarea + useId role select + send button.
             Single-email input is hidden — this branch replaces it entirely. */
          <>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor={bulkTextareaId} style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: colors.text,
                marginBottom: '0.4rem'
              }}>
                Email addresses
              </label>
              <textarea
                id={bulkTextareaId}
                name="bulkEmails"
                value={bulkEmail}
                onChange={(e) => setBulkEmail(e.target.value)}
                placeholder="alice@example.com, bob@example.com"
                autoComplete="off"
                rows={3}
                disabled={bulkSending}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  background: colors.inputBg,
                  color: colors.text,
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
              <label htmlFor={roleSelectId} style={{ fontSize: '0.85rem', fontWeight: 600, color: colors.text }}>
                Role:
              </label>
              <select
                id={roleSelectId}
                name="inviteRole"
                value={role}
                onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                disabled={bulkSending}
                style={{
                  padding: '0.5rem',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  background: colors.inputBg,
                  color: colors.text,
                  fontSize: '0.9rem'
                }}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleBulkSend}
                disabled={!bulkEmail.trim() || bulkSending}
                style={{
                  marginLeft: 'auto',
                  padding: '0.5rem 1rem',
                  background: bulkEmail.trim() && !bulkSending ? '#0070f3' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: bulkEmail.trim() && !bulkSending ? 'pointer' : 'not-allowed',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}
              >
                {bulkSending ? 'Sending…' : 'Send Invitations'}
              </button>
            </div>

            {/* Invalid-tokens chip — surfaces tokens that failed EMAIL_RE so
                the user can correct them. Renders independently of sendResult
                because parsing happens before any CF call. */}
            {bulkInvalidEmails.length > 0 && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                fontSize: '0.85rem',
                color: '#e53e3e',
                lineHeight: 1.5,
              }}>
                <strong>Skipped {bulkInvalidEmails.length}:</strong>{' '}
                {bulkInvalidEmails.join(', ')}
              </div>
            )}

            {/* Result chip */}
            {sendResult && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.75rem',
                background: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                fontSize: '0.85rem',
                color: colors.text,
                lineHeight: 1.5
              }}>
                {sendResult.added.length > 0 && (
                  <div><strong>Added {sendResult.added.length}:</strong> {sendResult.added.join(', ')}</div>
                )}
                {sendResult.invited.length > 0 && (
                  <div><strong>Invited {sendResult.invited.length}:</strong> {sendResult.invited.join(', ')}</div>
                )}
                {sendResult.failed.length > 0 && (
                  <div style={{ color: '#e53e3e' }}>
                    <strong>Skipped {sendResult.failed.length}:</strong>{' '}
                    {sendResult.failed.map((f) => `${f.email} (${f.reason})`).join(', ')}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Flag-off: legacy single-email input panel preserved byte-identical.
             NOTE: confirmRemoveMember IS updated per Step 16a — that rename
             applies in both flag states and is a flag-independent structural
             cleanup, not an input-panel change. What is byte-identical here
             is the input panel JSX only. */
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              name="shareEmail"
              aria-label="Email address to share with"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleShare()}
              disabled={actionLoading}
              maxLength={254}
              autoComplete="off"
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                background: colors.inputBg,
                color: colors.text,
                fontSize: '0.9rem'
              }}
            />
            <select
              name="shareRole"
              aria-label="Sharing role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              disabled={actionLoading}
              style={{
                padding: '0.5rem',
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                background: colors.inputBg,
                color: colors.text,
                fontSize: '0.9rem'
              }}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={handleShare}
              disabled={!email.trim() || actionLoading}
              style={{
                padding: '0.5rem 1rem',
                background: email.trim() && !actionLoading ? '#0070f3' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: email.trim() && !actionLoading ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              Share
            </button>
          </div>
        )}

        {inviteError && (
          <p style={{ color: '#e53e3e', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {inviteError}
          </p>
        )}

        {/* Members list */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.5rem' }}>
            Members
          </h4>
          {loading ? (
            <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Loading...</p>
          ) : members.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>No members</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map((member) => (
                <div
                  key={member.uid}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: colors.background,
                    borderRadius: '4px',
                    border: `1px solid ${colors.border}`
                  }}
                >
                  <div>
                    <span style={{ color: colors.text, fontSize: '0.9rem' }}>
                      {member.email || member.uid}
                    </span>
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.75rem',
                      color: member.role === 'owner' ? '#0070f3' : colors.textMuted,
                      fontWeight: member.role === 'owner' ? '600' : '400'
                    }}>
                      {member.role}
                    </span>
                  </div>
                  {member.role !== 'owner' && (
                    <TrashIconButton
                      onClick={() => setRemoveMemberUid(member.uid)}
                      disabled={actionLoading}
                      ariaLabel="Remove member"
                      title="Remove member"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending invitations list (flag-on only) */}
        {INVITATIONS_ENABLED && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.5rem' }}>
              Pending invitations
            </h4>
            {pendingLoading ? (
              <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Loading...</p>
            ) : pendingInvites.length === 0 ? (
              <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>No pending invitations</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pendingInvites.map((inv) => {
                  const resendDisabled = inv.emailSendCount >= 5 || actionBusy !== null;
                  const revokeDisabled = actionBusy !== null;
                  return (
                    <div
                      key={inv.tokenId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        background: colors.background,
                        borderRadius: '4px',
                        border: `1px solid ${colors.border}`,
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ color: colors.text, fontSize: '0.9rem', wordBreak: 'break-all' }}>
                          {inv.inviteeEmail}
                        </span>
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.75rem',
                          color: colors.textMuted
                        }}>
                          {inv.role}
                        </span>
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.75rem',
                          color: colors.textMuted
                        }}>
                          sent {inv.emailSendCount}/5
                        </span>
                      </div>
                      <button
                        onClick={() => handleResend(inv.tokenId)}
                        disabled={resendDisabled}
                        style={{
                          padding: '0.25rem 0.6rem',
                          background: 'transparent',
                          color: resendDisabled ? colors.textMuted : '#0070f3',
                          border: `1px solid ${resendDisabled ? colors.border : '#0070f3'}`,
                          borderRadius: '4px',
                          cursor: resendDisabled ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 500
                        }}
                      >
                        {actionBusy === inv.tokenId ? '...' : 'Resend'}
                      </button>
                      <TrashIconButton
                        onClick={() => setRevokeConfirmToken(inv.tokenId)}
                        disabled={revokeDisabled}
                        ariaLabel="Revoke invitation"
                        title="Revoke invitation"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Remove member confirmation modal */}
        {removeMemberUid && (
          <ConfirmDialog
            modal
            title="Remove Member"
            message="Remove this member from the project?"
            colors={colors}
            buttons={[
              {
                label: 'Cancel',
                variant: 'secondary',
                onClick: () => setRemoveMemberUid(null),
              },
              {
                label: 'Remove',
                variant: 'danger',
                onClick: () => confirmRemoveMember(removeMemberUid),
              },
            ]}
          />
        )}

        {/* Revoke invitation confirmation modal (flag-on only) */}
        {revokeConfirmToken && (
          <ConfirmDialog
            modal
            title="Revoke Invitation"
            message={`Revoke the invitation to ${pendingInvites.find((i) => i.tokenId === revokeConfirmToken)?.inviteeEmail ?? 'this user'}?`}
            colors={colors}
            buttons={[
              {
                label: 'Cancel',
                variant: 'secondary',
                onClick: () => setRevokeConfirmToken(null),
              },
              {
                label: 'Revoke',
                variant: 'danger',
                onClick: () => handleRevoke(revokeConfirmToken),
              },
            ]}
          />
        )}

        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1.25rem',
              background: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
