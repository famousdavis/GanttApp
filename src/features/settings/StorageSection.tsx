// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Storage section — Local/Cloud radio buttons with integrated auth UI
// Cloud radio is disabled until the user signs in (SPERT Story Map pattern).
// v12.0: Inline upload/cleanup confirmations, upload prompt for re-sign-in, Download All Projects button.
// v12.0.1: Replaced window.confirm() with inline UI (matches SPERT Story Map pattern).
// v12.1: Uses shared ConfirmDialog component.
// v12.3: Skip→Cancel — stays in local mode instead of connecting to cloud without uploading.
// v17.0: Upload-confirm + cleanup-confirm flow extracted to UploadConfirmFlow
// (shared with the new CloudStorageModal).

import { useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AppData } from '../../shared/types/app';
import type { StorageMode } from '../../shared/types/storage';
import type { ThemeColors } from '../../shared/utils/theme';
import type { UploadResult } from '../../context/StorageContext';
import type { GanttStorageService } from '../../shared/types/storage';
import { exportAllProjects } from '../../shared/utils/export';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { UploadConfirmFlow, type UploadConfirmFlowHandle } from '../../shared/components/UploadConfirmFlow';

interface StorageSectionProps {
  colors: ThemeColors;
  mode: StorageMode;
  isSwitching: boolean;
  switchError: string | null;
  // v17.3 — surfaced from background cloud auto-save + listener errors.
  saveError: string | null;
  isFirebaseAvailable: boolean;
  onModeChange: (mode: StorageMode) => void;
  // Auth props (merged from former AccountSection)
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;
  onSignIn: (provider: 'google' | 'microsoft') => void;
  onSignOut: () => void;
  // v12.0: upload result & cleanup
  uploadResult: UploadResult | null;
  onClearUploadResult: () => void;
  // v12.0: re-sign-in upload prompt
  needsUploadPrompt: { projectCount: number } | null;
  onConfirmUploadPrompt: () => Promise<void>;
  onCancelUploadPrompt: () => void;
  // v12.0: Download All Projects
  storage: GanttStorageService;
  // v16.6 (C3): in-memory project count — used for the upload-on-cloud-switch
  // prompt. Replaces the previous direct localStorage.getItem('ganttAppData')
  // parse so a stale on-disk copy from a previous user cannot trigger an
  // upload of their data to the current user's cloud account.
  localProjectCount: number;
  // v16.6 (UX-2): cloud→local keep-or-discard prompt.
  currentAppData: AppData;
  needsCloudToLocalPrompt: { projectCount: number } | null;
  onConfirmKeepLocalCopy: (currentAppData: AppData) => Promise<void>;
  onConfirmDiscardCloudData: () => Promise<void>;
}

export function StorageSection({
  colors, mode, isSwitching, switchError, saveError, isFirebaseAvailable, onModeChange,
  user, isAuthenticated, authLoading, authError, onSignIn, onSignOut,
  uploadResult, onClearUploadResult,
  needsUploadPrompt, onConfirmUploadPrompt, onCancelUploadPrompt,
  storage, localProjectCount,
  currentAppData, needsCloudToLocalPrompt,
  onConfirmKeepLocalCopy, onConfirmDiscardCloudData,
}: StorageSectionProps) {
  const uploadFlowRef = useRef<UploadConfirmFlowHandle>(null);
  const [exporting, setExporting] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  const labelStyle = { display: 'block', marginBottom: '0.75rem', color: colors.text, cursor: 'pointer' as const };
  const cloudDisabled = isSwitching || !isFirebaseAvailable || !user;

  const btnBase = {
    padding: '0.5rem 1.25rem',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontWeight: '600' as const,
  };

  // v17.0: Cloud-radio handler delegates to shared UploadConfirmFlow.
  const handleCloudSwitch = () => {
    uploadFlowRef.current?.requestCloudSwitch();
  };

  const handleDownloadAll = async () => {
    setExporting(true);
    setDownloadStatus(null);
    try {
      const result = await exportAllProjects(storage);
      setDownloadStatus(`${result.exported} project(s) exported successfully.`);
    } catch (err) {
      setDownloadStatus(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Storage</h3>
      <hr style={{ border: 'none', borderTop: `1px solid ${colors.border}`, marginBottom: '1rem' }} />

      <label style={labelStyle}>
        <input
          type="radio"
          name="storageMode"
          value="local"
          checked={mode === 'local'}
          onChange={() => onModeChange('local')}
          disabled={isSwitching}
          style={{ marginRight: '0.5rem' }}
        />
        <strong>Local (browser only)</strong>
        <span style={{ color: colors.textSecondary, marginLeft: '0.5rem' }}>
          &mdash; Data stored in your browser. Never leaves your device.
        </span>
      </label>

      <label style={{
        ...labelStyle,
        opacity: cloudDisabled ? 0.5 : 1,
        cursor: cloudDisabled ? 'not-allowed' : 'pointer',
      }}>
        <input
          type="radio"
          name="storageMode"
          value="cloud"
          checked={mode === 'cloud'}
          onChange={handleCloudSwitch}
          disabled={cloudDisabled}
          style={{ marginRight: '0.5rem' }}
        />
        <strong>Cloud (sync across devices)</strong>
        <span style={{ color: colors.textSecondary, marginLeft: '0.5rem' }}>
          &mdash; Data synced via Firebase. Access from any device.
        </span>
      </label>

      {/* v17.0: shared upload-confirm + cleanup-confirm flow */}
      <UploadConfirmFlow
        ref={uploadFlowRef}
        colors={colors}
        isSwitching={isSwitching}
        localProjectCount={localProjectCount}
        uploadResult={uploadResult}
        storage={storage}
        onModeChange={async (m) => { await onModeChange(m); }}
        onClearUploadResult={onClearUploadResult}
      />

      {/* Re-sign-in upload prompt */}
      {needsUploadPrompt && (
        <ConfirmDialog
          message={<>You have <strong>{needsUploadPrompt.projectCount}</strong> local project(s). Upload them to the cloud?</>}
          colors={colors}
          buttons={[
            { label: 'Upload to Cloud', onClick: onConfirmUploadPrompt, variant: 'primary', disabled: isSwitching },
            { label: 'Cancel', onClick: onCancelUploadPrompt, variant: 'secondary', disabled: isSwitching },
          ]}
        />
      )}

      {/* v16.6 (UX-2): cloud→local keep-or-discard prompt */}
      {needsCloudToLocalPrompt && (
        <ConfirmDialog
          message={<>Keep a local copy of your <strong>{needsCloudToLocalPrompt.projectCount}</strong> cloud project(s)?</>}
          colors={colors}
          buttons={[
            {
              label: 'Keep Local Copy',
              onClick: () => onConfirmKeepLocalCopy(currentAppData),
              variant: 'primary',
              disabled: isSwitching,
            },
            {
              label: 'Discard',
              onClick: onConfirmDiscardCloudData,
              variant: 'danger',
              disabled: isSwitching,
            },
          ]}
        />
      )}

      {/* Auth UI — sign-in buttons or signed-in user card */}
      {isFirebaseAvailable && !authLoading && !isAuthenticated && (
        <div style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
          <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Sign in to enable cloud storage and sharing.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => onSignIn('google')}
              style={{ ...btnBase, background: '#4285f4', cursor: 'pointer' }}
            >
              Sign in with Google
            </button>
            <button
              onClick={() => onSignIn('microsoft')}
              style={{ ...btnBase, background: '#00a4ef', cursor: 'pointer' }}
            >
              Sign in with Microsoft
            </button>
          </div>
            <p style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.5rem' }}>
              Microsoft sign-in requires a work or school account. For a personal
              account, use Google.
            </p>
        </div>
      )}

      {isFirebaseAvailable && isAuthenticated && user && (
        <div style={{
          marginTop: '0.5rem',
          paddingLeft: '1.5rem',
        }}>
          <div style={{
            padding: '1rem',
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            background: colors.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <p style={{ color: colors.text, margin: 0 }}>
              Signed in as: <strong>{user.displayName ?? 'Unknown'}</strong>
              {user.email && (
                <span style={{ color: colors.textSecondary }}> ({user.email})</span>
              )}
            </p>
            <button
              onClick={onSignOut}
              style={{ ...btnBase, background: '#e53e3e', cursor: 'pointer' }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Download All Projects button — cloud mode only */}
      {isAuthenticated && mode === 'cloud' && (
        <div style={{ marginTop: '0.75rem', paddingLeft: '1.5rem' }}>
          <button
            onClick={handleDownloadAll}
            disabled={exporting}
            style={{
              ...btnBase,
              background: 'transparent',
              color: '#0070f3',
              border: '1px solid #0070f3',
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.6 : 1,
            }}
          >
            {exporting ? 'Downloading...' : 'Download All Projects as JSON'}
          </button>
          <p style={{ color: colors.textSecondary, fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Export all your cloud projects to a single JSON file for backup.
          </p>
          {downloadStatus && (
            <p style={{
              color: downloadStatus.includes('failed') ? '#e53e3e' : '#38a169',
              fontSize: '0.85rem',
              marginTop: '0.25rem',
            }}>
              {downloadStatus}
            </p>
          )}
        </div>
      )}

      {authLoading && isFirebaseAvailable && (
        <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
          Loading authentication...
        </p>
      )}

      {!isFirebaseAvailable && (
        <p style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.25rem', paddingLeft: '1.5rem' }}>
          Firebase is not configured. Cloud storage is unavailable.
        </p>
      )}

      {isSwitching && (
        <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Switching storage mode...
        </p>
      )}

      {switchError && (
        <p style={{ color: '#e53e3e', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          {switchError}
        </p>
      )}

      {authError && (
        <p style={{ color: '#e53e3e', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          {authError}
        </p>
      )}

      {saveError && (
        <p style={{ color: '#e53e3e', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Cloud sync error: {saveError}
        </p>
      )}
    </section>
  );
}
