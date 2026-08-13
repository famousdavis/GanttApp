// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Hook to compute effective chart props (snapshot vs live data)

import { useMemo } from 'react';
import { Release, ChartColors } from '../../shared/types';
import { ProjectLegendLabels } from '../../shared/types/models';
import { Snapshot } from '../../shared/types/snapshots';
import { resolveLabel } from '../../shared/utils/validation';

interface LiveChartData {
  releases: Release[];
  chartColors: ChartColors;
  labels: { solidBar: string; hatchedBar: string; finishDateLine: string; mostLikelyLine: string; inProgress: string };
  preparedBy: string;
  finishDate?: string;
  todayDateOverride?: string;
}

interface EffectiveChartProps {
  releases: Release[];
  colors: ChartColors;
  labels: { solidBar: string; hatchedBar: string; finishDateLine?: string; mostLikelyLine?: string; inProgress?: string };
  preparedBy: string;
  finishDate?: string;
  todayDateOverride?: string;
  datePreparedOverride?: string;
}

export function useEffectiveChartProps(
  activeSnapshot: Snapshot | null,
  live: LiveChartData,
  projectLegendLabels: ProjectLegendLabels | undefined
): EffectiveChartProps {
  return useMemo(() => {
    // Merge project-level overrides onto global labels (v16.1).
    // Single source of truth: resolveLabel — called here and in useChartEditing.startEditLabel.
    const mergedLabels = {
      solidBar: resolveLabel('solidBar', projectLegendLabels, live.labels.solidBar),
      hatchedBar: resolveLabel('hatchedBar', projectLegendLabels, live.labels.hatchedBar),
      finishDateLine: resolveLabel('finishDateLine', projectLegendLabels, live.labels.finishDateLine),
      mostLikelyLine: resolveLabel('mostLikelyLine', projectLegendLabels, live.labels.mostLikelyLine),
      inProgress: resolveLabel('inProgress', projectLegendLabels, live.labels.inProgress),
    };

    if (!activeSnapshot) {
      return {
        releases: live.releases,
        colors: live.chartColors,
        labels: mergedLabels,
        preparedBy: live.preparedBy,
        finishDate: live.finishDate,
        todayDateOverride: live.todayDateOverride
      };
    }

    return {
      releases: activeSnapshot.releases,
      colors: activeSnapshot.chartColors ?? live.chartColors,
      // Precedence: snapshot frozen labels → project override → global. When a snapshot
      // has no frozen labels, fall through to the merged project-override-or-global set.
      // v16.2: snapshot.legendLabels fields are all optional — spread mergedLabels as
      // the base (all 5 strings guaranteed) and let snapshot keys override where defined.
      labels: activeSnapshot.legendLabels
        ? { ...mergedLabels, ...activeSnapshot.legendLabels }
        : mergedLabels,
      preparedBy: activeSnapshot.preparedBy ?? live.preparedBy,
      finishDate: activeSnapshot.projectFinishDate ?? live.finishDate,
      // v0.28.0 — deliberately NO `?? live.todayDateOverride`. A snapshot taken
      // with no status date must keep drawing the today line at the real current
      // date, and a pre-v0.28.0 snapshot must not inherit an override set later.
      // Falling through to the live value would rewrite history on every view.
      todayDateOverride: activeSnapshot.todayDateOverride,
      datePreparedOverride: new Date(activeSnapshot.timestamp).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    };
  }, [activeSnapshot, live.releases, live.chartColors, live.labels, live.preparedBy, live.finishDate, live.todayDateOverride, projectLegendLabels]);
}
