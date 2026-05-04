// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { denormalizeLastFirst } from '../auth-name';

describe('denormalizeLastFirst', () => {
  it('reorders Microsoft AD "Last, First Middle" to "First Middle Last"', () => {
    expect(denormalizeLastFirst('Davis, William W')).toBe('William W Davis');
  });

  it('passes through plain "First Last" names unchanged', () => {
    expect(denormalizeLastFirst('William Davis')).toBe('William Davis');
  });

  it('handles multiple commas (treats parts after the first comma as the rest)', () => {
    // "Doe, John, PMP" — parts: ["Doe", "John", "PMP"], last="Doe", rest=["John","PMP"]
    expect(denormalizeLastFirst('Doe, John, PMP')).toBe('John PMP Doe');
  });

  it('returns empty string for empty input', () => {
    expect(denormalizeLastFirst('')).toBe('');
  });

  it('trims surrounding whitespace on no-comma input', () => {
    expect(denormalizeLastFirst('  William Davis  ')).toBe('William Davis');
  });
});
