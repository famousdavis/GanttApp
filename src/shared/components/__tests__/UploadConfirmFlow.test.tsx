// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createRef, useState } from 'react';
import { UploadConfirmFlow, type UploadConfirmFlowHandle } from '../UploadConfirmFlow';
import { LIGHT_THEME } from '../../utils/theme';
import type { GanttStorageService } from '../../types/storage';

const localCopies = vi.hoisted(() => ({
  data: { projects: [] as { id: string; name: string }[], releases: [] as unknown[] },
  removeLocalProjectCopies: vi.fn(async (_ids: string[]) => {}),
  exportSelectedProjects: vi.fn(async (_ids: string[], _data: unknown, _storage: unknown, _opts: unknown) => ({ exported: 0 })),
}));

vi.mock('../../storage/local-gantt-storage-service', () => ({
  clearLocalProjectData: vi.fn(),
  removeLocalProjectCopies: localCopies.removeLocalProjectCopies,
  LocalGanttStorageService: class {
    mode = 'local' as const;
    loadAppData = async () => localCopies.data;
    loadSnapshots = async () => [];
  },
}));

vi.mock('../../utils/export', () => ({ exportSelectedProjects: localCopies.exportSelectedProjects }));

const stubStorage: GanttStorageService = {
  mode: 'local',
  loadAppData: vi.fn(),
  saveAppData: vi.fn(),
  loadSnapshots: vi.fn(),
  saveSnapshots: vi.fn(),
  addSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  deleteSnapshotsForProject: vi.fn(),
  cancelPendingSaves: vi.fn(),
} as unknown as GanttStorageService;

describe('UploadConfirmFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestCloudSwitch', () => {
    it('with 0 local projects: switches directly without prompt', () => {
      const onModeChange = vi.fn().mockResolvedValue(undefined);
      const ref = createRef<UploadConfirmFlowHandle>();
      render(
        <UploadConfirmFlow
          ref={ref}
          colors={LIGHT_THEME}
          isSwitching={false}
          localProjectCount={0}
          uploadResult={null}
          storage={stubStorage}
          onModeChange={onModeChange}
          onClearUploadResult={vi.fn()}
        />
      );
      act(() => { ref.current?.requestCloudSwitch(); });
      expect(onModeChange).toHaveBeenCalledWith('cloud');
      // No confirm dialog rendered.
      expect(screen.queryByText(/Upload them to the cloud/)).not.toBeInTheDocument();
    });

    it('with N>0 local projects: shows upload confirm dialog', () => {
      const onModeChange = vi.fn().mockResolvedValue(undefined);
      const ref = createRef<UploadConfirmFlowHandle>();
      render(
        <UploadConfirmFlow
          ref={ref}
          colors={LIGHT_THEME}
          isSwitching={false}
          localProjectCount={3}
          uploadResult={null}
          storage={stubStorage}
          onModeChange={onModeChange}
          onClearUploadResult={vi.fn()}
        />
      );
      act(() => { ref.current?.requestCloudSwitch(); });
      expect(screen.getByText('You have local projects. Upload them to the cloud?')).toBeInTheDocument();
      expect(onModeChange).not.toHaveBeenCalled();
    });

    it('clicking "Upload to Cloud" in confirm calls onModeChange and dismisses', async () => {
      const onModeChange = vi.fn().mockResolvedValue(undefined);
      const ref = createRef<UploadConfirmFlowHandle>();
      render(
        <UploadConfirmFlow
          ref={ref}
          colors={LIGHT_THEME}
          isSwitching={false}
          localProjectCount={3}
          uploadResult={null}
          storage={stubStorage}
          onModeChange={onModeChange}
          onClearUploadResult={vi.fn()}
        />
      );
      act(() => { ref.current?.requestCloudSwitch(); });
      await act(async () => {
        fireEvent.click(screen.getByText('Upload to Cloud'));
      });
      expect(onModeChange).toHaveBeenCalledWith('cloud');
      expect(screen.queryByText('You have local projects. Upload them to the cloud?')).not.toBeInTheDocument();
    });

    it('clicking "Cancel" in confirm dismisses without switching', () => {
      const onModeChange = vi.fn();
      const ref = createRef<UploadConfirmFlowHandle>();
      render(
        <UploadConfirmFlow
          ref={ref}
          colors={LIGHT_THEME}
          isSwitching={false}
          localProjectCount={3}
          uploadResult={null}
          storage={stubStorage}
          onModeChange={onModeChange}
          onClearUploadResult={vi.fn()}
        />
      );
      act(() => { ref.current?.requestCloudSwitch(); });
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByText('You have local projects. Upload them to the cloud?')).not.toBeInTheDocument();
      expect(onModeChange).not.toHaveBeenCalled();
    });
  });

  // After a switch to the cloud: the uploaded projects' copies in this browser
  // are already gone. Skipped projects (already in the cloud) get a prompt:
  // download this browser's copies and then remove them, or keep them.
  describe('after a switch to the cloud', () => {
    const SKIPPED_INTRO = 'These projects were already in your cloud, so they were not uploaded. This browser still has its own copy of each, which may differ from the cloud version:';
    const KEEP_WARNING = /^If you keep them: the next time you open GanttApp in this browser, it opens in local mode/;
    const result = (uploaded: string[], skipped: [string, string, string][]) => ({
      uploaded: uploaded.length,
      skipped: skipped.length,
      uploadedProjects: uploaded.map((name, i) => ({ id: `u${i}`, name })),
      skippedProjects: skipped.map(([id, localName, cloudName]) => ({ id, localName, cloudName })),
    });
    const cloudStorage = (loaded: boolean) =>
      ({ ...stubStorage, mode: 'cloud', canWrite: () => loaded }) as unknown as GanttStorageService;
    // Stands in for the parent, which clears the result when told to.
    function Parent({ initial, storage, onClear }: {
      initial: ReturnType<typeof result>; storage: GanttStorageService; onClear: () => void;
    }) {
      const [uploadResult, setUploadResult] = useState<ReturnType<typeof result> | null>(initial);
      return (
        <UploadConfirmFlow
          colors={LIGHT_THEME}
          isSwitching={false}
          localProjectCount={0}
          uploadResult={uploadResult as never}
          storage={storage}
          onModeChange={vi.fn()}
          onClearUploadResult={() => { onClear(); setUploadResult(null); }}
        />
      );
    }
    const renderFlow = (uploadResult: ReturnType<typeof result>, storage = cloudStorage(true), onClear = vi.fn()) =>
      render(<Parent initial={uploadResult} storage={storage} onClear={onClear} />);
    const mixed = () => result(['New Plan'], [['p1', 'Local Plan', 'Cloud Plan'], ['p2', 'Same', 'Same']]);

    it('says every project was uploaded and its copy removed, with no prompt', () => {
      renderFlow(result(['A', 'B'], []));
      expect(screen.getByText('2 projects uploaded to the cloud. Their copies in this browser were removed.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Download these copies' })).not.toBeInTheDocument();
    });

    it('uses the singular for one project', () => {
      renderFlow(result(['A'], []));
      expect(screen.getByText('1 project uploaded to the cloud. Its copy in this browser was removed.')).toBeInTheDocument();
    });

    it('shows no status line when nothing was uploaded or skipped', () => {
      renderFlow(result([], []));
      expect(screen.queryByText(/uploaded to the cloud/)).not.toBeInTheDocument();
    });

    it('names each skipped project, with its cloud name when that differs, and does not take focus', () => {
      renderFlow(mixed());
      expect(screen.getByText('1 project uploaded to the cloud. Its copy in this browser was removed.')).toBeInTheDocument();
      expect(screen.getByText(SKIPPED_INTRO)).toBeInTheDocument();
      expect(screen.getByText('Local Plan (named Cloud Plan in the cloud)')).toBeInTheDocument();
      expect(screen.getByText('Same')).toBeInTheDocument();
      expect(document.activeElement).toBe(document.body);
    });

    it('says the cloud versions are on screen only once the cloud load has succeeded', () => {
      const first = renderFlow(mixed(), cloudStorage(false));
      expect(screen.queryByText('You are now seeing the cloud versions.')).not.toBeInTheDocument();
      first.unmount();
      renderFlow(mixed(), cloudStorage(true));
      expect(screen.getByText('You are now seeing the cloud versions.')).toBeInTheDocument();
    });

    it("downloads this browser's copies, and only then offers to remove them", async () => {
      localCopies.data = { projects: [{ id: 'p1', name: 'Local Plan' }, { id: 'p2', name: 'Same' }], releases: [] };
      const onClear = vi.fn();
      renderFlow(mixed(), cloudStorage(true), onClear);
      expect(screen.queryByRole('button', { name: 'I have saved the file — remove these copies' })).not.toBeInTheDocument();

      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Download these copies' })); });
      const [ids, data, , options] = localCopies.exportSelectedProjects.mock.calls[0];
      expect([ids, data, options]).toEqual([['p1', 'p2'], localCopies.data, { includeSnapshots: true }]);
      expect(localCopies.removeLocalProjectCopies).not.toHaveBeenCalled();

      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'I have saved the file — remove these copies' })); });
      expect(localCopies.removeLocalProjectCopies).toHaveBeenCalledWith(['p1', 'p2']);
      expect(screen.getByText("This browser's copies were removed.")).toBeInTheDocument();
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('warns before the choice, and keeping removes nothing', async () => {
      const onClear = vi.fn();
      renderFlow(mixed(), cloudStorage(true), onClear);
      expect(screen.getByText(KEEP_WARNING)).toBeInTheDocument();

      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Keep these copies' })); });
      expect(screen.getByText("Kept this browser's copies. GanttApp will ask about them again next time.")).toBeInTheDocument();
      expect(localCopies.removeLocalProjectCopies).not.toHaveBeenCalled();
      expect(onClear).toHaveBeenCalledTimes(1);
    });
  });
});
