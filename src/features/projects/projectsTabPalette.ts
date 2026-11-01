// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Colours for the Projects tab and its dialogs, by theme.
//
// Text here reaches 4.5:1 and icons, focus rings and control boundaries 3:1
// against the backgrounds they sit on. Where a shared theme token falls short
// (textMuted, inputBorder, …) this tab uses its own colour rather than
// changing the token, so other tabs look as they did.

import type { CSSProperties } from 'react';
import type { ThemeColors } from '../../shared/utils/theme';

export interface ProjectsTabPalette {
  text: string;
  meta: string;
  warn: string;
  error: string;
  errorBorder: string;
  inputBorder: string;
  inputBg: string;
  link: string;
  focus: string;
  surface: string;
  bg: string;
  border: string;
  btnBorder: string;
  hoverBg: string;
  tileHoverBorder: string;
  shadow: string;
  primary: string;
  primaryHover: string;
  grip: string;
}

const LIGHT: ProjectsTabPalette = {
  text: '#333333',
  meta: '#666666',
  warn: '#b45309',
  error: '#b91c1c',
  errorBorder: '#dc3545',
  inputBorder: '#8a8a8a',
  inputBg: '#ffffff',
  link: '#0062d1',
  focus: '#0070f3',
  surface: '#f9f9f9',
  bg: '#ffffff',
  border: '#eeeeee',
  btnBorder: '#8a8a8a',
  hoverBg: '#f5f5f5',
  tileHoverBorder: '#93c5fd',
  shadow: 'rgba(15, 23, 42, 0.10)',
  primary: '#0070f3',
  primaryHover: '#005bc4',
  grip: '#808080',
};

const DARK: ProjectsTabPalette = {
  text: '#e2e8f0',
  meta: '#a0aec0',
  warn: '#fbbf24',
  error: '#fca5a5',
  errorBorder: '#f87171',
  inputBorder: '#8b9bb4',
  inputBg: '#2d3748',
  link: '#60a5fa',
  focus: '#60a5fa',
  surface: '#16213e',
  bg: '#1a1a2e',
  border: '#2d3748',
  btnBorder: '#8b9bb4',
  hoverBg: '#2d3748',
  tileHoverBorder: '#3b82f6',
  shadow: 'rgba(0, 0, 0, 0.35)',
  primary: '#0070f3',
  primaryHover: '#005bc4',
  grip: '#9ca3af',
};

export function projectsTabPalette(resolvedTheme: 'light' | 'dark'): ProjectsTabPalette {
  return resolvedTheme === 'dark' ? DARK : LIGHT;
}

/** The palette as the --pt-* custom properties the tab's stylesheet reads. */
export function paletteStyle(p: ProjectsTabPalette): CSSProperties {
  return {
    '--pt-text': p.text,
    '--pt-meta': p.meta,
    '--pt-warn': p.warn,
    '--pt-error': p.error,
    '--pt-error-border': p.errorBorder,
    '--pt-input-border': p.inputBorder,
    '--pt-input-bg': p.inputBg,
    '--pt-link': p.link,
    '--pt-focus': p.focus,
    '--pt-surface': p.surface,
    '--pt-bg': p.bg,
    '--pt-border': p.border,
    '--pt-btn-border': p.btnBorder,
    '--pt-hover-bg': p.hoverBg,
    '--pt-tile-hover-border': p.tileHoverBorder,
    '--pt-shadow': p.shadow,
    '--pt-primary': p.primary,
    '--pt-primary-hover': p.primaryHover,
    '--pt-grip': p.grip,
  } as CSSProperties;
}

/**
 * The theme colours with this tab's passing replacements, for shared
 * components drawn on this tab (ConfirmDialog, WorkWeekSelector, the import
 * preview): a Cancel's border, a chip's border and muted text.
 */
export function patchedColors(colors: ThemeColors, p: ProjectsTabPalette): ThemeColors {
  return {
    ...colors,
    border: p.btnBorder,
    borderLight: p.inputBorder,
    inputBorder: p.inputBorder,
    textMuted: p.meta,
  };
}
