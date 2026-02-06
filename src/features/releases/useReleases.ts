// Releases CRUD operations hook

import { useState } from 'react';
import { Release } from '../../shared/types';
import { useAppData } from '../../context/AppDataContext';
import { isValidDateFormat, generateId, parseDateLocal, formatDateISO } from '../../shared/utils';

export function useReleases() {
  const { data, updateData } = useAppData();
  const [releaseName, setReleaseName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [earlyFinish, setEarlyFinish] = useState('');
  const [lateFinish, setLateFinish] = useState('');
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState({ startDate: false, earlyFinish: false, lateFinish: false });

  const addRelease = (selectedProjectId: string) => {
    // Mark all fields as touched to trigger validation
    setTouchedFields({ startDate: true, earlyFinish: true, lateFinish: true });

    if (!releaseName.trim() || !selectedProjectId || !startDate || !earlyFinish || !lateFinish) return;

    // Validate date formats and ranges
    if (!isValidDateFormat(startDate) || !isValidDateFormat(earlyFinish) || !isValidDateFormat(lateFinish)) return;

    const newRelease: Release = {
      id: generateId(),
      projectId: selectedProjectId,
      name: releaseName.trim(),
      startDate,
      earlyFinishDate: earlyFinish,
      lateFinishDate: lateFinish
    };
    const newData = { ...data, releases: [...data.releases, newRelease] };
    updateData(newData);
    clearReleaseForm();
  };

  const updateRelease = () => {
    // Mark all fields as touched to trigger validation
    setTouchedFields({ startDate: true, earlyFinish: true, lateFinish: true });

    if (!releaseName.trim() || !editingReleaseId || !startDate || !earlyFinish || !lateFinish) return;

    // Validate date formats and ranges
    if (!isValidDateFormat(startDate) || !isValidDateFormat(earlyFinish) || !isValidDateFormat(lateFinish)) return;

    const newData = {
      ...data,
      releases: data.releases.map(r =>
        r.id === editingReleaseId ? {
          ...r,
          name: releaseName.trim(),
          startDate,
          earlyFinishDate: earlyFinish,
          lateFinishDate: lateFinish
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
    setEditingReleaseId(release.id);
  };

  const clearReleaseForm = () => {
    setReleaseName('');
    setStartDate('');
    setEarlyFinish('');
    setLateFinish('');
    setEditingReleaseId(null);
    setTouchedFields({ startDate: false, earlyFinish: false, lateFinish: false });
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
      // Do NOT copy hidden or completed - new release starts fresh
    };

    const newData = { ...data, releases: [...data.releases, newRelease] };
    updateData(newData);
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
    duplicateRelease
  };
}
