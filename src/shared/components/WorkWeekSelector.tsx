// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// WorkWeekSelector — controlled 7-chip day-of-week toggle (v15.0).
// Used by the global Settings work-week section and by the per-project override in the Project form.

import type { ThemeColors } from '../utils/theme';

export interface WorkWeekSelectorProps {
  /** Currently selected days (0=Sun ... 6=Sat). Undefined = "use default" (displays Mon–Fri visually but parent has not persisted anything). */
  value: number[] | undefined;
  /** Called with the new array on every toggle. Array is sorted ascending and deduped. Never called with undefined or empty array. */
  onChange: (days: number[]) => void;
  /** Theme colors (parent passes from useTheme()). */
  colors: ThemeColors;
  /** Optional placeholder text shown next to the chips when value is undefined. */
  placeholder?: string;
  /** If true, render a "Reset to default" text button next to the chips when value is defined. */
  allowReset?: boolean;
  /** Callback invoked when the user clicks the Reset button. Only relevant when allowReset is true. */
  onReset?: () => void;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const DEFAULT_DAYS: ReadonlyArray<number> = [1, 2, 3, 4, 5];

export function WorkWeekSelector({
  value,
  onChange,
  colors,
  placeholder,
  allowReset = false,
  onReset,
}: WorkWeekSelectorProps) {
  // Visual fallback when the parent has not persisted anything yet
  const effectiveDays: number[] = value ?? [...DEFAULT_DAYS];

  const toggleDay = (dayIndex: number) => {
    const isSelected = effectiveDays.includes(dayIndex);
    const next = isSelected
      ? effectiveDays.filter(d => d !== dayIndex)
      : [...effectiveDays, dayIndex].sort((a, b) => a - b);
    // Enforce "at least one day" invariant — silently swallow attempts to deselect the last chip
    if (next.length === 0) return;
    onChange(next);
  };

  return (
    <div
      role="group"
      aria-label="Work week selector"
      style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}
    >
      {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => {
        const isSelected = effectiveDays.includes(dayIndex);
        const isLastSelected = isSelected && effectiveDays.length === 1;
        return (
          <button
            key={dayIndex}
            type="button"
            aria-pressed={isSelected}
            aria-label={DAY_NAMES[dayIndex]}
            disabled={isLastSelected}
            onClick={() => toggleDay(dayIndex)}
            style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: '50%',
              border: isSelected ? '2px solid #0070f3' : `1px solid ${colors.borderLight}`,
              background: isSelected ? '#0070f3' : colors.inputBg,
              color: isSelected ? '#fff' : colors.text,
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: isLastSelected ? 'not-allowed' : 'pointer',
              opacity: isLastSelected ? 0.5 : 1,
              transition: 'background 0.15s, border 0.15s',
              padding: 0,
            }}
          >
            {DAY_LABELS[dayIndex]}
          </button>
        );
      })}
      {value === undefined && placeholder && (
        <span style={{ color: colors.textMuted, fontSize: '0.8rem', marginLeft: '0.5rem' }}>
          {placeholder}
        </span>
      )}
      {allowReset && value !== undefined && onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            marginLeft: '0.5rem',
            padding: '0.25rem 0.5rem',
            background: 'transparent',
            border: 'none',
            color: '#0070f3',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: '600',
            textDecoration: 'underline',
          }}
        >
          Reset to default
        </button>
      )}
    </div>
  );
}
