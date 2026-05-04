// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Context discriminator for mapInvitationError.
 * Firebase HttpsError codes are a small shared enum — 'resource-exhausted'
 * means different things across callables. See LESSONS-LEARNED §13.
 * 'updateVoting' is AHP-specific — do not add it here.
 */
export type InvitationErrorContext = 'send' | 'resend' | 'revoke';

export function mapInvitationError(
  err: unknown,
  context: InvitationErrorContext = 'send',
): string {
  // Defensive: callers should never pass null/undefined, but this is an
  // error-handling helper — robustness matters more than a clean cast.
  const errObj = (err && typeof err === 'object') ? err as { code?: string; message?: string } : {};
  const code    = errObj.code ?? '';
  const message = errObj.message ?? '';

  if (context === 'send') {
    if (code === 'resource-exhausted')  return "You've reached today's invitation limit (25). Try again tomorrow.";
    if (code === 'permission-denied')   return 'Only the project owner can send invitations.';
    if (code === 'failed-precondition') return 'Could not verify your email address. Microsoft personal accounts (@outlook.com, @hotmail.com) are not supported — use a work or school account, or sign in with Google.';
    if (code === 'not-found')           return 'Project not found or you no longer have access.';
    if (code === 'unauthenticated')     return 'Sign in to send invitations.';
    return `Failed to send invitations. ${message}`.trim();
  }
  if (context === 'resend') {
    if (code === 'resource-exhausted')  return 'This invitation has reached its resend limit (5). Revoke and re-invite to start over.';
    if (code === 'failed-precondition') return 'This invitation can no longer be resent.';
    if (code === 'permission-denied')   return 'Only the original inviter can resend this invitation.';
    if (code === 'not-found')           return 'Invitation not found.';
    return `Failed to resend invitation. ${message}`.trim();
  }
  if (context === 'revoke') {
    if (code === 'failed-precondition') return 'This invitation can no longer be revoked.';
    if (code === 'permission-denied')   return 'Only the original inviter can revoke this invitation.';
    if (code === 'not-found')           return 'Invitation not found.';
    return `Failed to revoke invitation. ${message}`.trim();
  }
  return `Unexpected error. ${message}`.trim();
}
