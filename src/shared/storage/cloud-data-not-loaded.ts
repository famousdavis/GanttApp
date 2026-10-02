// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// What the app says, and throws, while a cloud session's data has not loaded.
// Until a load from the cloud has succeeded there is nothing to save against:
// saves are refused and reported once, under Settings -> Storage, and the
// actions that write snapshots are refused with their own message.

/** Reported through onSaveResult when the first cloud load fails. */
export const CLOUD_LOAD_FAILED_MESSAGE =
  'Your cloud data did not load, so changes are not being saved. Reload the page to try again.';

/** The reason given when an action is refused for the same cause. */
export const CLOUD_DATA_NOT_LOADED_MESSAGE =
  'Your cloud data did not load, so changes cannot be saved. Reload the page to try again.';

/**
 * Thrown by a cloud write refused because no load has succeeded. It carries no
 * `code`, so sanitizeFirebaseError passes its message through unchanged.
 */
export class CloudDataNotLoadedError extends Error {
  constructor() {
    super(CLOUD_DATA_NOT_LOADED_MESSAGE);
    this.name = 'CloudDataNotLoadedError';
  }
}

/** Recognised by name, which holds whatever a compile target does to Error subclasses. */
export function isCloudDataNotLoadedError(error: unknown): boolean {
  return error instanceof Error && error.name === 'CloudDataNotLoadedError';
}

/** The text shown when an action is refused: what did not happen, then why. */
export function cloudRefusal(firstSentence: string): string {
  return `${firstSentence} ${CLOUD_DATA_NOT_LOADED_MESSAGE}`;
}
