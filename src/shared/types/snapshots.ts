// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Snapshot types for historical release plan records

import { Release, ChartColors } from './models';

export interface Snapshot {
  id: string;                   // generateId()
  projectId: string;            // Which project this belongs to
  timestamp: string;            // ISO 8601 — frozen as Date Prepared
  name: string;                 // User label or auto-generated date
  releases: Release[];          // Deep copy of releases at snapshot time
  projectFinishDate?: string;   // Project finish date at snapshot time
  chartColors?: ChartColors;    // Colors at snapshot time
  legendLabels?: {
    solidBar?: string;
    hatchedBar?: string;
    finishDateLine?: string;
    mostLikelyLine?: string;
    inProgress?: string;
  };
  preparedBy?: string;          // Frozen preparedBy value
  /**
   * Frozen status-date override (v0.28.0). Deliberately has NO fallback to the
   * live value when absent: a snapshot taken with no override must keep showing
   * the real current date forever, and pre-v0.28.0 snapshots must not inherit a
   * status date set months later. See useEffectiveChartProps.
   */
  todayDateOverride?: string;
}
