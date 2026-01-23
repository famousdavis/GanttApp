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
}

export interface ChartColors {
  solidBar: string;
  hatchedBar: string;
  todayLine: string;
  finishDateLine: string;
}

export interface ChartDisplaySettings {
  releaseNameFontSize: '14' | '16' | '18';  // Small, Medium, Large
  dateLabelFontSize: '9' | '11' | '13';  // Small, Medium, Large
  dateLabelColor: '#999' | '#666' | '#333' | '#000';  // Light to Black
  verticalLineWidth: '2' | '3' | '4';  // Thin, Medium, Thick
}
