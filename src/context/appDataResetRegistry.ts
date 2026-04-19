// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Module-level AppData reset registry.
 *
 * WHY THIS EXISTS:
 * AppDataContext is nested inside StorageContext in the provider tree
 * (StorageProvider → ThemeProvider → AppDataProvider). When StorageContext's
 * `performSignOutWithCleanup` helper needs to clear AppDataContext state
 * as part of the centralized sign-out sequence, it cannot call `useAppData()`
 * — StorageContext renders above AppDataProvider.
 *
 * AppDataContext registers its `clearAllData` action into this registry on
 * mount; StorageContext invokes `runAppDataReset()` at the appropriate point
 * in the sign-out sequence (step 2 of `performSignOutWithCleanup`).
 *
 * See also: `./signOutCleanupRegistry.ts` (the parallel registry that bridges
 * AuthContext → StorageContext).
 */

let fn: (() => void) | null = null;

/**
 * Register the AppData reset function. Returns a deregister function.
 * Silent replace on re-register (HMR/strict-mode safety).
 */
export function registerAppDataReset(reset: () => void): () => void {
  fn = reset;
  return () => {
    if (fn === reset) {
      fn = null;
    }
  };
}

/**
 * Invoke the registered reset. No-op if no registration.
 * Synchronous — completes before returning.
 */
export function runAppDataReset(): void {
  if (fn !== null) {
    fn();
  }
}
