// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Core data models for GanttApp

export type ReleaseStatus = 'not-started' | 'in-progress' | 'complete';

export interface Project {
  id: string;
  name: string;
  finishDate?: string;
  owner?: string;       // Firebase uid — only populated in cloud mode (v11.2)
  /** Optional per-project override of the work-week. Array of day-of-week integers (0=Sun ... 6=Sat). Undefined = use global default. */
  workDays?: number[];
}

export interface Release {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  earlyFinishDate: string;
  lateFinishDate: string;
  hidden?: boolean;
  status?: ReleaseStatus;
  mostLikelyFinishDate?: string;  // Optional YYYY-MM-DD, must be >= earlyFinishDate and <= lateFinishDate
}

export interface ChartColors {
  solidBar: string;
  hatchedBar: string;
  todayLine: string;
  finishDateLine: string;
  mostLikelyLine: string;
  completedBar: string;
  inProgressBar: string;
}

export interface ChartDisplaySettings {
  releaseNameFontSize: '14' | '16' | '18';  // Small, Medium, Large
  dateLabelFontSize: '11' | '13' | '15';  // Small, Medium, Large
  dateLabelColor: '#999' | '#666' | '#333' | '#000';  // Light to Black
  verticalLineWidth: '2' | '3' | '4';  // Thin, Medium, Thick
  barHeight: '30' | '40' | '50';  // Small, Medium, Large
  rowSpacing: '20' | '25' | '30';  // Small, Medium, Large
}
