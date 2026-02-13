// Application-level types

import { Project, Release, ChartColors, ChartDisplaySettings } from './models';

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
  chartDisplaySettings?: ChartDisplaySettings;
  preparedBy?: string;
  showPreparedBy?: boolean;
}

export type TabType = 'projects' | 'releases' | 'chart' | 'about' | 'changelog';
