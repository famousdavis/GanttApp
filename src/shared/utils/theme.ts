// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Theme utility - Color constants for light and dark modes

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Page backgrounds
  background: string;
  surface: string;       // cards, form backgrounds

  // Borders
  border: string;
  borderLight: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;

  // Form inputs
  inputBg: string;
  inputBorder: string;

  // Hover states
  hoverBg: string;

  // Chart-specific
  chartBg: string;
  chartBorder: string;
  svgText: string;
  gridLine: string;

  // Buttons
  buttonBg: string;
  buttonBorder: string;
  buttonText: string;

  // Accent (active tabs, primary actions)
  accent: string;
  accentText: string;
  activePresetBg: string;
}

export const LIGHT_THEME: ThemeColors = {
  background: '#ffffff',
  surface: '#f9f9f9',
  border: '#eee',
  borderLight: '#ddd',
  text: '#333',
  textSecondary: '#666',
  textMuted: '#999',
  inputBg: '#fff',
  inputBorder: '#ddd',
  hoverBg: '#f5f5f5',
  chartBg: '#ffffff',
  chartBorder: '#eee',
  svgText: '#333',
  gridLine: '#c0c0c0',
  buttonBg: '#ffffff',
  buttonBorder: '#0070f3',
  buttonText: '#0070f3',
  accent: '#0070f3',
  accentText: 'white',
  activePresetBg: '#e6f2ff',
};

export const DARK_THEME: ThemeColors = {
  background: '#1a1a2e',
  surface: '#16213e',
  border: '#2d3748',
  borderLight: '#4a5568',
  text: '#e2e8f0',
  textSecondary: '#a0aec0',
  textMuted: '#718096',
  inputBg: '#2d3748',
  inputBorder: '#4a5568',
  hoverBg: '#2d3748',
  chartBg: '#1e2a3a',
  chartBorder: '#2d3748',
  svgText: '#e2e8f0',
  gridLine: '#4a5568',
  buttonBg: '#1a1a2e',
  buttonBorder: '#3b82f6',
  buttonText: '#3b82f6',
  accent: '#3b82f6',
  accentText: 'white',
  activePresetBg: '#1e3a5f',
};
