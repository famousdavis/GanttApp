// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// WorkWeekSection — Settings tab section for the global work-week configuration (v15.0).
// Mirrors the conventions of ExportAttributionSection (section/h3/description/control).

import type { ThemeColors } from '../../shared/utils/theme';
import { WorkWeekSelector } from '../../shared/components/WorkWeekSelector';

interface WorkWeekSectionProps {
  colors: ThemeColors;
  globalWorkDays: number[] | undefined;
  onChange: (days: number[]) => void;
  onReset: () => void;
}

export function WorkWeekSection({
  colors,
  globalWorkDays,
  onChange,
  onReset,
}: WorkWeekSectionProps) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Work Week</h3>
      <p style={{ color: colors.textSecondary, marginBottom: '1rem', lineHeight: '1.6' }}>
        Pick the days of the week you consider workdays. You&apos;ll see a warning when a release date lands outside this set. Individual projects can override this default. New accounts start with Monday&ndash;Friday.
      </p>
      <WorkWeekSelector
        value={globalWorkDays}
        onChange={onChange}
        colors={colors}
        allowReset={true}
        onReset={onReset}
      />
    </section>
  );
}
