// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { parseBulkEmails } from '../parseBulkEmails';

describe('parseBulkEmails', () => {
  it('splits on commas', () => {
    expect(parseBulkEmails('alice@x.com, bob@y.com').valid).toEqual(['alice@x.com', 'bob@y.com']);
  });

  it('splits on semicolons', () => {
    expect(parseBulkEmails('alice@x.com;bob@y.com').valid).toEqual(['alice@x.com', 'bob@y.com']);
  });

  it('splits on whitespace including newlines', () => {
    expect(parseBulkEmails('alice@x.com\nbob@y.com\tcarol@z.com').valid).toEqual([
      'alice@x.com', 'bob@y.com', 'carol@z.com',
    ]);
  });

  it('lowercases all addresses', () => {
    expect(parseBulkEmails('Alice@X.COM, BOB@Y.com').valid).toEqual(['alice@x.com', 'bob@y.com']);
  });

  it('trims whitespace within entries', () => {
    expect(parseBulkEmails('  alice@x.com  ,  bob@y.com  ').valid).toEqual(['alice@x.com', 'bob@y.com']);
  });

  it('dedupes case-insensitively (after lowercasing)', () => {
    expect(parseBulkEmails('alice@x.com, ALICE@x.com, alice@X.com').valid).toEqual(['alice@x.com']);
  });

  it('returns empty arrays for empty input', () => {
    expect(parseBulkEmails('')).toEqual({ valid: [], invalid: [] });
  });

  it('returns empty arrays for all-whitespace input', () => {
    expect(parseBulkEmails('   \n\t  ;  ,  ')).toEqual({ valid: [], invalid: [] });
  });

  it('handles mixed separators in the same input', () => {
    expect(parseBulkEmails('a@x.com, b@y.com;c@z.com\nd@w.com').valid).toEqual([
      'a@x.com', 'b@y.com', 'c@z.com', 'd@w.com',
    ]);
  });

  // EMAIL_RE validation — rejected tokens must surface in `.invalid` so the
  // caller can show them to the user instead of letting the textarea-clear
  // look like a successful submit. LESSONS-LEARNED §42.
  it('routes malformed tokens into invalid', () => {
    const result = parseBulkEmails('alice@x.com, broken, bob@y.com');
    expect(result.valid).toEqual(['alice@x.com', 'bob@y.com']);
    expect(result.invalid).toEqual(['broken']);
  });

  it('rejects addresses missing @', () => {
    expect(parseBulkEmails('aliceatx.com').invalid).toEqual(['aliceatx.com']);
  });

  it('rejects addresses missing a TLD', () => {
    expect(parseBulkEmails('alice@x').invalid).toEqual(['alice@x']);
  });

  it('rejects addresses with a trailing dot', () => {
    expect(parseBulkEmails('alice@x.').invalid).toEqual(['alice@x.']);
  });

  it('rejects addresses with internal whitespace tokens (already split out)', () => {
    // Whitespace inside a token can't survive the splitter, so the only way
    // to land in invalid via internal whitespace is no — splitter eats it.
    // This test guards against a future change that swaps the regex split.
    const result = parseBulkEmails('alice user@x.com');
    expect(result.valid).toEqual(['user@x.com']);
    expect(result.invalid).toEqual(['alice']);
  });

  it('returns invalid even when no valid addresses are present', () => {
    const result = parseBulkEmails('alice, bob, charlie');
    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual(['alice', 'bob', 'charlie']);
  });
});
