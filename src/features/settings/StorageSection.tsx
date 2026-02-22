// Storage section — Local/Cloud radio buttons with integrated auth UI
// Cloud radio is disabled until the user signs in (SPERT Story Map pattern).
// v12.0: Post-upload cleanup dialog, upload prompt for re-sign-in, Download All Projects button.

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
  const labelStyle = { display: 'block', marginBottom: '0.75rem', color: colors.text, cursor: 'pointer' as const };
  const cloudDisabled = isSwitching || !isFirebaseAvailable || !user;

  const btnBase = {
    padding: '0.5rem 1.25rem',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontWeight: '600' as const,
  };

  // Handle cleanup dialog after successful upload
  const handleUploadComplete = () => {
    if (uploadResult && uploadResult.uploaded > 0) {
      const shouldClear = window.confirm(
        `${uploadResult.uploaded} project(s) uploaded to the cloud` +
        (uploadResult.skipped > 0 ? ` (${uploadResult.skipped} already existed, skipped)` : '') +
        '.\n\nClear local copies to prevent duplicates on future sign-ins?'
      );
      if (shouldClear) {
        clearLocalProjectData();
      }
    }
    onClearUploadResult();
  };

  // Show cleanup dialog when uploadResult changes
  if (uploadResult) {
    // Use setTimeout to defer the confirm dialog until after React render
    setTimeout(handleUploadComplete, 0);
  }

  const handleDownloadAll = async () => {
    try {
      const result = await exportAllProjects(storage);
      window.alert(`${result.exported} project(s) exported successfully.`);
    } catch (err) {
      window.alert(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
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
          onChange={() => onModeChange('cloud')}
          disabled={cloudDisabled}
          style={{ marginRight: '0.5rem' }}
        />
        <strong>Cloud (sync across devices)</strong>
        <span style={{ color: colors.textSecondary, marginLeft: '0.5rem' }}>
          &mdash; Data synced via Firebase. Access from any device.
        </span>
      </label>

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
            style={{
              ...btnBase,
              background: 'transparent',
              color: '#0070f3',
              border: '1px solid #0070f3',
              cursor: 'pointer',
            }}
          >
            Download All Projects as JSON
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
