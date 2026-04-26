// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Derive a first-name string from a Firebase user's displayName, with a
 * fallback to the email local-part.
 *
 * Microsoft Entra ID typically returns `displayName` in "Last, First" format,
 * so we detect a comma and swap. Google and most other providers return
 * "First Last" already.
 *
 * Used by the signed-in pill states in StorageStatusChip. Extracted in v16.6
 * so the signed-in-cloud and signed-in-local branches share one source of
 * truth for name-extraction rules.
 */
export function getFirstName(
  displayName: string | null | undefined,
  email: string | null | undefined
): string {
  const raw = displayName ?? '';
  let firstName: string;
  if (raw.includes(',')) {
    firstName = raw.split(',')[1]?.trim().split(' ')[0] ?? '';
  } else {
    firstName = raw.split(' ')[0] ?? '';
  }
  if (!firstName) {
    firstName = email?.split('@')[0] ?? '';
  }
  return firstName;
}

/** Derive a single-character initial from a first-name string. */
export function getInitial(firstName: string): string {
  return firstName.charAt(0).toUpperCase() || '?';
}

/**
 * Normalize a Firebase user's displayName to "First MI Last" for full-name
 * display in identity cards. Microsoft Entra ID returns "Last, First MI" —
 * we swap. Google and most providers return "First Last" already — passthrough.
 *
 * Empty/null → ''. The caller decides the fallback (typically email local-part).
 */
export function normalizeDisplayName(displayName: string | null | undefined): string {
  const raw = (displayName ?? '').trim();
  if (!raw) return '';
  if (!raw.includes(',')) return raw;
  const parts = raw.split(',').map(s => s.trim());
  const last = parts[0] ?? '';
  const firstAndMiddle = parts.slice(1).join(' ').trim();
  if (!firstAndMiddle) return last;
  if (!last) return firstAndMiddle;
  return `${firstAndMiddle} ${last}`;
}
