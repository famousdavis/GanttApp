// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Parse a bulk email input string and partition it into valid + invalid
 * addresses. Splits on commas, semicolons, and whitespace (including
 * newlines), trims, lowercases, dedupes case-insensitively, then runs
 * each token through EMAIL_RE.
 *
 * Returning the partition (rather than just the valid array) prevents the
 * silent-filter UX bug documented in LESSONS-LEARNED §42 — the caller
 * gets a chance to surface rejected tokens to the user instead of letting
 * the textarea-clear look like a successful submission for malformed input.
 *
 * Uses Array.from() rather than spread because tsconfig target is es5
 * (CLAUDE.md: "for...of on Map/Set not supported without downlevelIteration").
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedBulkEmails {
  valid: string[];
  invalid: string[];
}

export function parseBulkEmails(raw: string): ParsedBulkEmails {
  const tokens = raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  const deduped = Array.from(new Set(tokens));
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const token of deduped) {
    if (EMAIL_RE.test(token)) valid.push(token);
    else invalid.push(token);
  }
  return { valid, invalid };
}
