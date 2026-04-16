// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

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
  legendLabels: { solidBar: string; hatchedBar: string; finishDateLine?: string; mostLikelyLine?: string; inProgress?: string };
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

  // Reset to Current view when project changes (render-time derivation, React's getDerivedStateFromProps pattern)
  const [prevProjectId, setPrevProjectId] = useState(selectedProjectId);
  if (prevProjectId !== selectedProjectId) {
    setPrevProjectId(selectedProjectId);
    setActiveSnapshotId(null);
  }

  // Snapshots for the current project, sorted by timestamp descending (newest first)
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

  // If active snapshot was deleted externally, reset to Current (render-time derivation)
  if (activeSnapshotId && !snapshots.some(s => s.id === activeSnapshotId)) {
    setActiveSnapshotId(null);
  }

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
      // Optimistic update: append to existing state rather than replacing
      // with cloud service's return array (avoids Firestore cache staleness)
      setAllSnapshots(prev => [...prev, snapshot]);
    }
  }, [selectedProjectId, storage]);

  // Delete a snapshot (caller is responsible for confirmation UI)
  const handleDeleteSnapshot = useCallback(async (snapshotId: string) => {
    await storage.deleteSnapshot(snapshotId);
    // Optimistic update: remove from existing state rather than replacing
    // with cloud service's return array (avoids Firestore cache staleness)
    setAllSnapshots(prev => prev.filter(s => s.id !== snapshotId));
    setActiveSnapshotId(null);
  }, [storage]);

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
