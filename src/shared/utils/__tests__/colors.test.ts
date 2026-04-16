// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CHART_COLORS,
  DEFAULT_DISPLAY_SETTINGS,
  STANDARD_COLORS,
  COLOR_PRESETS,
  GRAYSCALE_COLORS,
  COMPLETED_RELEASE_COLORS,
  darkenColor,
} from '../colors';

describe('DEFAULT_CHART_COLORS', () => {
  it('has all required color properties', () => {
    expect(DEFAULT_CHART_COLORS).toHaveProperty('solidBar');
    expect(DEFAULT_CHART_COLORS).toHaveProperty('hatchedBar');
    expect(DEFAULT_CHART_COLORS).toHaveProperty('todayLine');
    expect(DEFAULT_CHART_COLORS).toHaveProperty('finishDateLine');
    expect(DEFAULT_CHART_COLORS).toHaveProperty('completedBar');
    expect(DEFAULT_CHART_COLORS).toHaveProperty('inProgressBar');
  });

  it('has valid hex color values', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    expect(DEFAULT_CHART_COLORS.solidBar).toMatch(hexRegex);
    expect(DEFAULT_CHART_COLORS.hatchedBar).toMatch(hexRegex);
    expect(DEFAULT_CHART_COLORS.todayLine).toMatch(hexRegex);
    expect(DEFAULT_CHART_COLORS.finishDateLine).toMatch(hexRegex);
    expect(DEFAULT_CHART_COLORS.completedBar).toMatch(hexRegex);
    expect(DEFAULT_CHART_COLORS.inProgressBar).toMatch(hexRegex);
  });
});

describe('DEFAULT_DISPLAY_SETTINGS', () => {
  it('has all required display properties', () => {
    expect(DEFAULT_DISPLAY_SETTINGS).toHaveProperty('releaseNameFontSize');
    expect(DEFAULT_DISPLAY_SETTINGS).toHaveProperty('dateLabelFontSize');
    expect(DEFAULT_DISPLAY_SETTINGS).toHaveProperty('dateLabelColor');
    expect(DEFAULT_DISPLAY_SETTINGS).toHaveProperty('verticalLineWidth');
    expect(DEFAULT_DISPLAY_SETTINGS).toHaveProperty('barHeight');
  });

  it('has valid default values', () => {
    expect(['14', '16', '18']).toContain(DEFAULT_DISPLAY_SETTINGS.releaseNameFontSize);
    expect(['11', '13', '15']).toContain(DEFAULT_DISPLAY_SETTINGS.dateLabelFontSize);
    expect(['#999', '#666', '#333', '#000']).toContain(DEFAULT_DISPLAY_SETTINGS.dateLabelColor);
    expect(['2', '3', '4']).toContain(DEFAULT_DISPLAY_SETTINGS.verticalLineWidth);
    expect(['30', '40', '50']).toContain(DEFAULT_DISPLAY_SETTINGS.barHeight);
  });
});

describe('STANDARD_COLORS', () => {
  it('contains 20 colors', () => {
    expect(STANDARD_COLORS).toHaveLength(20);
  });

  it('each color has a name and value', () => {
    STANDARD_COLORS.forEach((color) => {
      expect(color).toHaveProperty('name');
      expect(color).toHaveProperty('value');
      expect(color.name.length).toBeGreaterThan(0);
    });
  });

  it('all values are valid hex colors', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    STANDARD_COLORS.forEach((color) => {
      expect(color.value).toMatch(hexRegex);
    });
  });

  it('has no duplicate color names', () => {
    const names = STANDARD_COLORS.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('has no duplicate color values', () => {
    const values = STANDARD_COLORS.map((c) => c.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

describe('COLOR_PRESETS', () => {
  it('contains 10 preset themes', () => {
    expect(Object.keys(COLOR_PRESETS)).toHaveLength(10);
  });

  it('each preset has all 7 required color properties', () => {
    Object.entries(COLOR_PRESETS).forEach(([name, colors]) => {
      expect(colors, `Preset "${name}" missing solidBar`).toHaveProperty('solidBar');
      expect(colors, `Preset "${name}" missing hatchedBar`).toHaveProperty('hatchedBar');
      expect(colors, `Preset "${name}" missing todayLine`).toHaveProperty('todayLine');
      expect(colors, `Preset "${name}" missing finishDateLine`).toHaveProperty('finishDateLine');
      expect(colors, `Preset "${name}" missing mostLikelyLine`).toHaveProperty('mostLikelyLine');
      expect(colors, `Preset "${name}" missing completedBar`).toHaveProperty('completedBar');
      expect(colors, `Preset "${name}" missing inProgressBar`).toHaveProperty('inProgressBar');
    });
  });

  it('all preset colors are valid hex codes', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    Object.entries(COLOR_PRESETS).forEach(([name, colors]) => {
      expect(colors.solidBar, `${name}.solidBar`).toMatch(hexRegex);
      expect(colors.hatchedBar, `${name}.hatchedBar`).toMatch(hexRegex);
      expect(colors.todayLine, `${name}.todayLine`).toMatch(hexRegex);
      expect(colors.finishDateLine, `${name}.finishDateLine`).toMatch(hexRegex);
      expect(colors.mostLikelyLine, `${name}.mostLikelyLine`).toMatch(hexRegex);
      expect(colors.completedBar, `${name}.completedBar`).toMatch(hexRegex);
      expect(colors.inProgressBar, `${name}.inProgressBar`).toMatch(hexRegex);
    });
  });

  it('includes a Default preset matching DEFAULT_CHART_COLORS', () => {
    expect(COLOR_PRESETS['Default']).toEqual(DEFAULT_CHART_COLORS);
  });

  it('has expected preset names', () => {
    const names = Object.keys(COLOR_PRESETS);
    expect(names).toContain('Default');
    expect(names).toContain('Professional');
    expect(names).toContain('Colorful');
    expect(names).toContain('Grayscale');
    expect(names).toContain('High Contrast');
  });
});

describe('GRAYSCALE_COLORS', () => {
  it('contains 4 grayscale options', () => {
    expect(GRAYSCALE_COLORS).toHaveLength(4);
  });

  it('each option has color and name properties', () => {
    GRAYSCALE_COLORS.forEach((item) => {
      expect(item).toHaveProperty('color');
      expect(item).toHaveProperty('name');
    });
  });

  it('colors are ordered from light to dark', () => {
    const expectedOrder = ['#999', '#666', '#333', '#000'];
    const actualOrder = GRAYSCALE_COLORS.map((c) => c.color);
    expect(actualOrder).toEqual(expectedOrder);
  });
});

describe('COMPLETED_RELEASE_COLORS', () => {
  it('has solidBar and hatchedBar colors', () => {
    expect(COMPLETED_RELEASE_COLORS).toHaveProperty('solidBar');
    expect(COMPLETED_RELEASE_COLORS).toHaveProperty('hatchedBar');
  });

  it('uses green tones for completed releases', () => {
    // Light green for solid bar
    expect(COMPLETED_RELEASE_COLORS.solidBar).toBe('#90EE90');
    // Forest green for hatched bar
    expect(COMPLETED_RELEASE_COLORS.hatchedBar).toBe('#228B22');
  });
});

describe('darkenColor', () => {
  it('darkens a color by the given factor', () => {
    const result = darkenColor('#90EE90', 0.35);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    const r = parseInt(result.slice(1, 3), 16);
    const g = parseInt(result.slice(3, 5), 16);
    const b = parseInt(result.slice(5, 7), 16);
    expect(r).toBeLessThan(144);
    expect(g).toBeLessThan(238);
    expect(b).toBeLessThan(144);
  });

  it('returns black when factor is 0', () => {
    expect(darkenColor('#ff0000', 0)).toBe('#000000');
  });

  it('returns same color when factor is 1', () => {
    expect(darkenColor('#0070f3', 1)).toBe('#0070f3');
  });

  it('handles 3-digit hex codes', () => {
    const result = darkenColor('#fff', 0.5);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
    expect(result).toBe('#808080');
  });
});
