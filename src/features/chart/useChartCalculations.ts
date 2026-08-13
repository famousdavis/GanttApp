// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Chart calculation hook for date range, coordinates, and dimensions

import { useMemo } from 'react';
import { Release, ChartDisplaySettings } from '../../shared/types';
import { parseDateLocal, getQuarterBoundaries, getMonthBoundaries, getTodayString, isValidDateFormat } from '../../shared/utils';
import { darkenColor } from '../../shared/utils/colors';

export interface ChartDimensions {
  chartWidth: number;
  chartHeight: number;
  leftMargin: number;
  rightMargin: number;
  topMargin: number;
  barHeight: number;
  rowHeight: number;
}

export interface ChartDateInfo {
  minDate: number;
  maxDate: number;
  dateRange: number;
  /**
   * v0.28.0: every `today*` field below reflects the EFFECTIVE date the today
   * line is drawn at — the status-date override when one is set, otherwise the
   * real current date. "Date Prepared" is computed separately and always
   * reports the real date.
   */
  today: Date;
  todayTime: number;
  todayDateString: string;
  todayInRange: boolean;
  todayX: number | null;
  quarterBoundaries: Date[];
  monthBoundaries: Date[];
}

// Fixed chart layout constants
const CHART_WIDTH = 1100;
const LEFT_MARGIN = 280;
const RIGHT_MARGIN = 50;
const TOP_MARGIN = 50;
const MIN_LABEL_SPACING = 40;

export function useChartCalculations(
  releases: Release[],
  displaySettings: ChartDisplaySettings,
  projectFinishDate?: string,
  showMonths?: boolean,
  todayDateOverride?: string
) {
  const barHeight = parseInt(displaySettings.barHeight);
  const rowSpacing = parseInt(displaySettings.rowSpacing);

  const dimensions: ChartDimensions = useMemo(() => {
    const rowHeight = barHeight + rowSpacing;
    const topMargin = showMonths ? TOP_MARGIN + 25 : TOP_MARGIN;
    return {
      chartWidth: CHART_WIDTH,
      chartHeight: releases.length * rowHeight + 80 + (showMonths ? 25 : 0),
      leftMargin: LEFT_MARGIN,
      rightMargin: RIGHT_MARGIN,
      topMargin,
      barHeight,
      rowHeight
    };
  }, [releases.length, barHeight, rowSpacing, showMonths]);

  const dateInfo: ChartDateInfo = useMemo(() => {
    const allDates = releases.flatMap(r => [
      parseDateLocal(r.startDate),
      parseDateLocal(r.lateFinishDate)
    ]);

    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);
    const dateRange = maxDate - minDate;

    // v0.28.0: the today line is drawn at the status-date override when one is
    // set and parses, otherwise at the real current date. The format guard is
    // defence-in-depth — every ingestion path already validates — but a bad
    // value here would produce NaN coordinates and a broken SVG.
    const todayDateString = todayDateOverride && isValidDateFormat(todayDateOverride)
      ? todayDateOverride
      : getTodayString();
    const todayTime = parseDateLocal(todayDateString);
    const today = new Date(todayTime);

    const todayInRange = todayTime >= minDate && todayTime <= maxDate;
    const todayX = todayInRange ? dateToX(todayDateString, minDate, dateRange, dimensions) : null;

    const quarterBoundaries = getQuarterBoundaries(minDate, maxDate);
    const monthBoundaries = getMonthBoundaries(minDate, maxDate);

    return {
      minDate,
      maxDate,
      dateRange,
      today,
      todayTime,
      todayDateString,
      todayInRange,
      todayX,
      quarterBoundaries,
      monthBoundaries
    };
  }, [releases, dimensions, todayDateOverride]);

  const finishDateInfo = useMemo(() => {
    if (!projectFinishDate) {
      return { finishDateInRange: false, finishDateX: null };
    }

    const finishDateTime = parseDateLocal(projectFinishDate);
    const finishDateInRange = finishDateTime >= dateInfo.minDate && finishDateTime <= dateInfo.maxDate;
    const finishDateX = finishDateInRange ? dateToX(projectFinishDate, dateInfo.minDate, dateInfo.dateRange, dimensions) : null;

    return { finishDateInRange, finishDateX };
  }, [projectFinishDate, dateInfo.minDate, dateInfo.maxDate, dateInfo.dateRange, dimensions]);

  const dateToXHelper = (date: string) => {
    return dateToX(date, dateInfo.minDate, dateInfo.dateRange, dimensions);
  };

  // Get years spanning the date range
  const years = useMemo(() => {
    const startYear = new Date(dateInfo.minDate).getFullYear();
    const endYear = new Date(dateInfo.maxDate).getFullYear();
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  }, [dateInfo.minDate, dateInfo.maxDate]);

  // Get release colors based on status (complete, in-progress, or default)
  const getReleaseColors = (release: Release, chartColors: { solidBar: string; hatchedBar: string; completedBar: string; inProgressBar: string }) => {
    if (release.status === 'complete') {
      return { solidBar: chartColors.completedBar, hatchedBar: darkenColor(chartColors.completedBar, 0.35) };
    }
    if (release.status === 'in-progress') {
      return { solidBar: chartColors.inProgressBar, hatchedBar: chartColors.hatchedBar };
    }
    return { solidBar: chartColors.solidBar, hatchedBar: chartColors.hatchedBar };
  };

  return {
    dimensions,
    dateInfo,
    finishDateInfo,
    dateToX: dateToXHelper,
    years,
    getReleaseColors,
    minLabelSpacing: MIN_LABEL_SPACING
  };
}

// Convert date string to X coordinate
function dateToX(date: string, minDate: number, dateRange: number, dimensions: ChartDimensions): number {
  if (dateRange === 0) {
    return dimensions.leftMargin + (dimensions.chartWidth - dimensions.leftMargin - dimensions.rightMargin) / 2;
  }
  const timestamp = parseDateLocal(date);
  const ratio = (timestamp - minDate) / dateRange;
  return dimensions.leftMargin + ratio * (dimensions.chartWidth - dimensions.leftMargin - dimensions.rightMargin);
}
