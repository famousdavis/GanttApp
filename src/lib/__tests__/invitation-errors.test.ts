// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { deleteApp, initializeApp } from 'firebase/app';
import { FunctionsError, getFunctions, httpsCallable, type FunctionsErrorCodeCore } from 'firebase/functions';
import { FirestoreError } from 'firebase/firestore';
import { mapInvitationError } from '../invitation-errors';

/**
 * The error the real SDK throws when the deployed callable answers with
 * `status` and an HttpsError body. Only fetch is replaced, so the message
 * format is whatever this firebase version makes of the server's text.
 */
async function callableRejection(name: string, status: number, error: { status: string; message: string }) {
  const app = initializeApp({ apiKey: 'test', projectId: 'demo-test', appId: 'test' }, `callable-${name}-${status}`);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, json: async () => ({ error }) }));
  try {
    await httpsCallable(getFunctions(app), name)({});
  } catch (err) {
    return err as FunctionsError;
  } finally {
    await deleteApp(app);
  }
  throw new Error(`${name} did not reject`);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// Every error here is built with the class the app really receives, never a
// look-alike object. httpsCallable rejects with a FunctionsError, whose code
// carries a 'functions/' prefix. These tests used to build
// { code: 'resource-exhausted' } by hand, a shape no Firebase call produces,
// so they passed while every real invitation error showed the generic message.
const fnErr = (code: FunctionsErrorCodeCore, message = 'Server message.') =>
  new FunctionsError(code, message);

// FirestoreError's constructor is private in the typings but public at run
// time; this builds the real class the Firestore SDK throws.
const firestoreErr = (code: string, message: string) =>
  new (FirestoreError as unknown as new (code: string, message: string) => Error)(code, message);

describe('mapInvitationError', () => {
  describe('the errors it is given', () => {
    it('a real FunctionsError carries the functions/ prefix the mapper reads', () => {
      // If Firebase ever drops the prefix, this fails first and names the cause.
      expect(fnErr('resource-exhausted').code).toBe('functions/resource-exhausted');
    });

    it('a real FirestoreError carries a bare code', () => {
      expect((firestoreErr('permission-denied', 'x') as Error & { code: string }).code).toBe('permission-denied');
    });
  });

  describe("context: 'send' (default)", () => {
    it('maps resource-exhausted to per-day cap message', () => {
      expect(mapInvitationError(fnErr('resource-exhausted')))
        .toBe("You've reached today's invitation limit (25). Try again tomorrow.");
    });

    it('maps permission-denied to owner-only message', () => {
      expect(mapInvitationError(fnErr('permission-denied')))
        .toBe('Only the project owner can send invitations.');
    });

    it('maps failed-precondition to verification message naming Microsoft personal accounts', () => {
      const result = mapInvitationError(fnErr('failed-precondition'));
      expect(result).toContain('Could not verify your email address.');
      expect(result).toContain('@outlook.com');
    });

    it('maps not-found to project-not-found message', () => {
      expect(mapInvitationError(fnErr('not-found')))
        .toBe('Project not found or you no longer have access.');
    });

    it('maps unauthenticated to sign-in message', () => {
      expect(mapInvitationError(fnErr('unauthenticated'))).toBe('Sign in to send invitations.');
    });

    it('falls through to generic message for unmapped codes, including the message', () => {
      const result = mapInvitationError(fnErr('internal', 'oops'));
      expect(result.startsWith('Failed to send invitations.')).toBe(true);
      expect(result).toContain('oops');
    });

    it('default context is send', () => {
      expect(mapInvitationError(fnErr('resource-exhausted')))
        .toBe(mapInvitationError(fnErr('resource-exhausted'), 'send'));
    });
  });

  describe("context: 'resend'", () => {
    it('maps resource-exhausted to per-invite resend cap message', () => {
      expect(mapInvitationError(fnErr('resource-exhausted'), 'resend'))
        .toBe('This invitation has reached its resend limit (5). Revoke and re-invite to start over.');
    });

    it('maps failed-precondition to "no longer be resent"', () => {
      expect(mapInvitationError(fnErr('failed-precondition'), 'resend'))
        .toBe('This invitation can no longer be resent.');
    });

    it('maps permission-denied to original-inviter-only', () => {
      expect(mapInvitationError(fnErr('permission-denied'), 'resend'))
        .toBe('Only the original inviter can resend this invitation.');
    });

    it('maps not-found to invitation-not-found', () => {
      expect(mapInvitationError(fnErr('not-found'), 'resend')).toBe('Invitation not found.');
    });

    it('falls through to generic resend message for unmapped codes', () => {
      const result = mapInvitationError(fnErr('internal', 'oops'), 'resend');
      expect(result.startsWith('Failed to resend invitation.')).toBe(true);
      expect(result).toContain('oops');
    });
  });

  describe("context: 'revoke'", () => {
    it('maps failed-precondition to "no longer be revoked"', () => {
      expect(mapInvitationError(fnErr('failed-precondition'), 'revoke'))
        .toBe('This invitation can no longer be revoked.');
    });

    it('maps permission-denied to original-inviter-only', () => {
      expect(mapInvitationError(fnErr('permission-denied'), 'revoke'))
        .toBe('Only the original inviter can revoke this invitation.');
    });

    it('maps not-found to invitation-not-found', () => {
      expect(mapInvitationError(fnErr('not-found'), 'revoke')).toBe('Invitation not found.');
    });

    it('falls through to generic revoke message for unmapped codes', () => {
      const result = mapInvitationError(fnErr('internal', 'oops'), 'revoke');
      expect(result.startsWith('Failed to revoke invitation.')).toBe(true);
      expect(result).toContain('oops');
    });
  });

  describe('cross-context distinctness', () => {
    it("resource-exhausted in 'send' vs 'resend' produce distinct messages", () => {
      const sendMsg = mapInvitationError(fnErr('resource-exhausted'), 'send');
      const resendMsg = mapInvitationError(fnErr('resource-exhausted'), 'resend');
      expect(sendMsg).not.toEqual(resendMsg);
      expect(sendMsg).toContain('25');
      expect(resendMsg).toContain('5');
    });
  });

  describe('bare codes are not callable errors', () => {
    // Firestore errors carry bare codes. Mapping a bare 'permission-denied'
    // would tell the user the callable refused ("Only the original inviter…")
    // for an error the callable never raised. (Until v0.32.8 this happened
    // when the list reload after a successful resend failed; ShareDialog's
    // own tests now cover that case.)
    it('a FirestoreError permission-denied gets the generic resend message, not the inviter message', () => {
      const result = mapInvitationError(
        firestoreErr('permission-denied', 'Missing or insufficient permissions.'),
        'resend',
      );
      expect(result).toBe('Failed to resend invitation. Missing or insufficient permissions.');
    });

    it('a FirestoreError not-found gets the generic revoke message, not "Invitation not found."', () => {
      expect(mapInvitationError(firestoreErr('not-found', 'No document.'), 'revoke'))
        .toBe('Failed to revoke invitation. No document.');
    });
  });

  describe('the HTTP status firebase adds to the server message', () => {
    // firebase 12.19.0 (@firebase/functions 0.14.0) turns the server's
    // "emails must be …" into "emails must be … [400]". The generic text
    // shows the server's words, not the status.
    it('a real callable rejection ends its message with the HTTP status', async () => {
      const err = await callableRejection('sendInvitationEmail', 400,
        { status: 'INVALID_ARGUMENT', message: 'role must be "editor" or "viewer".' });
      expect(err.code).toBe('functions/invalid-argument');
      expect(err.message).toBe('role must be "editor" or "viewer". [400]');
    });

    it('the generic send text drops the status', async () => {
      const err = await callableRejection('sendInvitationEmail', 400,
        { status: 'INVALID_ARGUMENT', message: 'role must be "editor" or "viewer".' });
      expect(mapInvitationError(err, 'send')).toBe('Failed to send invitations. role must be "editor" or "viewer".');
    });

    it('the generic resend text drops the status', async () => {
      const err = await callableRejection('resendInvite', 500,
        { status: 'INTERNAL', message: 'Could not resend the invitation right now. Please try again.' });
      expect(mapInvitationError(err, 'resend'))
        .toBe('Failed to resend invitation. Could not resend the invitation right now. Please try again.');
    });

    it('a mapped code still shows its own message', async () => {
      const err = await callableRejection('resendInvite', 429,
        { status: 'RESOURCE_EXHAUSTED', message: 'This invitation has reached its resend limit (5). Revoke and re-invite to start over.' });
      expect(mapInvitationError(err, 'resend'))
        .toBe('This invitation has reached its resend limit (5). Revoke and re-invite to start over.');
    });

    it('leaves a bracketed number alone in an error that is not from a callable', () => {
      expect(mapInvitationError(firestoreErr('unavailable', 'Backend unavailable [503]'), 'revoke'))
        .toBe('Failed to revoke invitation. Backend unavailable [503]');
    });
  });

  describe('error shape tolerance', () => {
    it('handles errors with no code or message', () => {
      const result = mapInvitationError({});
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles non-Error objects', () => {
      expect(typeof mapInvitationError(null)).toBe('string');
      expect(typeof mapInvitationError(undefined)).toBe('string');
    });

    it('passes the message of a plain Error with no code through to the generic text', () => {
      // ShareDialog throws new Error('Invitations not configured.') itself.
      expect(mapInvitationError(new Error('Invitations not configured.')))
        .toBe('Failed to send invitations. Invitations not configured.');
    });
  });
});
