// Chart calculation hook for date range, coordinates, and dimensions

import { useMemo } from 'react';
import { Release } from '../../shared/types';
import { parseDateLocal, getQuarterBoundaries, getTodayString } from '../../shared/utils';

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
  today: Date;
  todayTime: number;
  todayInRange: boolean;
  todayX: number | null;
  quarterBoundaries: Date[];
}

const CHART_DIMENSIONS: ChartDimensions = {
  chartWidth: 900,
  chartHeight: 0, // Calculated based on releases
  leftMargin: 230,
  rightMargin: 30,
  topMargin: 50,
  barHeight: 30,
  rowHeight: 60
};

export function useChartCalculations(releases: Release[], projectFinishDate?: string) {
  const dimensions: ChartDimensions = useMemo(() => ({
    ...CHART_DIMENSIONS,
    chartHeight: releases.length * CHART_DIMENSIONS.rowHeight + 80
  }), [releases.length]);

  const dateInfo: ChartDateInfo = useMemo(() => {
    // Calculate date range
    const allDates = releases.flatMap(r => [
      parseDateLocal(r.startDate),
      parseDateLocal(r.lateFinishDate)
    ]);

    const minDate = Math.min(...allDates);
    const maxDate = Math.max(...allDates);
    const dateRange = maxDate - minDate;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // Check if today is within the chart range
    const todayInRange = todayTime >= minDate && todayTime <= maxDate;
    const todayString = getTodayString();
    const todayX = todayInRange ? dateToX(todayString, minDate, dateRange, dimensions) : null;

    // Calculate quarter boundaries
    const quarterBoundaries = getQuarterBoundaries(minDate, maxDate);

    return {
      minDate,
      maxDate,
      dateRange,
      today,
      todayTime,
      todayInRange,
      todayX,
      quarterBoundaries
    };
  }, [releases, dimensions]);

  const finishDateInfo = useMemo(() => {
    if (!projectFinishDate) {
      return { finishDateInRange: false, finishDateX: null };
    }

    const finishDateTime = parseDateLocal(projectFinishDate);
    const finishDateInRange = finishDateTime >= dateInfo.minDate && finishDateTime <= dateInfo.maxDate;
    const finishDateX = finishDateInRange ? dateToX(projectFinishDate, dateInfo.minDate, dateInfo.dateRange, dimensions) : null;

    return { finishDateInRange, finishDateX };
  }, [projectFinishDate, dateInfo.minDate, dateInfo.maxDate, dateInfo.dateRange, dimensions]);

  // Helper function to convert date to X coordinate
  const dateToXHelper = (date: string) => {
    return dateToX(date, dateInfo.minDate, dateInfo.dateRange, dimensions);
  };

  return {
    dimensions,
    dateInfo,
    finishDateInfo,
    dateToX: dateToXHelper
  };
}

// Convert date string to X coordinate
function dateToX(date: string, minDate: number, dateRange: number, dimensions: ChartDimensions): number {
  const timestamp = parseDateLocal(date);
  const ratio = (timestamp - minDate) / dateRange;
  return dimensions.leftMargin + ratio * (dimensions.chartWidth - dimensions.leftMargin - dimensions.rightMargin);
}
