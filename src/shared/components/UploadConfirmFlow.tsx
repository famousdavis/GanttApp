// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// UploadConfirmFlow — radio-click upload confirm + post-upload cleanup confirm.
// Extracted from StorageSection in v17.0 so the new CloudStorageModal can
// reuse identical upload/cleanup behavior without duplicating state.
//
// State derivation: the post-upload cleanup confirm visibility and the upload
// status message are derived directly from the parent-owned `uploadResult`
// prop — no setState-in-effect. When the user dismisses the cleanup confirm
// (either by clearing or by keeping), `onClearUploadResult()` is called and
// the parent clears the prop, which hides the confirm naturally.

import { forwardRef, useImperativeHandle, useState } from 'react';
import type { StorageMode, GanttStorageService } from '../types/storage';
import type { UploadResult } from '../../context/StorageContext';
import type { ThemeColors } from '../utils/theme';
import { clearLocalProjectData } from '../storage/local-gantt-storage-service';
import { ConfirmDialog } from './ConfirmDialog';

export interface UploadConfirmFlowProps {
  colors: ThemeColors;
  isSwitching: boolean;
  /** In-memory project count from AppDataContext. Used to decide whether to
   *  show the upload confirm before switching to cloud. v16.6 (C3) — never
   *  read directly from localStorage. */
  localProjectCount: number;
  uploadResult: UploadResult | null;
  storage: GanttStorageService;
  onModeChange: (mode: StorageMode) => Promise<UploadResult | void> | void;
  onClearUploadResult: () => void;
}

export interface UploadConfirmFlowHandle {
  /** Called by parent when the user clicks the Cloud radio. Shows the upload
   *  confirm if local data exists, otherwise switches directly. */
  requestCloudSwitch: () => void;
}

function buildUploadMessage(result: UploadResult): string {
  return `${result.uploaded} project(s) uploaded to the cloud` +
    (result.skipped > 0 ? ` (${result.skipped} already existed, skipped)` : '') +
    '.';
}

export const UploadConfirmFlow = forwardRef<UploadConfirmFlowHandle, UploadConfirmFlowProps>(
  function UploadConfirmFlow(
    { colors, isSwitching, localProjectCount, uploadResult, onModeChange, onClearUploadResult },
    ref
  ) {
    const [showUploadConfirm, setShowUploadConfirm] = useState(false);
    // Post-cleanup status message — set in event handler, not in an effect.
    const [postCleanupMessage, setPostCleanupMessage] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      requestCloudSwitch: () => {
        if (localProjectCount > 0) {
          setShowUploadConfirm(true);
        } else {
          void onModeChange('cloud');
        }
      },
    }), [localProjectCount, onModeChange]);

    const confirmUpload = async () => {
      setShowUploadConfirm(false);
      await onModeChange('cloud');
    };

    const cancelUpload = () => {
      setShowUploadConfirm(false);
    };

    // Derived: cleanup confirm is visible whenever uploadResult shows activity.
    const cleanupVisible = uploadResult !== null &&
      (uploadResult.uploaded > 0 || uploadResult.skipped > 0);

    // Derived: status message comes from the active uploadResult, or the
    // last post-cleanup message if no upload is active.
    const statusMessage = uploadResult
      ? buildUploadMessage(uploadResult)
      : postCleanupMessage;

    const confirmCleanup = () => {
      clearLocalProjectData();
      const base = uploadResult ? buildUploadMessage(uploadResult) : '';
      setPostCleanupMessage((base ? base + ' ' : '') + 'Local data cleared.');
      onClearUploadResult();
    };

    const keepLocal = () => {
      // Capture the upload status into local state so the user still sees the
      // confirmation message ("3 project(s) uploaded to the cloud.") after
      // dismissing the cleanup prompt — matches pre-extraction behavior.
      if (uploadResult) {
        setPostCleanupMessage(buildUploadMessage(uploadResult));
      }
      onClearUploadResult();
    };

    return (
      <>
        {showUploadConfirm && (
          <ConfirmDialog
            // User-initiated: shown because the user clicked the Cloud radio.
            blocking
            message="You have local projects. Upload them to the cloud?"
            colors={colors}
            buttons={[
              { label: 'Upload to Cloud', onClick: confirmUpload, variant: 'primary', disabled: isSwitching },
              { label: 'Cancel', onClick: cancelUpload, variant: 'secondary', disabled: isSwitching },
            ]}
          />
        )}

        {cleanupVisible && (
          <ConfirmDialog
            // ⚠️ DELIBERATELY NOT `blocking`, even though its primary action is
            // destructive. This prompt appears SPONTANEOUSLY when an async
            // upload completes, not because the user asked for it — stealing
            // focus from someone mid-task is the wrong answer for a surface
            // that arrives on its own. The right answer is to ANNOUNCE it, via
            // a live region, which is new scope and an open question with the
            // owner. Do not "fix" this by adding `blocking`.
            message="Your projects are now in the cloud. Clear local copies to prevent duplicates on future sign-ins?"
            colors={colors}
            borderColor="#e53e3e"
            buttons={[
              { label: 'Clear Local Data', onClick: confirmCleanup, variant: 'danger' },
              { label: 'Keep Local Copies', onClick: keepLocal, variant: 'secondary' },
            ]}
          />
        )}

        {statusMessage && !isSwitching && (
          <p style={{
            color: statusMessage.includes('failed') ? '#e53e3e' : '#38a169',
            fontSize: '0.85rem',
            marginTop: '0.5rem',
          }}>
            {statusMessage}
          </p>
        )}
      </>
    );
  }
);
