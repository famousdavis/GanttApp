// Core data models for GanttApp

export interface Project {
  id: string;
  name: string;
  finishDate?: string;
}

export interface Release {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  earlyFinishDate: string;
  lateFinishDate: string;
  hidden?: boolean;
  completed?: boolean;
  mostLikelyFinishDate?: string;  // Optional YYYY-MM-DD, must be >= earlyFinishDate and <= lateFinishDate
}

export interface ChartColors {
  solidBar: string;
  hatchedBar: string;
  todayLine: string;
  finishDateLine: string;
  mostLikelyLine: string;
}

export interface ChartDisplaySettings {
  releaseNameFontSize: '14' | '16' | '18';  // Small, Medium, Large
  dateLabelFontSize: '11' | '13' | '15';  // Small, Medium, Large
  dateLabelColor: '#999' | '#666' | '#333' | '#000';  // Light to Black
  verticalLineWidth: '2' | '3' | '4';  // Thin, Medium, Thick
  barHeight: '30' | '40' | '50';  // Small, Medium, Large
  rowSpacing: '20' | '25' | '30';  // Small, Medium, Large
}
