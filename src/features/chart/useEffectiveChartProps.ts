// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Hook to compute effective chart props (snapshot vs live data)

import { useMemo } from 'react';
import { Release, ChartColors } from '../../shared/types';
import { Snapshot } from '../../shared/types/snapshots';

interface LiveChartData {
  releases: Release[];
  chartColors: ChartColors;
  labels: { solidBar: string; hatchedBar: string; finishDateLine: string; mostLikelyLine: string };
  preparedBy: string;
  finishDate?: string;
}

interface EffectiveChartProps {
  releases: Release[];
  colors: ChartColors;
  labels: { solidBar: string; hatchedBar: string; finishDateLine?: string; mostLikelyLine?: string };
  preparedBy: string;
  finishDate?: string;
  datePreparedOverride?: string;
}

export function useEffectiveChartProps(
  activeSnapshot: Snapshot | null,
  live: LiveChartData
): EffectiveChartProps {
  return useMemo(() => {
    if (!activeSnapshot) {
      return {
        releases: live.releases,
        colors: live.chartColors,
        labels: live.labels,
        preparedBy: live.preparedBy,
        finishDate: live.finishDate
      };
    }

    return {
      releases: activeSnapshot.releases,
      colors: activeSnapshot.chartColors ?? live.chartColors,
      labels: activeSnapshot.legendLabels ?? live.labels,
      preparedBy: activeSnapshot.preparedBy ?? live.preparedBy,
      finishDate: activeSnapshot.projectFinishDate ?? live.finishDate,
      datePreparedOverride: new Date(activeSnapshot.timestamp).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    };
  }, [activeSnapshot, live.releases, live.chartColors, live.labels, live.preparedBy, live.finishDate]);
}
