// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Parse a bulk email input string into a deduped, lowercased, trimmed array.
 * Splits on commas, semicolons, and whitespace (including newlines).
 *
 * Uses Array.from() rather than spread because tsconfig target is es5
 * (CLAUDE.md: "for...of on Map/Set not supported without downlevelIteration").
 */
export function parseBulkEmails(raw: string): string[] {
  const cleaned = raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  return Array.from(new Set(cleaned));
}
