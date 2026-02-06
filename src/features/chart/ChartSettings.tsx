// Chart settings panel with display options, colors, and presets

import { ChartColors, ChartDisplaySettings } from '../../shared/types';
import { useTheme } from '../../context/ThemeContext';
import { ColorSwatchPicker, GrayscaleSwatchPicker, PresetButtonGroup } from '../../shared/components/ColorPickers';
import { COLOR_PRESETS } from '../../shared/utils/colors';

interface ChartSettingsProps {
  showColorSettings: boolean;
  setShowColorSettings: (show: boolean) => void;
  showTodayLine: boolean;
  setShowTodayLine: (show: boolean) => void;
  showFinishDateLine: boolean;
  setShowFinishDateLine: (show: boolean) => void;
  hasProjectFinishDate: boolean;
  displaySettings: ChartDisplaySettings;
  setDisplaySettings: (settings: ChartDisplaySettings) => void;
  chartColors: ChartColors;
  onColorsChange: (colors: ChartColors, presetName?: string) => void;
  activePreset?: string;
}

export function ChartSettings({
  showColorSettings,
  setShowColorSettings,
  showTodayLine,
  setShowTodayLine,
  showFinishDateLine,
  setShowFinishDateLine,
  hasProjectFinishDate,
  displaySettings,
  setDisplaySettings,
  chartColors,
  onColorsChange,
  activePreset
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
                  <span>Show Project Finish Date</span>
                </label>
              )}
            </div>
          </div>

          {/* Display Settings */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
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
                  { value: '30', label: 'Small' },
                  { value: '40', label: 'Medium' },
                  { value: '50', label: 'Large' }
                ]}
                onChange={(value) => setDisplaySettings({ ...displaySettings, barHeight: value as '30' | '40' | '50' })}
              />
            </div>
          </div>

          {/* Color Settings */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <ColorSwatchPicker
                label="Solid Bar Color"
                value={chartColors.solidBar}
                onChange={(color) => onColorsChange({ ...chartColors, solidBar: color })}
              />
              <ColorSwatchPicker
                label="Hatched Bar Color"
                value={chartColors.hatchedBar}
                onChange={(color) => onColorsChange({ ...chartColors, hatchedBar: color })}
              />
              <ColorSwatchPicker
                label="Today's Date Line"
                value={chartColors.todayLine}
                onChange={(color) => onColorsChange({ ...chartColors, todayLine: color })}
              />
              <ColorSwatchPicker
                label="Project Finish Date Line"
                value={chartColors.finishDateLine}
                onChange={(color) => onColorsChange({ ...chartColors, finishDateLine: color })}
              />
            </div>
          </div>

          {/* Color Presets */}
          <div>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#555' }}>Color Presets</h4>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {Object.keys(COLOR_PRESETS).map(presetName => {
                const isActive = activePreset === presetName;
                return (
                  <button
                    key={presetName}
                    onClick={() => onColorsChange(COLOR_PRESETS[presetName], presetName)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: isActive ? '#e6f2ff' : 'white',
                      border: isActive ? '2px solid #0070f3' : '2px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: isActive ? '600' : 'normal'
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
