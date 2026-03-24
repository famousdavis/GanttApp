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
    solidBar: string;
    hatchedBar: string;
    finishDateLine?: string;
    mostLikelyLine?: string;
  };
  showTodayLine?: boolean;
  showFinishDateLine?: boolean;
  showMostLikelyLine?: boolean;
  showMonths?: boolean;
  chartDisplaySettings?: ChartDisplaySettings;
  preparedBy?: string;
  showPreparedBy?: boolean;
  exportAttribution?: ExportAttribution;
}

export type TabType = 'projects' | 'releases' | 'chart' | 'settings' | 'about' | 'changelog';
