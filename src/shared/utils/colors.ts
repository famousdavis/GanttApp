// Color constants and presets for GanttApp

import { ChartColors, ChartDisplaySettings } from '../types/models';

// Default color scheme
export const DEFAULT_CHART_COLORS: ChartColors = {
  solidBar: '#0070f3',
  hatchedBar: '#0070f3',
  todayLine: '#dc3545',
  finishDateLine: '#00ff00'
};

// Default display settings
export const DEFAULT_DISPLAY_SETTINGS: ChartDisplaySettings = {
  releaseNameFontSize: '16',    // Medium (sizes: 14/16/18)
  dateLabelFontSize: '13',      // Medium (sizes: 11/13/15)
  dateLabelColor: '#666',        // Medium gray
  verticalLineWidth: '2'         // Thin
};

// Standard color palette (20 colors)
export const STANDARD_COLORS = [
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Blue', value: '#0070f3' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Slate', value: '#475569' },
  { name: 'Black', value: '#000000' }
];

// Color preset themes (10 themes)
export const COLOR_PRESETS: { [key: string]: ChartColors } = {
  'Default': DEFAULT_CHART_COLORS,
  'Professional': { solidBar: '#2c3e50', hatchedBar: '#34495e', todayLine: '#e74c3c', finishDateLine: '#27ae60' },
  'Colorful': { solidBar: '#9b59b6', hatchedBar: '#3498db', todayLine: '#e67e22', finishDateLine: '#2ecc71' },
  'Grayscale': { solidBar: '#555555', hatchedBar: '#777777', todayLine: '#333333', finishDateLine: '#999999' },
  'High Contrast': { solidBar: '#000000', hatchedBar: '#0066cc', todayLine: '#ff0000', finishDateLine: '#00ff00' },
  'Forest': { solidBar: '#2d5016', hatchedBar: '#56ab2f', todayLine: '#ff6b6b', finishDateLine: '#a3e635' },
  'Ocean': { solidBar: '#1e3a8a', hatchedBar: '#3b82f6', todayLine: '#f59e0b', finishDateLine: '#10b981' },
  'Sunset': { solidBar: '#dc2626', hatchedBar: '#f97316', todayLine: '#7c2d12', finishDateLine: '#84cc16' },
  'Lavender': { solidBar: '#7c3aed', hatchedBar: '#a78bfa', todayLine: '#ec4899', finishDateLine: '#86efac' },
  'Earth': { solidBar: '#78350f', hatchedBar: '#92400e', todayLine: '#15803d', finishDateLine: '#4ade80' }
};

// Grayscale color options
export const GRAYSCALE_COLORS = [
  { color: '#999', name: 'Light Gray' },
  { color: '#666', name: 'Gray' },
  { color: '#333', name: 'Dark Gray' },
  { color: '#000', name: 'Black' }
];

// Colors for completed releases
export const COMPLETED_RELEASE_COLORS = {
  solidBar: '#90EE90',   // Light green
  hatchedBar: '#228B22'  // Forest green
};
