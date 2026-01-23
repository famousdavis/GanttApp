// Releases CRUD operations hook

import { useState } from 'react';
import { Release } from '../../shared/types';
import { useAppData } from '../../context/AppDataContext';

export function useReleases() {
  const { data, updateData } = useAppData();
  const [releaseName, setReleaseName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [earlyFinish, setEarlyFinish] = useState('');
  const [lateFinish, setLateFinish] = useState('');
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);
  const [touchedFields, setTouchedFields] = useState({ startDate: false, earlyFinish: false, lateFinish: false });

  const addRelease = (selectedProjectId: string) => {
    if (!releaseName.trim() || !selectedProjectId || !startDate || !earlyFinish || !lateFinish) return;

    const newRelease: Release = {
      id: Date.now().toString(),
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
    if (!releaseName.trim() || !editingReleaseId || !startDate || !earlyFinish || !lateFinish) return;

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
    toggleReleaseCompleted
  };
}
