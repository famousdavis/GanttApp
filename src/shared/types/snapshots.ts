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
    solidBar: string;
    hatchedBar: string;
    finishDateLine?: string;
  };
  preparedBy?: string;          // Frozen preparedBy value
}
