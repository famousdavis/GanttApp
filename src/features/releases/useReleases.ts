// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Releases CRUD operations hook

import { useState } from 'react';
import { Release } from '../../shared/types';
import { useAppData } from '../../context/AppDataContext';
import { isValidDateFormat, generateId, parseDateLocal, formatDateISO, validateReleaseDateChange } from '../../shared/utils';
import { sanitizeString } from '../../shared/utils/validation';

export function useReleases() {
  const { data, updateData } = useAppData();
  const [releaseName, setReleaseName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [earlyFinish, setEarlyFinish] = useState('');
  const [lateFinish, setLateFinish] = useState('');
  const [mostLikelyFinish, setMostLikelyFinish] = useState('');
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState({ startDate: false, earlyFinish: false, lateFinish: false, mostLikelyFinish: false });

  const addRelease = (selectedProjectId: string) => {
    // Mark all fields as touched to trigger validation
    setTouchedFields({ startDate: true, earlyFinish: true, lateFinish: true, mostLikelyFinish: true });

    if (!releaseName.trim() || !selectedProjectId || !startDate || !earlyFinish || !lateFinish) return;

    // Validate date formats and ranges
    if (!isValidDateFormat(startDate) || !isValidDateFormat(earlyFinish) || !isValidDateFormat(lateFinish)) return;

    // Validate mostLikelyFinish against early/late bounds using shared validator
    const mlValid = mostLikelyFinish
      && !validateReleaseDateChange({ startDate, earlyFinishDate: earlyFinish, lateFinishDate: lateFinish }, 'mostLikely', mostLikelyFinish);

    const newRelease: Release = {
      id: generateId(),
      projectId: selectedProjectId,
      name: sanitizeString(releaseName),
      startDate,
      earlyFinishDate: earlyFinish,
      lateFinishDate: lateFinish,
      ...(mlValid ? { mostLikelyFinishDate: mostLikelyFinish } : {})
    };
    const newData = { ...data, releases: [...data.releases, newRelease] };
    updateData(newData);
    clearReleaseForm();
  };

  const updateRelease = () => {
    // Mark all fields as touched to trigger validation
    setTouchedFields({ startDate: true, earlyFinish: true, lateFinish: true, mostLikelyFinish: true });

    if (!releaseName.trim() || !editingReleaseId || !startDate || !earlyFinish || !lateFinish) return;

    // Validate date formats and ranges
    if (!isValidDateFormat(startDate) || !isValidDateFormat(earlyFinish) || !isValidDateFormat(lateFinish)) return;

    // Validate mostLikelyFinish against early/late bounds using shared validator
    const mlValid = mostLikelyFinish
      && !validateReleaseDateChange({ startDate, earlyFinishDate: earlyFinish, lateFinishDate: lateFinish }, 'mostLikely', mostLikelyFinish);

    const newData = {
      ...data,
      releases: data.releases.map(r =>
        r.id === editingReleaseId ? {
          ...r,
          name: sanitizeString(releaseName),
          startDate,
          earlyFinishDate: earlyFinish,
          lateFinishDate: lateFinish,
          mostLikelyFinishDate: mlValid ? mostLikelyFinish : undefined
        } : r
      )
    };
    updateData(newData);
    clearReleaseForm();
  };

  const deleteRelease = (id: string) => {
    const newData = {
      ...data,
      releases: data.releases.filter(r => r.id !== id)
    };
    updateData(newData);
  };

  const startEditRelease = (release: Release) => {
    setReleaseName(release.name);
    setStartDate(release.startDate);
    setEarlyFinish(release.earlyFinishDate);
    setLateFinish(release.lateFinishDate);
    setMostLikelyFinish(release.mostLikelyFinishDate || '');
    setEditingReleaseId(release.id);
  };

  const clearReleaseForm = () => {
    setReleaseName('');
    setStartDate('');
    setEarlyFinish('');
    setLateFinish('');
    setMostLikelyFinish('');
    setEditingReleaseId(null);
    setTouchedFields({ startDate: false, earlyFinish: false, lateFinish: false, mostLikelyFinish: false });
  };

  const toggleReleaseHidden = (id: string) => {
    const newData = {
      ...data,
      releases: data.releases.map(r =>
        r.id === id ? { ...r, hidden: !r.hidden } : r
      )
    };
    updateData(newData);
  };

  const toggleReleaseCompleted = (id: string) => {
    const newData = {
      ...data,
      releases: data.releases.map(r =>
        r.id === id ? { ...r, completed: !r.completed } : r
      )
    };
    updateData(newData);
  };

  const duplicateRelease = (releaseId: string) => {
    const original = data.releases.find(r => r.id === releaseId);
    if (!original) return;

    // Calculate timestamps for date arithmetic
    const startMs = parseDateLocal(original.startDate);
    const earlyMs = parseDateLocal(original.earlyFinishDate);
    const lateMs = parseDateLocal(original.lateFinishDate);

    // Calculate offsets from start date
    const earlyOffsetMs = earlyMs - startMs;
    const lateOffsetMs = lateMs - startMs;

    // New release starts where the original's late finish date was
    const newStartMs = lateMs;

    const newRelease: Release = {
      id: generateId(),
      projectId: original.projectId,
      name: `${original.name} (copy)`,
      startDate: formatDateISO(newStartMs),
      earlyFinishDate: formatDateISO(newStartMs + earlyOffsetMs),
      lateFinishDate: formatDateISO(newStartMs + lateOffsetMs),
      // Do NOT copy hidden, completed, or mostLikelyFinishDate - new release starts fresh
    };

    const newData = { ...data, releases: [...data.releases, newRelease] };
    updateData(newData);
  };

  /**
   * Update a single date field on a release (for inline chart editing)
   * Returns true if successful, false if validation fails
   */
  const updateReleaseDate = (
    releaseId: string,
    dateType: 'start' | 'early' | 'late' | 'mostLikely',
    newDate: string
  ): boolean => {
    const release = data.releases.find(r => r.id === releaseId);
    if (!release) return false;

    // Use shared validation
    const error = validateReleaseDateChange(release, dateType, newDate);
    if (error) return false;

    // Build updated release fields based on date type
    const updatedFields = dateType === 'mostLikely'
      ? { mostLikelyFinishDate: newDate }
      : {
          startDate: dateType === 'start' ? newDate : release.startDate,
          earlyFinishDate: dateType === 'early' ? newDate : release.earlyFinishDate,
          lateFinishDate: dateType === 'late' ? newDate : release.lateFinishDate
        };

    const newData = {
      ...data,
      releases: data.releases.map(r =>
        r.id === releaseId ? { ...r, ...updatedFields } : r
      )
    };
    updateData(newData);
    return true;
  };

  return {
    releaseName,
    setReleaseName,
    startDate,
    setStartDate,
    earlyFinish,
    setEarlyFinish,
    lateFinish,
    setLateFinish,
    mostLikelyFinish,
    setMostLikelyFinish,
    editingReleaseId,
    touchedFields,
    setTouchedFields,
    addRelease,
    updateRelease,
    deleteRelease,
    startEditRelease,
    clearReleaseForm,
    toggleReleaseHidden,
    toggleReleaseCompleted,
    duplicateRelease,
    updateReleaseDate
  };
}
