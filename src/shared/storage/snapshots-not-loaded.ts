// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// What the app throws when it could not read every saved snapshot from the
// cloud. An action that replaces every snapshot must not go on without that
// list: the replace deletes every snapshot it is not given.

export const SNAPSHOTS_NOT_LOADED_MESSAGE = 'Your saved snapshots could not be loaded from the cloud. Please try again.';

/**
 * Thrown by a snapshot load that could not read every snapshot from the
 * server: a read failed, a read was answered from the cache (offline, the SDK
 * answers from it with no error), or the signed-in user changed during the
 * reads. It carries no `code`, so sanitizeFirebaseError passes its message
 * through unchanged.
 */
export class SnapshotsNotLoadedError extends Error {
  constructor() {
    super(SNAPSHOTS_NOT_LOADED_MESSAGE);
    this.name = 'SnapshotsNotLoadedError';
  }
}

/** Recognised by name, which holds whatever a compile target does to Error subclasses. */
export function isSnapshotsNotLoadedError(error: unknown): boolean {
  return error instanceof Error && error.name === 'SnapshotsNotLoadedError';
}
