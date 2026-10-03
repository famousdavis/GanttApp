// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// UploadConfirmFlow — radio-click upload confirm, then what the switch did.
// Extracted from StorageSection in v17.0 so the new CloudStorageModal can
// reuse identical upload behavior without duplicating state.
//
// After a switch, the uploaded projects' copies in this browser are already
// removed (StorageContext). Projects that were skipped, because they were
// already in the cloud, keep their copies here, which may differ from the
// cloud versions: the prompt offers to download them as a file and then
// remove them, or to keep them.
//
// State derivation: what is shown is derived from the parent-owned
// `uploadResult` prop — no setState-in-effect. The user's choice calls
// `onClearUploadResult()`, and the parent clears the prop.

import { forwardRef, useImperativeHandle, useState, type CSSProperties } from 'react';
import type { StorageMode, GanttStorageService } from '../types/storage';
import type { UploadResult } from '../../context/StorageContext';
import type { ThemeColors } from '../utils/theme';
import { LocalGanttStorageService, removeLocalProjectCopies } from '../storage/local-gantt-storage-service';
import { exportSelectedProjects } from '../utils/export';
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

const SKIPPED_INTRO =
  'These projects were already in your cloud, so they were not uploaded. This browser still has its own copy of each, which may differ from the cloud version:';
const SEEING_CLOUD = 'You are now seeing the cloud versions.';
const DOWNLOAD_NOTE =
  "Saves this browser's copies, with their snapshots, as a file. You can import it later (Projects \u2192 Import), and GanttApp will ask whether to skip, copy or replace each project.";
const KEEP_WARNING =
  'If you keep them: the next time you open GanttApp in this browser, it opens in local mode and shows these copies, not your cloud data, and changes are saved only in this browser. To return to your cloud data, open Settings and choose Upload to Cloud: that skips these projects again and replaces your cloud settings with this browser\'s. Cancel there keeps GanttApp in local mode. Signing out now removes the copies from this browser; signing out on a later visit leaves them here for anyone who uses it.';
const REMOVED = "This browser's copies were removed.";
const KEPT = "Kept this browser's copies. GanttApp will ask about them again next time.";

function uploadedSentence(count: number): string {
  return count === 1
    ? '1 project uploaded to the cloud. Its copy in this browser was removed.'
    : `${count} projects uploaded to the cloud. Their copies in this browser were removed.`;
}

function skippedLabel(p: { localName: string; cloudName: string }): string {
  return p.localName === p.cloudName ? p.localName : `${p.localName} (named ${p.cloudName} in the cloud)`;
}

/** Download the skipped projects' copies in THIS browser — never the cloud data on screen. */
async function downloadLocalCopies(projectIds: string[]): Promise<void> {
  const local = new LocalGanttStorageService();
  const localData = await local.loadAppData();
  if (!localData) return;
  await exportSelectedProjects(projectIds, localData, local, { includeSnapshots: true });
}

export const UploadConfirmFlow = forwardRef<UploadConfirmFlowHandle, UploadConfirmFlowProps>(
  function UploadConfirmFlow(
    { colors, isSwitching, localProjectCount, uploadResult, storage, onModeChange, onClearUploadResult },
    ref
  ) {
    const [showUploadConfirm, setShowUploadConfirm] = useState(false);
    // Post-choice status message — set in event handler, not in an effect.
    const [postCleanupMessage, setPostCleanupMessage] = useState<string | null>(null);
    // The switch result whose copies were downloaded; the remove button
    // belongs to that result only.
    const [downloadedFor, setDownloadedFor] = useState<UploadResult | null>(null);

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

    // Derived: the prompt shows while a switch result has skipped projects.
    const skipped = uploadResult ? uploadResult.skippedProjects : [];
    const promptVisible = skipped.length > 0;
    const downloaded = uploadResult !== null && downloadedFor === uploadResult;
    // "You are now seeing the cloud versions" is true only once the cloud load
    // has succeeded; until then the screen still shows this browser's data.
    const cloudLoaded = storage.mode === 'cloud' && storage.canWrite();

    // Derived: with nothing skipped, one status line says what was uploaded;
    // with nothing uploaded either, there is nothing to say.
    const statusMessage = uploadResult
      ? (!promptVisible && uploadResult.uploaded > 0 ? uploadedSentence(uploadResult.uploaded) : null)
      : postCleanupMessage;

    const downloadCopies = async () => {
      try {
        await downloadLocalCopies(skipped.map(p => p.id));
        setDownloadedFor(uploadResult);
      } catch (error) {
        console.error('Could not download local copies:', error instanceof Error ? error.message : 'Unknown error');
      }
    };

    const removeCopies = async () => {
      await removeLocalProjectCopies(skipped.map(p => p.id));
      setPostCleanupMessage(REMOVED);
      onClearUploadResult();
    };

    const keepCopies = () => {
      setPostCleanupMessage(KEPT);
      onClearUploadResult();
    };

    const noteStyle: CSSProperties = { color: colors.textSecondary, fontSize: '0.85rem', margin: '0.25rem 0 0.75rem' };
    const buttonStyle = (primary: boolean): CSSProperties => ({
      padding: '0.5rem 1.25rem',
      borderRadius: '4px',
      fontWeight: 600,
      cursor: 'pointer',
      background: 'transparent',
      color: primary ? '#0070f3' : colors.text,
      border: `1px solid ${primary ? '#0070f3' : colors.border}`,
    });

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

        {promptVisible && uploadResult && (
          // ⚠️ DELIBERATELY TAKES NO FOCUS, even though one of its actions is
          // destructive. This prompt appears SPONTANEOUSLY when an async
          // upload completes, not because the user asked for it — stealing
          // focus from someone mid-task is the wrong answer for a surface
          // that arrives on its own. The right answer is to ANNOUNCE it, via
          // a live region, which is new scope and an open question with the
          // owner. Do not "fix" this by moving focus here.
          <div style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
            <div style={{ padding: '1rem', border: `1px solid ${colors.border}`, borderRadius: '6px', background: colors.surface, color: colors.text }}>
              {uploadResult.uploaded > 0 && <p style={{ margin: '0 0 0.5rem' }}>{uploadedSentence(uploadResult.uploaded)}</p>}
              <p style={{ margin: '0 0 0.5rem' }}>{SKIPPED_INTRO}</p>
              <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.25rem' }}>
                {skipped.map(p => <li key={p.id}>{skippedLabel(p)}</li>)}
              </ul>
              {cloudLoaded && <p style={{ margin: '0 0 0.75rem' }}>{SEEING_CLOUD}</p>}
              <button type="button" onClick={() => { void downloadCopies(); }} style={buttonStyle(true)}>
                Download these copies
              </button>
              <p style={noteStyle}>{DOWNLOAD_NOTE}</p>
              {downloaded && (
                <button type="button" onClick={() => { void removeCopies(); }} style={{ ...buttonStyle(false), marginBottom: '0.75rem' }}>
                  I have saved the file &mdash; remove these copies
                </button>
              )}
              <div>
                <button type="button" onClick={keepCopies} style={buttonStyle(false)}>
                  Keep these copies
                </button>
                <p style={noteStyle}>{KEEP_WARNING}</p>
              </div>
            </div>
          </div>
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
