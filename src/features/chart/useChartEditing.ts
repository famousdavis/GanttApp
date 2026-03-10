// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Hook for managing inline editing state in the Gantt chart

import { useState, useCallback } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { validateReleaseDateChange } from '../../shared/utils/validation';

export type DateType = 'start' | 'early' | 'late' | 'mostLikely';
export type LegendLabelType = 'solid' | 'hatched' | 'finishDate' | 'mostLikelyLine';

interface DateEditInfo {
  releaseId: string;
  dateType: DateType;
}

export function useChartEditing() {
  const { data, updateData, solidBarLabel, setSolidBarLabel, hatchedBarLabel, setHatchedBarLabel, finishDateLabel, setFinishDateLabel, mostLikelyLineLabel, setMostLikelyLineLabel } = useAppData();

  // Legend label editing
  const [editingLegendLabel, setEditingLegendLabel] = useState<LegendLabelType | null>(null);
  const [tempLabelValue, setTempLabelValue] = useState('');

  // Release name editing
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [tempReleaseName, setTempReleaseName] = useState('');

  // Date editing
  const [editingDateInfo, setEditingDateInfo] = useState<DateEditInfo | null>(null);
  const [tempDateValue, setTempDateValue] = useState('');
  const [dateEditError, setDateEditError] = useState('');

  // Legend label handlers
  const startEditLabel = (type: LegendLabelType) => {
    setEditingLegendLabel(type);
    if (type === 'solid') setTempLabelValue(solidBarLabel);
    else if (type === 'hatched') setTempLabelValue(hatchedBarLabel);
    else if (type === 'finishDate') setTempLabelValue(finishDateLabel);
    else if (type === 'mostLikelyLine') setTempLabelValue(mostLikelyLineLabel);
  };

  const saveLabelEdit = () => {
    const trimmed = tempLabelValue.trim();
    if (!trimmed) {
      // Reject empty/whitespace-only labels — cancel instead
      cancelLabelEdit();
      return;
    }
    if (editingLegendLabel === 'solid') setSolidBarLabel(trimmed);
    else if (editingLegendLabel === 'hatched') setHatchedBarLabel(trimmed);
    else if (editingLegendLabel === 'finishDate') setFinishDateLabel(trimmed);
    else if (editingLegendLabel === 'mostLikelyLine') setMostLikelyLineLabel(trimmed);
    setEditingLegendLabel(null);
  };

  const cancelLabelEdit = useCallback(() => {
    setEditingLegendLabel(null);
    setTempLabelValue('');
  }, []);

  // Release name handlers
  const startEditReleaseName = (releaseId: string, currentName: string) => {
    setEditingReleaseId(releaseId);
    setTempReleaseName(currentName);
  };

  const saveReleaseNameEdit = () => {
    if (editingReleaseId && tempReleaseName.trim()) {
      const updatedReleases = data.releases.map(r =>
        r.id === editingReleaseId ? { ...r, name: tempReleaseName.trim() } : r
      );
      updateData({ ...data, releases: updatedReleases });
    }
    setEditingReleaseId(null);
    setTempReleaseName('');
  };

  const cancelReleaseNameEdit = useCallback(() => {
    setEditingReleaseId(null);
    setTempReleaseName('');
  }, []);

  // Date editing handlers
  const startEditDate = (releaseId: string, dateType: DateType, currentDate: string) => {
    setEditingDateInfo({ releaseId, dateType });
    setTempDateValue(currentDate);
    setDateEditError('');
  };

  const saveDateEdit = () => {
    if (!editingDateInfo || !tempDateValue) {
      cancelDateEdit();
      return;
    }

    const release = data.releases.find(r => r.id === editingDateInfo.releaseId);
    if (!release) {
      cancelDateEdit();
      return;
    }

    const { dateType } = editingDateInfo;

    // Validate using shared function
    const error = validateReleaseDateChange(release, dateType, tempDateValue);
    if (error) {
      setDateEditError(error);
      return;
    }

    // Build updated release fields based on date type
    const updatedFields = dateType === 'mostLikely'
      ? { mostLikelyFinishDate: tempDateValue }
      : {
          startDate: dateType === 'start' ? tempDateValue : release.startDate,
          earlyFinishDate: dateType === 'early' ? tempDateValue : release.earlyFinishDate,
          lateFinishDate: dateType === 'late' ? tempDateValue : release.lateFinishDate
        };

    const updatedReleases = data.releases.map(r =>
      r.id === editingDateInfo.releaseId ? { ...r, ...updatedFields } : r
    );
    updateData({ ...data, releases: updatedReleases });
    cancelDateEdit();
  };

  const cancelDateEdit = useCallback(() => {
    setEditingDateInfo(null);
    setTempDateValue('');
    setDateEditError('');
  }, []);

  // Check if any editor is open (for keyboard shortcuts)
  const hasActiveEditor = editingLegendLabel !== null || editingReleaseId !== null || editingDateInfo !== null;

  return {
    // Legend label editing
    editingLegendLabel,
    tempLabelValue,
    setTempLabelValue,
    startEditLabel,
    saveLabelEdit,
    cancelLabelEdit,

    // Release name editing
    editingReleaseId,
    tempReleaseName,
    setTempReleaseName,
    startEditReleaseName,
    saveReleaseNameEdit,
    cancelReleaseNameEdit,

    // Date editing
    editingDateInfo,
    tempDateValue,
    setTempDateValue,
    dateEditError,
    startEditDate,
    saveDateEdit,
    cancelDateEdit,

    // Utility
    hasActiveEditor
  };
}
