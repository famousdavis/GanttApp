// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Hook for managing inline editing state in the Gantt chart

import { useState, useCallback } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { validateReleaseDateChange, sanitizeString, resolveLabel } from '../../shared/utils/validation';
import type { ProjectLegendLabels } from '../../shared/types/models';

export type DateType = 'start' | 'early' | 'late' | 'mostLikely';
export type LegendLabelType = 'solid' | 'hatched' | 'finishDate' | 'mostLikelyLine' | 'inProgress';

/** Map LegendLabelType (UI terminology) → keyof ProjectLegendLabels (storage terminology). */
const LEGEND_TYPE_TO_KEY: Record<LegendLabelType, keyof ProjectLegendLabels> = {
  solid: 'solidBar',
  hatched: 'hatchedBar',
  finishDate: 'finishDateLine',
  mostLikelyLine: 'mostLikelyLine',
  inProgress: 'inProgress',
};

interface DateEditInfo {
  releaseId: string;
  dateType: DateType;
}

export function useChartEditing(activeProjectId?: string) {
  const { data, updateData, solidBarLabel, setSolidBarLabel, hatchedBarLabel, setHatchedBarLabel, finishDateLabel, setFinishDateLabel, mostLikelyLineLabel, setMostLikelyLineLabel, inProgressLabel, setInProgressLabel } = useAppData();

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
    // Start the edit input at the EFFECTIVE value (project override if present, else global).
    // Uses resolveLabel — the single source of truth shared with useEffectiveChartProps.
    const project = activeProjectId ? data.projects.find(p => p.id === activeProjectId) : undefined;
    const projectLabels = project?.legendLabels;
    const key = LEGEND_TYPE_TO_KEY[type];
    const globalLabel =
      type === 'solid' ? solidBarLabel
      : type === 'hatched' ? hatchedBarLabel
      : type === 'finishDate' ? finishDateLabel
      : type === 'mostLikelyLine' ? mostLikelyLineLabel
      : inProgressLabel;
    setTempLabelValue(resolveLabel(key, projectLabels, globalLabel));
  };

  const saveLabelEdit = () => {
    const sanitized = sanitizeString(tempLabelValue, 50);
    if (!sanitized) {
      // Reject empty/whitespace-only labels — cancel instead
      cancelLabelEdit();
      return;
    }

    const key = editingLegendLabel ? LEGEND_TYPE_TO_KEY[editingLegendLabel] : undefined;

    if (activeProjectId && key) {
      // Project-scope save — write to project.legendLabels; preserve other keys.
      const project = data.projects.find(p => p.id === activeProjectId);
      if (project) {
        const newLabels: ProjectLegendLabels = { ...(project.legendLabels ?? {}), [key]: sanitized };
        const updatedProject = { ...project, legendLabels: newLabels };
        updateData({
          ...data,
          projects: data.projects.map(p => p.id === activeProjectId ? updatedProject : p),
        });
      }
    } else {
      // Global-scope save (unchanged behavior when no project selected).
      if (editingLegendLabel === 'solid') setSolidBarLabel(sanitized);
      else if (editingLegendLabel === 'hatched') setHatchedBarLabel(sanitized);
      else if (editingLegendLabel === 'finishDate') setFinishDateLabel(sanitized);
      else if (editingLegendLabel === 'mostLikelyLine') setMostLikelyLineLabel(sanitized);
      else if (editingLegendLabel === 'inProgress') setInProgressLabel(sanitized);
    }
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
    const sanitizedName = sanitizeString(tempReleaseName);
    if (editingReleaseId && sanitizedName) {
      const updatedReleases = data.releases.map(r =>
        r.id === editingReleaseId ? { ...r, name: sanitizedName } : r
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
