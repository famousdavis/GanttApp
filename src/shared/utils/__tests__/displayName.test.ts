// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { getFirstName, getInitial, normalizeDisplayName } from '../displayName';

describe('getFirstName', () => {
  it('extracts first name from "First Last" format (Google)', () => {
    expect(getFirstName('William Davis', null)).toBe('William');
  });

  it('extracts first name from "Last, First" format (Microsoft Entra)', () => {
    expect(getFirstName('Davis, William', null)).toBe('William');
  });

  it('extracts first name from "Last,First" with no space after comma', () => {
    expect(getFirstName('Davis,William', null)).toBe('William');
  });

  it('handles multi-part first names "First Middle Last"', () => {
    expect(getFirstName('William Wallace Davis', null)).toBe('William');
  });

  it('falls back to email local-part when displayName is null', () => {
    expect(getFirstName(null, 'famousdavis@example.com')).toBe('famousdavis');
  });

  it('falls back to email local-part when displayName is empty string', () => {
    expect(getFirstName('', 'famousdavis@example.com')).toBe('famousdavis');
  });

  it('returns empty string when both displayName and email are null', () => {
    expect(getFirstName(null, null)).toBe('');
  });

  it('returns empty string when both displayName and email are undefined', () => {
    expect(getFirstName(undefined, undefined)).toBe('');
  });

  it('falls back to email even when displayName is "Last, " with empty first', () => {
    expect(getFirstName('Davis, ', 'pmp@example.com')).toBe('pmp');
  });
});

describe('getInitial', () => {
  it('returns uppercase first character', () => {
    expect(getInitial('william')).toBe('W');
    expect(getInitial('William')).toBe('W');
  });

  it('returns "?" for empty string', () => {
    expect(getInitial('')).toBe('?');
  });

  it('handles unicode / non-latin', () => {
    expect(getInitial('émile')).toBe('É');
  });
});

describe('normalizeDisplayName', () => {
  it('passes through "First Last" (Google) unchanged', () => {
    expect(normalizeDisplayName('William Davis')).toBe('William Davis');
  });

  it('passes through "First Middle Last" unchanged', () => {
    expect(normalizeDisplayName('William W Davis')).toBe('William W Davis');
  });

  it('reverses "Last, First" (Microsoft Entra) to "First Last"', () => {
    expect(normalizeDisplayName('Davis, William')).toBe('William Davis');
  });

  it('reverses "Last, First MI" to "First MI Last"', () => {
    expect(normalizeDisplayName('Davis, William W')).toBe('William W Davis');
  });

  it('trims whitespace around the comma', () => {
    expect(normalizeDisplayName('  Davis,   William  ')).toBe('William Davis');
  });

  it('returns empty string for null', () => {
    expect(normalizeDisplayName(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(normalizeDisplayName(undefined)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDisplayName('')).toBe('');
    expect(normalizeDisplayName('   ')).toBe('');
  });

  it('returns just last name when first half is empty after comma', () => {
    expect(normalizeDisplayName('Davis,')).toBe('Davis');
    expect(normalizeDisplayName('Davis, ')).toBe('Davis');
  });

  it('returns just first name when last half is empty before comma', () => {
    expect(normalizeDisplayName(', William')).toBe('William');
  });

  it('handles single name with no comma', () => {
    expect(normalizeDisplayName('William')).toBe('William');
  });
});
