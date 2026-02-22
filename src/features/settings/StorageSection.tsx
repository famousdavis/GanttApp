// Storage section — Local/Cloud radio buttons with integrated auth UI
// Cloud radio is disabled until the user signs in (SPERT Story Map pattern).
// v12.0: Inline upload/cleanup confirmations, upload prompt for re-sign-in, Download All Projects button.
// v12.0.1: Replaced window.confirm() with inline UI (matches SPERT Story Map pattern).

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { StorageMode } from '../../shared/types/storage';
import type { ThemeColors } from '../../shared/utils/theme';
import type { UploadResult } from '../../context/StorageContext';
import type { GanttStorageService } from '../../shared/types/storage';
import { clearLocalProjectData } from '../../shared/storage/local-gantt-storage-service';
import { exportAllProjects } from '../../shared/utils/export';

interface StorageSectionProps {
  colors: ThemeColors;
  mode: StorageMode;
  isSwitching: boolean;
  switchError: string | null;
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
  onSkipUploadPrompt: () => Promise<void>;
  // v12.0: Download All Projects
  storage: GanttStorageService;
}

export function StorageSection({
  colors, mode, isSwitching, switchError, isFirebaseAvailable, onModeChange,
  user, isAuthenticated, authLoading, authError, onSignIn, onSignOut,
  uploadResult, onClearUploadResult,
  needsUploadPrompt, onConfirmUploadPrompt, onSkipUploadPrompt,
  storage,
}: StorageSectionProps) {
  // Inline confirmation state — replaces window.confirm() (v12.0.1)
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const labelStyle = { display: 'block', marginBottom: '0.75rem', color: colors.text, cursor: 'pointer' as const };
  const cloudDisabled = isSwitching || !isFirebaseAvailable || !user;

  const btnBase = {
    padding: '0.5rem 1.25rem',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontWeight: '600' as const,
  };

  // Count local projects for the upload confirmation message
  const getLocalProjectCount = (): number => {
    try {
      const raw = localStorage.getItem('ganttAppData');
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.projects) ? parsed.projects.length : 0;
    } catch {
      return 0;
    }
  };

  // Handle cloud radio selection — show inline confirm if local data exists
  const handleCloudSwitch = () => {
    const localCount = getLocalProjectCount();
    if (localCount > 0) {
      // Has local projects — show inline upload confirmation
      setShowUploadConfirm(true);
    } else {
      // No local projects — switch directly
      onModeChange('cloud');
    }
  };

  // User confirmed upload in the radio-click flow
  const confirmUpload = async () => {
    setShowUploadConfirm(false);
    await onModeChange('cloud');
  };

  // User chose to skip upload — switch to cloud without uploading
  const skipUpload = () => {
    setShowUploadConfirm(false);
    // Switch to cloud — switchToCloudMode handles the "no local data" case
    // by just connecting to cloud (local data stays in localStorage)
    onModeChange('cloud');
  };

  // Show cleanup confirmation when upload completes with results
  useEffect(() => {
    if (!uploadResult) return;
    const msg = `${uploadResult.uploaded} project(s) uploaded to the cloud` +
      (uploadResult.skipped > 0 ? ` (${uploadResult.skipped} already existed, skipped)` : '') +
      '.';
    setStatusMessage(msg);
    if (uploadResult.uploaded > 0 || uploadResult.skipped > 0) {
      setShowCleanupConfirm(true);
    }
    onClearUploadResult();
  }, [uploadResult, onClearUploadResult]);

  // User confirmed clearing local data
  const confirmCleanup = () => {
    clearLocalProjectData();
    setShowCleanupConfirm(false);
    setStatusMessage(prev => prev ? prev + ' Local data cleared.' : 'Local data cleared.');
  };

  // User dismissed cleanup dialog
  const dismissCleanup = () => {
    setShowCleanupConfirm(false);
  };

  const handleDownloadAll = async () => {
    setExporting(true);
    setStatusMessage(null);
    try {
      const result = await exportAllProjects(storage);
      setStatusMessage(`${result.exported} project(s) exported successfully.`);
    } catch (err) {
      setStatusMessage(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
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

      {/* Upload confirmation — shown when user clicks Cloud radio and has local data (v12.0.1) */}
      {showUploadConfirm && (
        <div style={{
          marginTop: '0.5rem',
          paddingLeft: '1.5rem',
        }}>
          <div style={{
            padding: '1rem',
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            background: colors.surface,
          }}>
            <p style={{ color: colors.text, margin: '0 0 0.75rem 0' }}>
              You have local projects. Upload them to the cloud?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={confirmUpload}
                disabled={isSwitching}
                style={{ ...btnBase, background: '#0070f3', cursor: isSwitching ? 'not-allowed' : 'pointer' }}
              >
                Upload to Cloud
              </button>
              <button
                onClick={skipUpload}
                disabled={isSwitching}
                style={{
                  ...btnBase,
                  background: 'transparent',
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  cursor: isSwitching ? 'not-allowed' : 'pointer',
                }}
              >
                Skip &mdash; Connect Without Uploading
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup confirmation — shown after successful upload (v12.0.1) */}
      {showCleanupConfirm && (
        <div style={{
          marginTop: '0.5rem',
          paddingLeft: '1.5rem',
        }}>
          <div style={{
            padding: '1rem',
            border: '1px solid #e53e3e',
            borderRadius: '6px',
            background: colors.surface,
          }}>
            <p style={{ color: colors.text, margin: '0 0 0.75rem 0' }}>
              Your projects are now in the cloud. Clear local copies to prevent duplicates on future sign-ins?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={confirmCleanup}
                style={{ ...btnBase, background: '#e53e3e', cursor: 'pointer' }}
              >
                Clear Local Data
              </button>
              <button
                onClick={dismissCleanup}
                style={{
                  ...btnBase,
                  background: 'transparent',
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                }}
              >
                Keep Local Copies
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-sign-in upload prompt (v12.0) */}
      {needsUploadPrompt && (
        <div style={{
          marginTop: '0.5rem',
          paddingLeft: '1.5rem',
        }}>
          <div style={{
            padding: '1rem',
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            background: colors.surface,
          }}>
            <p style={{ color: colors.text, margin: '0 0 0.75rem 0' }}>
              You have <strong>{needsUploadPrompt.projectCount}</strong> local project(s).
              Upload them to the cloud?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={onConfirmUploadPrompt}
                disabled={isSwitching}
                style={{ ...btnBase, background: '#0070f3', cursor: isSwitching ? 'not-allowed' : 'pointer' }}
              >
                Upload to Cloud
              </button>
              <button
                onClick={onSkipUploadPrompt}
                disabled={isSwitching}
                style={{
                  ...btnBase,
                  background: 'transparent',
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  cursor: isSwitching ? 'not-allowed' : 'pointer',
                }}
              >
                Skip &mdash; Connect Without Uploading
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status message — upload results, export results, etc. */}
      {statusMessage && !isSwitching && (
        <p style={{
          color: statusMessage.includes('failed') ? '#e53e3e' : '#38a169',
          fontSize: '0.85rem',
          marginTop: '0.5rem',
          paddingLeft: '1.5rem',
        }}>
          {statusMessage}
        </p>
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

      {/* Download All Projects button — cloud mode only (v12.0) */}
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
    </section>
  );
}
