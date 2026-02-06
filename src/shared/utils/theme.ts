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

  // Accent (active tabs, primary actions)
  accent: string;
  accentText: string;
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
  buttonBg: '#f0f0f0',
  buttonBorder: '#ddd',
  accent: '#0070f3',
  accentText: 'white',
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
  buttonBg: '#2d3748',
  buttonBorder: '#4a5568',
  accent: '#3b82f6',
  accentText: 'white',
};
