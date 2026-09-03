// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Hook for managing inline editing state in the Gantt chart

import { useState, useCallback } from 'react';
import { useAppData } from '../../context/AppDataContext';
import { validateReleaseDateChange, sanitizeString, resolveLabel, DEFAULT_LEGEND_LABELS } from '../../shared/utils/validation';
import type { ProjectLegendLabels } from '../../shared/types/models';

export type DateType = 'start' | 'early' | 'late' | 'mostLikely';
export type LegendLabelType = 'solid' | 'hatched' | 'finishDate' | 'mostLikelyLine' | 'inProgress';

/** Map LegendLabelType (UI terminology) → keyof ProjectLegendLabels (storage terminology).
 *
 * v0.28.16: exported. Types erase, so there is no runtime enumeration of
 * LegendLabelType; `Object.keys()` on this Record is the only enumeration that
 * stays exhaustive BY TYPECHECK when a sixth legend label is added. A
 * hand-written array would not — see the readOnly parity test in
 * ChartLegend.test.tsx. */
export const LEGEND_TYPE_TO_KEY: Record<LegendLabelType, keyof ProjectLegendLabels> = {
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
  // v0.28.16 (§5): the effective value the editor OPENED with. saveLabelEdit
  // compares against it so a no-change commit writes nothing. Shape chosen by
  // measurement: recomputing the resolveLabel chain inside saveLabelEdit puts it
  // at cognitive complexity 27 and would add a 14th lint finding; holding the
  // seed in state keeps it at 14, under the 15 threshold.
  const [seededLabelValue, setSeededLabelValue] = useState('');

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
    // v16.2: global state can be '' (uncustomized) — fall back to DEFAULT_LEGEND_LABELS
    // so the edit input opens with what the user sees on the chart, never empty.
    const project = activeProjectId ? data.projects.find(p => p.id === activeProjectId) : undefined;
    const projectLabels = project?.legendLabels;
    const key = LEGEND_TYPE_TO_KEY[type];
    const globalLabel =
      type === 'solid' ? (solidBarLabel || DEFAULT_LEGEND_LABELS.solidBar)
      : type === 'hatched' ? (hatchedBarLabel || DEFAULT_LEGEND_LABELS.hatchedBar)
      : type === 'finishDate' ? (finishDateLabel || DEFAULT_LEGEND_LABELS.finishDateLine)
      : type === 'mostLikelyLine' ? (mostLikelyLineLabel || DEFAULT_LEGEND_LABELS.mostLikelyLine)
      : (inProgressLabel || DEFAULT_LEGEND_LABELS.inProgress);
    const seed = resolveLabel(key, projectLabels, globalLabel);
    setTempLabelValue(seed);
    setSeededLabelValue(seed);
  };

  const saveLabelEdit = () => {
    const sanitized = sanitizeString(tempLabelValue, 50);
    if (!sanitized) {
      // Reject empty/whitespace-only labels — cancel instead
      cancelLabelEdit();
      return;
    }

    // v0.28.16 (§5): no-change commits write nothing. Without this, opening a
    // label and leaving without typing would create a PROJECT-SCOPE OVERRIDE —
    // saveLabelEdit writes `{ ...project.legendLabels, [key]: sanitized }`
    // unconditionally — surfacing ↺, detaching the label from Settings, and
    // firing a Firestore project-meta write. That was already reachable via a
    // deliberate ✓ on an unchanged label; commit-on-blur would have extended it
    // to an accidental gesture. This closes both paths.
    if (sanitized === seededLabelValue) {
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

  const applyDateEdit = (discardInvalid: boolean) => {
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
      // ✓ / Enter: keep the editor open on the bad value so it can be corrected.
      // Blur: the editor is closing either way, so discard and keep the original.
      if (discardInvalid) cancelDateEdit();
      else setDateEditError(error);
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

  /** ✓ button and Enter. An invalid date sets the error and keeps the editor open. */
  const saveDateEdit = () => applyDateEdit(false);

  /**
   * v0.28.16 (§4) — blur. Commits when valid, DISCARDS when invalid, always closes.
   *
   * This re-validates the CURRENT value rather than reading `dateEditError`. That
   * flag records a PRIOR failed save and is stale at blur, so gating on it (in
   * either spelling — `dateEditError === ''` and the `hasError` prop are the same
   * boolean) would leave the editor open and following the user's focus: a trap.
   * The `!editingDateInfo` and `!release` guards inside applyDateEdit still carry
   * their own weight; only the empty-string half is subsumed by the validator,
   * whose first line rejects '' as an invalid date format. That matters because
   * startDate / earlyFinishDate / lateFinishDate are REQUIRED fields.
   */
  const commitDateEdit = () => applyDateEdit(true);

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
    commitDateEdit,
    cancelDateEdit,

    // Utility
    hasActiveEditor
  };
}
