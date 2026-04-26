// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createRef } from 'react';
import { UploadConfirmFlow, type UploadConfirmFlowHandle } from '../UploadConfirmFlow';
import { LIGHT_THEME } from '../../utils/theme';
import type { GanttStorageService } from '../../types/storage';

vi.mock('../../storage/local-gantt-storage-service', () => ({
  clearLocalProjectData: vi.fn(),
}));

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

  describe('cleanup confirm after upload result', () => {
    it('shows cleanup prompt and status message when uploadResult has uploaded > 0', () => {
      const onClearUploadResult = vi.fn();
      render(
        <UploadConfirmFlow
          colors={LIGHT_THEME}
          isSwitching={false}
          localProjectCount={0}
          uploadResult={{ uploaded: 3, skipped: 0 }}
          storage={stubStorage}
          onModeChange={vi.fn()}
          onClearUploadResult={onClearUploadResult}
        />
      );
      expect(screen.getByText(/Clear local copies/)).toBeInTheDocument();
      expect(screen.getByText(/3 project\(s\) uploaded to the cloud/)).toBeInTheDocument();
      // v17.0: prop is cleared on user click, not automatically.
      expect(onClearUploadResult).not.toHaveBeenCalled();
    });

    it('clicking "Keep Local Copies" calls onClearUploadResult', () => {
      const onClearUploadResult = vi.fn();
      render(
        <UploadConfirmFlow
          colors={LIGHT_THEME}
          isSwitching={false}
          localProjectCount={0}
          uploadResult={{ uploaded: 3, skipped: 0 }}
          storage={stubStorage}
          onModeChange={vi.fn()}
          onClearUploadResult={onClearUploadResult}
        />
      );
      fireEvent.click(screen.getByText('Keep Local Copies'));
      expect(onClearUploadResult).toHaveBeenCalledTimes(1);
    });

    it('shows cleanup prompt when uploadResult has skipped > 0 (already-existed case)', () => {
      const { rerender } = render(
        <UploadConfirmFlow
          colors={LIGHT_THEME}
          isSwitching={false}
          localProjectCount={0}
          uploadResult={null}
          storage={stubStorage}
          onModeChange={vi.fn()}
          onClearUploadResult={vi.fn()}
        />
      );
      rerender(
        <UploadConfirmFlow
          colors={LIGHT_THEME}
          isSwitching={false}
          localProjectCount={0}
          uploadResult={{ uploaded: 0, skipped: 2 }}
          storage={stubStorage}
          onModeChange={vi.fn()}
          onClearUploadResult={vi.fn()}
        />
      );
      expect(screen.getByText(/Clear local copies/)).toBeInTheDocument();
    });
  });
});
