// Hook for managing snapshot state in the Gantt chart

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Snapshot } from '../../shared/types';
import { getSnapshotsForProject } from '../../shared/utils/snapshots';
import { generateId, getTodayFormatted } from '../../shared/utils/dates';
import { Release, ChartColors } from '../../shared/types';
import { useStorage } from '../../context/StorageContext';
import { sanitizeString } from '../../shared/utils/validation';

interface SaveSnapshotParams {
  releases: Release[];
  projectFinishDate?: string;
  chartColors: ChartColors;
  legendLabels: { solidBar: string; hatchedBar: string; finishDateLine?: string; mostLikelyLine?: string };
  preparedBy: string;
}

export function useSnapshots(selectedProjectId: string) {
  const { storage } = useStorage();
  const [allSnapshots, setAllSnapshots] = useState<Snapshot[]>([]);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);

  // Load snapshots on mount (or when storage service changes)
  useEffect(() => {
    let cancelled = false;
    storage.loadSnapshots().then(snapshots => {
      if (!cancelled) setAllSnapshots(snapshots);
    });
    return () => { cancelled = true; };
  }, [storage]);

  // Reset to Current view when project changes
  useEffect(() => {
    setActiveSnapshotId(null);
  }, [selectedProjectId]);

  // Snapshots for the current project, sorted by timestamp ascending
  const snapshots = useMemo(
    () => getSnapshotsForProject(allSnapshots, selectedProjectId),
    [allSnapshots, selectedProjectId]
  );

  // The active snapshot object (or null for Current view)
  const activeSnapshot = useMemo(
    () => activeSnapshotId ? snapshots.find(s => s.id === activeSnapshotId) ?? null : null,
    [snapshots, activeSnapshotId]
  );

  const isViewingSnapshot = activeSnapshot !== null;

  // If active snapshot was deleted externally, reset to Current
  useEffect(() => {
    if (activeSnapshotId && !snapshots.some(s => s.id === activeSnapshotId)) {
      setActiveSnapshotId(null);
    }
  }, [snapshots, activeSnapshotId]);

  // Save a new snapshot
  const saveSnapshot = useCallback(async (params: SaveSnapshotParams) => {
    const defaultName = getTodayFormatted();
    const userInput = window.prompt('Enter a name for this snapshot (optional):', defaultName);

    // User clicked Cancel
    if (userInput === null) return;

    const snapshot: Snapshot = {
      id: generateId(),
      projectId: selectedProjectId,
      timestamp: new Date().toISOString(),
      name: sanitizeString(userInput) || defaultName,
      releases: structuredClone(params.releases),
      projectFinishDate: params.projectFinishDate,
      chartColors: structuredClone(params.chartColors),
      legendLabels: { ...params.legendLabels },
      preparedBy: params.preparedBy
    };

    const result = await storage.addSnapshot(snapshot);
    if (result === null) {
      alert('Snapshot limit reached. Delete old snapshots to save new ones.');
    } else {
      setAllSnapshots(result);
    }
  }, [selectedProjectId, storage]);

  // Delete a snapshot
  const handleDeleteSnapshot = useCallback(async (snapshotId: string) => {
    const snap = allSnapshots.find(s => s.id === snapshotId);
    const label = snap ? `"${snap.name}"` : 'this snapshot';
    const dateStr = snap ? new Date(snap.timestamp).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    }) : '';

    if (!window.confirm(`Delete snapshot ${label}${dateStr ? ` (${dateStr})` : ''}?`)) {
      return;
    }

    const updated = await storage.deleteSnapshot(snapshotId);
    setAllSnapshots(updated);
    setActiveSnapshotId(null);
  }, [allSnapshots, storage]);

  // For export: expose the raw setter so import can replace all snapshots
  const replaceAllSnapshots = useCallback(async (snapshots: Snapshot[]) => {
    await storage.saveSnapshots(snapshots);
    setAllSnapshots(snapshots);
  }, [storage]);

  return {
    snapshots,
    activeSnapshotId,
    activeSnapshot,
    isViewingSnapshot,
    setActiveSnapshotId,
    saveSnapshot,
    deleteSnapshot: handleDeleteSnapshot,
    allSnapshots,
    replaceAllSnapshots
  };
}
