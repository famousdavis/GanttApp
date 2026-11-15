// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { FunctionsError, type FunctionsErrorCodeCore } from 'firebase/functions';
import { FirestoreError } from 'firebase/firestore';
import { mapInvitationError } from '../invitation-errors';

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
    // The resend and revoke handlers in ShareDialog also await a Firestore
    // read (listPendingInvites) inside the same try, and Firestore errors carry
    // bare codes. Mapping a bare 'permission-denied' would tell the user the
    // callable refused ("Only the original inviter…") when the resend worked
    // and only the list refresh failed.
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
