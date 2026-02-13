// Hook for managing inline editing state in the Gantt chart

import { useState, useCallback } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { parseDateLocal } from '../../shared/utils/dates';

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
    if (editingLegendLabel === 'solid') setSolidBarLabel(tempLabelValue);
    else if (editingLegendLabel === 'hatched') setHatchedBarLabel(tempLabelValue);
    else if (editingLegendLabel === 'finishDate') setFinishDateLabel(tempLabelValue);
    else if (editingLegendLabel === 'mostLikelyLine') setMostLikelyLineLabel(tempLabelValue);
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

    // Handle most likely finish date separately
    if (dateType === 'mostLikely') {
      const earlyMs = parseDateLocal(release.earlyFinishDate);
      const lateMs = parseDateLocal(release.lateFinishDate);
      const mlMs = parseDateLocal(tempDateValue);
      if (mlMs < earlyMs) {
        setDateEditError('Must be >= Early Finish');
        return;
      }
      if (mlMs > lateMs) {
        setDateEditError('Must be <= Late Finish');
        return;
      }
      const updatedReleases = data.releases.map(r =>
        r.id === editingDateInfo.releaseId
          ? { ...r, mostLikelyFinishDate: tempDateValue }
          : r
      );
      updateData({ ...data, releases: updatedReleases });
      cancelDateEdit();
      return;
    }

    // Get the dates that would result from this change
    const startDate = dateType === 'start' ? tempDateValue : release.startDate;
    const earlyFinishDate = dateType === 'early' ? tempDateValue : release.earlyFinishDate;
    const lateFinishDate = dateType === 'late' ? tempDateValue : release.lateFinishDate;

    // Validate date ordering
    const startMs = parseDateLocal(startDate);
    const earlyMs = parseDateLocal(earlyFinishDate);
    const lateMs = parseDateLocal(lateFinishDate);

    if (startMs >= earlyMs) {
      setDateEditError('Start must be before Early Finish');
      return;
    }
    if (earlyMs > lateMs) {
      setDateEditError('Early Finish must be <= Late Finish');
      return;
    }

    // Apply the update
    const updatedReleases = data.releases.map(r =>
      r.id === editingDateInfo.releaseId
        ? { ...r, startDate, earlyFinishDate, lateFinishDate }
        : r
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
