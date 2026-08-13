// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Application-level types

import { Project, Release, ChartColors, ChartDisplaySettings } from './models';
import { ExportAttribution } from './firestore';

export interface AppData {
  projects: Project[];
  releases: Release[];
  chartColors?: ChartColors;
  activePreset?: string;
  legendLabels?: {
    solidBar?: string;
    hatchedBar?: string;
    finishDateLine?: string;
    mostLikelyLine?: string;
    inProgress?: string;
  };
  showTodayLine?: boolean;
  /**
   * Optional override for the date the "today" line is drawn at (v0.28.0).
   * Absent/empty = draw at the real current date (the pre-v0.28.0 behavior).
   * Surfaced in the UI as the "Status Date" (the MS Project / PMBOK term) —
   * set when a chart is prepared ahead of the review it will be presented at.
   * Does NOT affect "Date Prepared", which always reports the real date.
   */
  todayDateOverride?: string;
  showFinishDateLine?: boolean;
  showMostLikelyLine?: boolean;
  showMonths?: boolean;
  chartDisplaySettings?: ChartDisplaySettings;
  preparedBy?: string;
  showPreparedBy?: boolean;
  exportAttribution?: ExportAttribution;
  /** Optional global work-week setting (v15.0). Array of day-of-week integers (0=Sun ... 6=Sat). Undefined = feature not configured, no warnings. */
  globalWorkDays?: number[];
}

export type TabType = 'projects' | 'releases' | 'chart' | 'settings' | 'about' | 'changelog';
