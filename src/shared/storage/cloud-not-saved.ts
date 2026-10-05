// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// What the app says, and throws, when a change stays on screen but is not
// written to the cloud: a snapshot under a project whose own first save
// failed, and a change to a project this user may only view.

/**
 * Thrown by a snapshot write under a project the cloud does not hold yet,
 * once that project's first save has failed (or the project left the save
 * before one took it). Nothing of the snapshot write was sent. It carries no
 * `code`, so sanitizeFirebaseError passes its message through unchanged.
 */
export class ProjectNotSavedError extends Error {
  constructor() {
    super('This project has not been saved to the cloud.');
    this.name = 'ProjectNotSavedError';
  }
}

/** Recognised by name, which holds whatever a compile target does to Error subclasses. */
export function isProjectNotSavedError(error: unknown): boolean {
  return error instanceof Error && error.name === 'ProjectNotSavedError';
}

/** A write the rules refused. */
export function isPermissionDenied(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'permission-denied';
}

/**
 * Reported through onSaveResult when a save skipped this user's own change to
 * a project they may only view (its name, finish date, work week, legend
 * labels, or one of its releases). Never for an owner's change the listener
 * delivered and the app sent back, nor for an order shift the user did not make.
 */
export const VIEWER_CHANGE_NOT_SAVED_MESSAGE = 'You can only view this project, so your change was not saved.';
