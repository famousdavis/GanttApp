// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Chart settings panel with display options, colors, and presets

import { ChartColors, ChartDisplaySettings } from '../../shared/types';
import { useTheme } from '../../context/ThemeContext';
import { ColorSwatchPicker, GrayscaleSwatchPicker, PresetButtonGroup } from '../../shared/components/ColorPickers';
import { COLOR_PRESETS } from '../../shared/utils/colors';
import { sanitizeString } from '../../shared/utils/validation';

interface ChartSettingsProps {
  showColorSettings: boolean;
  setShowColorSettings: (show: boolean) => void;
  showTodayLine: boolean;
  setShowTodayLine: (show: boolean) => void;
  showFinishDateLine: boolean;
  setShowFinishDateLine: (show: boolean) => void;
  showMostLikelyLine: boolean;
  setShowMostLikelyLine: (show: boolean) => void;
  showMonths: boolean;
  setShowMonths: (show: boolean) => void;
  hasProjectFinishDate: boolean;
  hasMostLikelyReleases: boolean;
  displaySettings: ChartDisplaySettings;
  setDisplaySettings: (settings: ChartDisplaySettings) => void;
  chartColors: ChartColors;
  onColorsChange: (colors: ChartColors, presetName?: string) => void;
  activePreset?: string;
  preparedBy: string;
  setPreparedBy: (name: string) => void;
  showPreparedBy: boolean;
  setShowPreparedBy: (show: boolean) => void;
}

export function ChartSettings({
  showColorSettings,
  setShowColorSettings,
  showTodayLine,
  setShowTodayLine,
  showFinishDateLine,
  setShowFinishDateLine,
  showMostLikelyLine,
  setShowMostLikelyLine,
  showMonths,
  setShowMonths,
  hasProjectFinishDate,
  hasMostLikelyReleases,
  displaySettings,
  setDisplaySettings,
  chartColors,
  onColorsChange,
  activePreset,
  preparedBy,
  setPreparedBy,
  showPreparedBy,
  setShowPreparedBy
}: ChartSettingsProps) {
  const { colors } = useTheme();

  return (
    <div style={{ marginTop: '2rem' }}>
      <h3
        onClick={() => setShowColorSettings(!showColorSettings)}
        style={{
          fontSize: '1.2rem',
          marginBottom: '1rem',
          color: colors.text,
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        Chart Settings {showColorSettings ? '▲' : '▼'}
      </h3>

      {showColorSettings && (
        <div style={{ padding: '1.5rem', background: colors.surface, borderRadius: '8px', border: `1px solid ${colors.border}` }}>
          {/* Toggle Settings */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showTodayLine}
                  onChange={(e) => setShowTodayLine(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Show Today&apos;s Date</span>
              </label>
              {hasProjectFinishDate && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showFinishDateLine}
                    onChange={(e) => setShowFinishDateLine(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Show Finish Date</span>
                </label>
              )}
              {hasMostLikelyReleases && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showMostLikelyLine}
                    onChange={(e) => setShowMostLikelyLine(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Show Most Likely Finish</span>
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showMonths}
                  onChange={(e) => setShowMonths(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span>Show Months</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={showPreparedBy}
                    onChange={(e) => setShowPreparedBy(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Show Prepared By</span>
                </label>
                <input
                  type="text"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(sanitizeString(e.target.value))}
                  placeholder="Enter your name"
                  maxLength={100}
                  style={{
                    padding: '0.3rem 0.5rem',
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    background: colors.inputBg,
                    color: colors.text,
                    width: '180px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Display Settings */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
              <PresetButtonGroup
                label="Release Name Font Size"
                value={displaySettings.releaseNameFontSize}
                options={[
                  { value: '14', label: 'Small' },
                  { value: '16', label: 'Medium' },
                  { value: '18', label: 'Large' }
                ]}
                onChange={(value) => setDisplaySettings({ ...displaySettings, releaseNameFontSize: value as '14' | '16' | '18' })}
              />
              <PresetButtonGroup
                label="Date Label Font Size"
                value={displaySettings.dateLabelFontSize}
                options={[
                  { value: '11', label: 'Small' },
                  { value: '13', label: 'Medium' },
                  { value: '15', label: 'Large' }
                ]}
                onChange={(value) => setDisplaySettings({ ...displaySettings, dateLabelFontSize: value as '11' | '13' | '15' })}
              />
              <GrayscaleSwatchPicker
                label="Date Label Color"
                value={displaySettings.dateLabelColor}
                onChange={(color) => setDisplaySettings({ ...displaySettings, dateLabelColor: color as '#999' | '#666' | '#333' | '#000' })}
              />
              <PresetButtonGroup
                label="Vertical Line Width"
                value={displaySettings.verticalLineWidth}
                options={[
                  { value: '2', label: 'Thin' },
                  { value: '3', label: 'Medium' },
                  { value: '4', label: 'Thick' }
                ]}
                onChange={(value) => setDisplaySettings({ ...displaySettings, verticalLineWidth: value as '2' | '3' | '4' })}
              />
              <PresetButtonGroup
                label="Bar Height"
                value={displaySettings.barHeight}
                options={[
                  { value: '30', label: 'S' },
                  { value: '40', label: 'M' },
                  { value: '50', label: 'L' }
                ]}
                onChange={(value) => setDisplaySettings({ ...displaySettings, barHeight: value as '30' | '40' | '50' })}
              />
              <PresetButtonGroup
                label="Row Spacing"
                value={displaySettings.rowSpacing}
                options={[
                  { value: '20', label: 'S' },
                  { value: '25', label: 'M' },
                  { value: '30', label: 'L' }
                ]}
                onChange={(value) => setDisplaySettings({ ...displaySettings, rowSpacing: value as '20' | '25' | '30' })}
              />
            </div>
          </div>

          {/* Color Settings */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
              <ColorSwatchPicker
                label="Solid Bar"
                value={chartColors.solidBar}
                onChange={(color) => onColorsChange({ ...chartColors, solidBar: color })}
              />
              <ColorSwatchPicker
                label="Hatched Bar"
                value={chartColors.hatchedBar}
                onChange={(color) => onColorsChange({ ...chartColors, hatchedBar: color })}
                hatched
              />
              <ColorSwatchPicker
                label="Today's Date"
                value={chartColors.todayLine}
                onChange={(color) => onColorsChange({ ...chartColors, todayLine: color })}
              />
              <ColorSwatchPicker
                label="Project Finish Date"
                value={chartColors.finishDateLine}
                onChange={(color) => onColorsChange({ ...chartColors, finishDateLine: color })}
              />
              {showMostLikelyLine && (
                <ColorSwatchPicker
                  label="Most Likely"
                  value={chartColors.mostLikelyLine}
                  onChange={(color) => onColorsChange({ ...chartColors, mostLikelyLine: color })}
                />
              )}
              <ColorSwatchPicker
                label="Completed"
                value={chartColors.completedBar}
                onChange={(color) => onColorsChange({ ...chartColors, completedBar: color })}
              />
            </div>
          </div>

          {/* Color Presets */}
          <div>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: colors.textSecondary }}>Color Presets</h4>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {Object.keys(COLOR_PRESETS).map(presetName => {
                const isActive = activePreset === presetName;
                return (
                  <button
                    key={presetName}
                    onClick={() => onColorsChange(COLOR_PRESETS[presetName], presetName)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: isActive ? colors.activePresetBg : colors.buttonBg,
                      border: isActive ? '2px solid #0070f3' : `2px solid ${colors.borderLight}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: isActive ? '600' : 'normal',
                      color: colors.text
                    }}
                  >
                    {presetName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
