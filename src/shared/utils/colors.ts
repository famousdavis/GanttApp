// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Color constants and presets for GanttApp

import { ChartColors, ChartDisplaySettings } from '../types/models';

/**
 * Darken a hex color by a given factor (0 = black, 1 = no change)
 */
export function darkenColor(hex: string, factor: number): string {
  const cleaned = hex.replace('#', '');
  const fullHex = cleaned.length === 3
    ? cleaned.split('').map(c => c + c).join('')
    : cleaned;
  const r = Math.round(parseInt(fullHex.substring(0, 2), 16) * factor);
  const g = Math.round(parseInt(fullHex.substring(2, 4), 16) * factor);
  const b = Math.round(parseInt(fullHex.substring(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Default color scheme
export const DEFAULT_CHART_COLORS: ChartColors = {
  solidBar: '#0070f3',
  hatchedBar: '#0070f3',
  todayLine: '#dc3545',
  finishDateLine: '#00ff00',
  mostLikelyLine: '#0070f3',
  completedBar: '#90ee90',
  inProgressBar: '#f59e0b'
};

// Default display settings
export const DEFAULT_DISPLAY_SETTINGS: ChartDisplaySettings = {
  releaseNameFontSize: '16',    // Medium (sizes: 14/16/18)
  dateLabelFontSize: '13',      // Medium (sizes: 11/13/15)
  dateLabelColor: '#666',        // Medium gray
  verticalLineWidth: '2',        // Thin
  barHeight: '30',               // Small (sizes: 30/40/50)
  rowSpacing: '25'               // Medium (sizes: 20/25/30)
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
  'Professional': { solidBar: '#2c3e50', hatchedBar: '#34495e', todayLine: '#e74c3c', finishDateLine: '#27ae60', mostLikelyLine: '#34495e', completedBar: '#90ee90', inProgressBar: '#e67e22' },
  'Colorful': { solidBar: '#9b59b6', hatchedBar: '#3498db', todayLine: '#e67e22', finishDateLine: '#2ecc71', mostLikelyLine: '#3498db', completedBar: '#90ee90', inProgressBar: '#e67e22' },
  'Grayscale': { solidBar: '#555555', hatchedBar: '#777777', todayLine: '#333333', finishDateLine: '#999999', mostLikelyLine: '#dc2626', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
  'High Contrast': { solidBar: '#000000', hatchedBar: '#0066cc', todayLine: '#ff0000', finishDateLine: '#00ff00', mostLikelyLine: '#0066cc', completedBar: '#90ee90', inProgressBar: '#ff8c00' },
  'Forest': { solidBar: '#2d5016', hatchedBar: '#56ab2f', todayLine: '#ff6b6b', finishDateLine: '#a3e635', mostLikelyLine: '#56ab2f', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
  'Ocean': { solidBar: '#1e3a8a', hatchedBar: '#3b82f6', todayLine: '#f59e0b', finishDateLine: '#10b981', mostLikelyLine: '#3b82f6', completedBar: '#90ee90', inProgressBar: '#f97316' },
  'Sunset': { solidBar: '#dc2626', hatchedBar: '#f97316', todayLine: '#7c2d12', finishDateLine: '#84cc16', mostLikelyLine: '#f97316', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
  'Lavender': { solidBar: '#7c3aed', hatchedBar: '#a78bfa', todayLine: '#ec4899', finishDateLine: '#86efac', mostLikelyLine: '#a78bfa', completedBar: '#90ee90', inProgressBar: '#f59e0b' },
  'Earth': { solidBar: '#78350f', hatchedBar: '#92400e', todayLine: '#15803d', finishDateLine: '#4ade80', mostLikelyLine: '#92400e', completedBar: '#90ee90', inProgressBar: '#f59e0b' }
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
