// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Snapshot storage limits shared across local and cloud storage services
// and any feature code that needs to reason about the cap (e.g. cloneProject in useProjects).
// Single source of truth — change here and all call sites pick it up.

/** Maximum total snapshots across all projects in a single workspace. */
export const MAX_SNAPSHOTS_TOTAL = 100;

/** Maximum snapshots per individual project. */
export const MAX_SNAPSHOTS_PER_PROJECT = 50;
