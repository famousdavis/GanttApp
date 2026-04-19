// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Module-level sign-out cleanup registry.
 *
 * WHY THIS EXISTS:
 * AuthContext is an outer provider that wraps StorageContext in the provider tree
 * (AuthProvider → StorageProvider → ThemeProvider → AppDataProvider). When the
 * ToS-version-mismatch auto-signout path in AuthContext needs to invoke the
 * centralized `performSignOutWithCleanup` helper (which lives in StorageContext,
 * along with the Firestore service handle and the in-memory storage state),
 * it cannot call `useStorage()` — AuthContext renders above StorageProvider.
 *
 * This module is the sanctioned escape hatch: StorageContext registers its
 * cleanup function on mount; AuthContext calls `runSignOutCleanup()` from the
 * ToS-failure branch. Do NOT remove this module without solving the provider-
 * order constraint another way — inverting the provider tree or merging the
 * two contexts are the alternatives, both of which are larger refactors.
 *
 * See also: `./appDataResetRegistry.ts` (the parallel registry that bridges
 * StorageContext → AppDataContext for the same reason).
 */

import { sanitizeFirebaseError } from '../shared/utils/validation';

let fn: (() => Promise<void>) | null = null;
let hasRegistration = false;

/**
 * Register a sign-out cleanup function. Returns a deregister function.
 * Silent replace on re-register (HMR/strict-mode safety).
 */
export function registerSignOutCleanup(cleanup: () => Promise<void>): () => void {
  fn = cleanup;
  hasRegistration = true;
  return () => {
    if (fn === cleanup) {
      fn = null;
      hasRegistration = false;
    }
  };
}

/**
 * Run the registered cleanup. Returns `{ wasRegistered }` so AuthContext's
 * ToS-failure path can decide whether to call `firebaseSignOut` as a safety
 * net (true when no registration — StorageProvider hasn't mounted yet).
 *
 * Errors in the registered fn are caught and logged; they do NOT propagate
 * so a broken cleanup cannot block the sign-out path.
 */
export async function runSignOutCleanup(): Promise<{ wasRegistered: boolean }> {
  if (fn === null) {
    return { wasRegistered: false };
  }
  try {
    await fn();
  } catch (err) {
    console.error('[signOutCleanup] error:', sanitizeFirebaseError(err));
  }
  return { wasRegistered: true };
}
