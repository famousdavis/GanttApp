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
  };
  showFinishDateLine?: boolean;
  chartDisplaySettings?: ChartDisplaySettings;
}

export type TabType = 'projects' | 'releases' | 'chart' | 'about' | 'changelog';
