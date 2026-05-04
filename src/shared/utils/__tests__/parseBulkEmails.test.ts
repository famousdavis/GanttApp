// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { parseBulkEmails } from '../parseBulkEmails';

describe('parseBulkEmails', () => {
  it('splits on commas', () => {
    expect(parseBulkEmails('alice@x.com, bob@y.com')).toEqual(['alice@x.com', 'bob@y.com']);
  });

  it('splits on semicolons', () => {
    expect(parseBulkEmails('alice@x.com;bob@y.com')).toEqual(['alice@x.com', 'bob@y.com']);
  });

  it('splits on whitespace including newlines', () => {
    expect(parseBulkEmails('alice@x.com\nbob@y.com\tcarol@z.com')).toEqual([
      'alice@x.com', 'bob@y.com', 'carol@z.com',
    ]);
  });

  it('lowercases all addresses', () => {
    expect(parseBulkEmails('Alice@X.COM, BOB@Y.com')).toEqual(['alice@x.com', 'bob@y.com']);
  });

  it('trims whitespace within entries', () => {
    expect(parseBulkEmails('  alice@x.com  ,  bob@y.com  ')).toEqual(['alice@x.com', 'bob@y.com']);
  });

  it('dedupes case-insensitively (after lowercasing)', () => {
    expect(parseBulkEmails('alice@x.com, ALICE@x.com, alice@X.com')).toEqual(['alice@x.com']);
  });

  it('returns empty array for empty input', () => {
    expect(parseBulkEmails('')).toEqual([]);
  });

  it('returns empty array for all-whitespace input', () => {
    expect(parseBulkEmails('   \n\t  ;  ,  ')).toEqual([]);
  });

  it('handles mixed separators in the same input', () => {
    expect(parseBulkEmails('a@x.com, b@y.com;c@z.com\nd@w.com')).toEqual([
      'a@x.com', 'b@y.com', 'c@z.com', 'd@w.com',
    ]);
  });
});
