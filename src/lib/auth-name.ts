// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Normalize a Microsoft AD displayName from "Last, First Middle" to
 * "First Middle Last". No-ops on names without commas.
 * Apply before writing displayName to any profile collection.
 * See LESSONS-LEARNED §5.
 *
 * Mirrors denormalizeLastFirst in spert-landing-page/functions/src/mailHeaders.ts.
 * Client-side copy enables independent unit testing and write-time
 * normalization (stops bad values at the source).
 * IMPORTANT: If the canonical algorithm changes in mailHeaders.ts, update
 * this copy too. Both must stay in sync.
 */
export function denormalizeLastFirst(s: string): string {
  const parts = s.split(',').map(p => p.trim()).filter(p => p.length > 0);
  if (parts.length < 2) return s.trim();
  const [last, ...rest] = parts;
  return `${rest.join(' ')} ${last}`;
}
