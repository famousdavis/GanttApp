// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { mapInvitationError } from '../invitation-errors';

const err = (code: string, message = '') => ({ code, message });

describe('mapInvitationError', () => {
  describe("context: 'send' (default)", () => {
    it('maps resource-exhausted to per-day cap message', () => {
      const result = mapInvitationError(err('resource-exhausted'));
      expect(result).toContain("today's invitation limit");
      expect(result).toContain('25');
    });

    it('maps permission-denied to owner-only message', () => {
      expect(mapInvitationError(err('permission-denied'))).toContain('Only the project owner');
    });

    it('maps failed-precondition to verification message naming Microsoft personal accounts', () => {
      const result = mapInvitationError(err('failed-precondition'));
      expect(result).toContain('verify your email');
      expect(result).toContain('outlook.com');
    });

    it('maps not-found to project-not-found message', () => {
      expect(mapInvitationError(err('not-found'))).toContain('Project not found');
    });

    it('maps unauthenticated to sign-in message', () => {
      expect(mapInvitationError(err('unauthenticated'))).toContain('Sign in');
    });

    it('falls through to generic message for unmapped codes, including the message', () => {
      expect(mapInvitationError(err('unknown', 'oops'))).toContain('Failed to send');
      expect(mapInvitationError(err('unknown', 'oops'))).toContain('oops');
    });

    it('default context is send', () => {
      // Same code, default context — should match the send-cap message.
      expect(mapInvitationError(err('resource-exhausted'))).toContain("today's invitation limit");
    });
  });

  describe("context: 'resend'", () => {
    it('maps resource-exhausted to per-invite resend cap message', () => {
      const result = mapInvitationError(err('resource-exhausted'), 'resend');
      expect(result).toContain('resend limit');
      expect(result).toContain('5');
    });

    it('maps failed-precondition to "no longer be resent"', () => {
      expect(mapInvitationError(err('failed-precondition'), 'resend')).toContain('no longer be resent');
    });

    it('maps permission-denied to original-inviter-only', () => {
      expect(mapInvitationError(err('permission-denied'), 'resend')).toContain('original inviter');
    });

    it('maps not-found to invitation-not-found', () => {
      expect(mapInvitationError(err('not-found'), 'resend')).toContain('Invitation not found');
    });

    it('falls through to generic resend message for unmapped codes', () => {
      expect(mapInvitationError(err('unknown', 'oops'), 'resend')).toContain('Failed to resend');
    });
  });

  describe("context: 'revoke'", () => {
    it('maps failed-precondition to "no longer be revoked"', () => {
      expect(mapInvitationError(err('failed-precondition'), 'revoke')).toContain('no longer be revoked');
    });

    it('maps permission-denied to original-inviter-only', () => {
      expect(mapInvitationError(err('permission-denied'), 'revoke')).toContain('original inviter');
    });

    it('maps not-found to invitation-not-found', () => {
      expect(mapInvitationError(err('not-found'), 'revoke')).toContain('Invitation not found');
    });

    it('falls through to generic revoke message for unmapped codes', () => {
      expect(mapInvitationError(err('unknown', 'oops'), 'revoke')).toContain('Failed to revoke');
    });
  });

  describe('cross-context distinctness', () => {
    it("resource-exhausted in 'send' vs 'resend' produce distinct messages", () => {
      const sendMsg = mapInvitationError(err('resource-exhausted'), 'send');
      const resendMsg = mapInvitationError(err('resource-exhausted'), 'resend');
      expect(sendMsg).not.toEqual(resendMsg);
      expect(sendMsg).toContain('25');
      expect(resendMsg).toContain('5');
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
  });
});
