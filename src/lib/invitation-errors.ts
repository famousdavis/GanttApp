// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { FunctionsErrorCode } from 'firebase/functions';

/**
 * Context discriminator for mapInvitationError.
 * Firebase HttpsError codes are a small shared enum — 'resource-exhausted'
 * means different things across callables. See LESSONS-LEARNED §13.
 * 'updateVoting' is AHP-specific — do not add it here.
 */
export type InvitationErrorContext = 'send' | 'resend' | 'revoke';

/**
 * The server's own words from a callable error, for the generic messages.
 * Since firebase 12.19.0 (@firebase/functions 0.14.0) the SDK appends the
 * HTTP status to a callable's message ("… [400]"), which means nothing to
 * the user. Only callable errors are touched; any other error's message is
 * shown as it is.
 */
function serverText(code: string, message: string): string {
  return /^functions\//.test(code) ? message.replace(/ \[\d{3}\]$/, '') : message;
}

/**
 * Turn an invitation callable's error into text the user can act on.
 *
 * httpsCallable rejects with a FunctionsError whose code carries a
 * 'functions/' prefix ('functions/resource-exhausted'), so that is the only
 * form matched here, as in spert-ahp, spert-cfd and spert-story-map. Typing
 * each comparison as FunctionsErrorCode makes a bare code a type error.
 *
 * Bare codes are deliberately NOT matched. A bare code comes from another
 * Firebase service — Firestore's errors carry them ('permission-denied') —
 * and the messages here say the callable refused the request, which such an
 * error does not mean. They fall through to the generic text with the
 * error's own message. (Until v0.32.8 a failed list reload after a resend or
 * revoke reached this function that way; ShareDialog now handles it itself.)
 */
export function mapInvitationError(
  err: unknown,
  context: InvitationErrorContext = 'send',
): string {
  // Defensive: callers should never pass null/undefined, but this is an
  // error-handling helper — robustness matters more than a clean cast.
  const errObj = (err && typeof err === 'object') ? err as { code?: string; message?: string } : {};
  const code    = errObj.code ?? '';
  const message = serverText(code, errObj.message ?? '');
  const is = (expected: FunctionsErrorCode) => code === expected;

  if (context === 'send') {
    if (is('functions/resource-exhausted'))  return "You've reached today's invitation limit (25). Try again tomorrow.";
    if (is('functions/permission-denied'))   return 'Only the project owner can send invitations.';
    if (is('functions/failed-precondition')) return 'Could not verify your email address. Microsoft personal accounts (@outlook.com, @hotmail.com) are not supported — use a work or school account, or sign in with Google.';
    if (is('functions/not-found'))           return 'Project not found or you no longer have access.';
    if (is('functions/unauthenticated'))     return 'Sign in to send invitations.';
    return `Failed to send invitations. ${message}`.trim();
  }
  if (context === 'resend') {
    if (is('functions/resource-exhausted'))  return 'This invitation has reached its resend limit (5). Revoke and re-invite to start over.';
    if (is('functions/failed-precondition')) return 'This invitation can no longer be resent.';
    if (is('functions/permission-denied'))   return 'Only the original inviter can resend this invitation.';
    if (is('functions/not-found'))           return 'Invitation not found.';
    return `Failed to resend invitation. ${message}`.trim();
  }
  if (context === 'revoke') {
    if (is('functions/failed-precondition')) return 'This invitation can no longer be revoked.';
    if (is('functions/permission-denied'))   return 'Only the original inviter can revoke this invitation.';
    if (is('functions/not-found'))           return 'Invitation not found.';
    return `Failed to revoke invitation. ${message}`.trim();
  }
  return `Unexpected error. ${message}`.trim();
}
