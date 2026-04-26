// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// CloudStorageModal — single, standardized modal for the SPERT(R) Suite that
// handles all three valid auth x storage states. Triggered by StorageStatusChip
// (auth chip) in v17.0. Replaces the prior chip popover and the Settings-tab
// detour for sign-in.
//
// State 1: signed out + local — Local radio active, Cloud disabled, sign-in row.
// State 2: signed in + local  — both radios active, identity card, "Keep using local storage".
// State 3: signed in + cloud  — both radios active, identity card, no Keep button.
// (Signed out + cloud is structurally impossible — performSignOutWithCleanup
//  always resets storage to 'local'.)

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { useAppData } from '../../context/AppDataContext';
import { useTheme } from '../../context/ThemeContext';
import { isFirebaseAvailable } from '../../lib/firebase';
import { sanitizeFirebaseError } from '../utils/validation';
import { normalizeDisplayName } from '../utils/displayName';
import { useSignInWithTosGate } from '../hooks/useSignInWithTosGate';
import { TosConsentModal } from '../../features/settings/TosConsentModal';
import { ExportAttributionSection } from '../../features/settings/ExportAttributionSection';
import { LocalStorageWarningToggle } from './LocalStorageWarningToggle';
import { UploadConfirmFlow, type UploadConfirmFlowHandle } from './UploadConfirmFlow';
import { ConfirmDialog } from './ConfirmDialog';

interface CloudStorageModalProps {
  open: boolean;
  onClose: () => void;
}

function GoogleLogo() {
  // 4-color G mark (Google brand guidelines).
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function MicrosoftLogo() {
  // Four-square Microsoft logo.
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M2 2 L14 14 M14 2 L2 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function normalizeSignInError(error: unknown): string | null | undefined {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/popup-closed-by-user') return null;
    if (code === 'auth/cancelled-popup-request') return null;
    if (code === 'auth/popup-blocked') return 'Allow pop-ups in your browser to sign in.';
  }
  return undefined; // fall through to sanitizeFirebaseError
}

export function CloudStorageModal({ open, onClose }: CloudStorageModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    storage, mode, switchMode, isSwitching,
    uploadResult, clearUploadResult,
    performSignOutWithCleanup,
    needsCloudToLocalPrompt, confirmKeepLocalCopy, confirmDiscardCloudData,
  } = useStorage();
  const { data, exportAttribution, setExportAttribution } = useAppData();

  const gate = useSignInWithTosGate({ normalizeError: normalizeSignInError });

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const uploadFlowRef = useRef<UploadConfirmFlowHandle>(null);

  const isSignedIn = !!user;
  const storageMode = mode;
  const cloudRadioDisabled = !isSignedIn || isSwitching || !isFirebaseAvailable;
  const dismissalSuppressed = signingOut || gate.tosModalOpen;

  // Escape key dismissal — added when modal opens, removed on close/unmount.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dismissalSuppressed) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissalSuppressed, onClose]);

  if (!open) return null;

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (dismissalSuppressed) return;
    onClose();
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await performSignOutWithCleanup();
      onClose();
    } catch (err) {
      setSignOutError(sanitizeFirebaseError(err));
    } finally {
      setSigningOut(false);
    }
  };

  const handleLocalRadioClick = async () => {
    if (storageMode === 'local') return;
    // v16.6 (UX-2): pass in-memory project count so StorageContext can decide
    // whether to fire the keep/discard prompt.
    await switchMode('local', data.projects.length);
  };

  const handleCloudRadioClick = () => {
    if (storageMode === 'cloud') return;
    if (cloudRadioDisabled) return;
    uploadFlowRef.current?.requestCloudSwitch();
  };

  // ---- Styles ----

  const cardStyle: React.CSSProperties = {
    background: colors.surface,
    borderRadius: '12px',
    padding: '1.5rem 1.5rem 1.25rem',
    maxWidth: '460px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    position: 'relative',
    maxHeight: '90vh',
    overflowY: 'auto',
  };

  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    background: 'transparent',
    border: 'none',
    color: colors.textSecondary,
    cursor: signingOut ? 'not-allowed' : 'pointer',
    padding: '0.25rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    pointerEvents: signingOut ? 'none' : 'auto',
    opacity: signingOut ? 0.5 : 1,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: colors.text,
    margin: '0 2rem 1rem 0',
  };

  const sectionHeading: React.CSSProperties = {
    fontSize: '1.05rem',
    color: '#0070f3',
    margin: '0 0 0.5rem 0',
  };

  const radioLabel: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
    color: colors.text,
    cursor: 'pointer',
  };

  const signInButtonStyle: React.CSSProperties = {
    flex: '1 1 0',
    minWidth: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '0.5rem',
    padding: '0.55rem 0.85rem',
    background: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
  };

  // ---- Render ----

  const titleId = 'cloud-storage-modal-title';

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={cardStyle}>
        <button
          type="button"
          onClick={() => { if (!signingOut) onClose(); }}
          aria-label="Close"
          style={closeBtnStyle}
        >
          <CloseIcon />
        </button>

        <h2 id={titleId} style={titleStyle}>Cloud Storage</h2>

        {/* === Storage section === */}
        <section style={{ marginBottom: '1.25rem' }}>
          <h3 style={sectionHeading}>Storage</h3>

          <label style={{ ...radioLabel, opacity: isSwitching ? 0.6 : 1 }}>
            <input
              type="radio"
              name="cloud-modal-storage-mode"
              value="local"
              checked={storageMode === 'local'}
              onChange={handleLocalRadioClick}
              disabled={isSwitching}
            />
            <strong>Local</strong>
            <span style={{ color: colors.textSecondary }}>(browser only)</span>
          </label>

          <label
            style={{
              ...radioLabel,
              opacity: cloudRadioDisabled ? 0.5 : 1,
              cursor: cloudRadioDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              type="radio"
              name="cloud-modal-storage-mode"
              value="cloud"
              checked={storageMode === 'cloud'}
              onChange={handleCloudRadioClick}
              disabled={cloudRadioDisabled}
            />
            <strong>Cloud</strong>
            <span style={{ color: colors.textSecondary }}>(sync across devices)</span>
          </label>

          {/* === State 1: signed out (storageMode is always 'local' here) === */}
          {!isSignedIn && (
            <>
              <p style={{
                color: colors.textSecondary,
                fontSize: '0.9rem',
                margin: '0.5rem 0 0.75rem 0',
              }}>
                Sign in to enable cloud storage and sharing.
              </p>

              {!isFirebaseAvailable && (
                <p style={{ color: '#999', fontSize: '0.85rem', margin: '0 0 0.75rem 0' }}>
                  Firebase is not configured. Cloud storage is unavailable.
                </p>
              )}

              {isFirebaseAvailable && (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => gate.signIn('google')}
                      style={signInButtonStyle}
                    >
                      <GoogleLogo />
                      Sign in with Google
                    </button>
                    <button
                      type="button"
                      onClick={() => gate.signIn('microsoft')}
                      style={signInButtonStyle}
                    >
                      <MicrosoftLogo />
                      Sign in with Microsoft
                    </button>
                  </div>

                  {gate.authError && (
                    <p style={{
                      color: '#e53e3e',
                      fontSize: '0.85rem',
                      margin: '0.5rem 0 0 0',
                    }}>
                      {gate.authError}
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {/* === State 2 + State 3: signed in (identity card) === */}
          {isSignedIn && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              background: colors.inputBg ?? colors.surface,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}>
              <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                <p style={{
                  margin: 0,
                  color: colors.text,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {normalizeDisplayName(user?.displayName) || user?.email?.split('@')[0] || 'Signed in'}
                </p>
                {user?.email && (
                  <p style={{
                    margin: '0.15rem 0 0 0',
                    color: colors.textSecondary,
                    fontSize: '0.85rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {user.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#e53e3e',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: signingOut ? 'not-allowed' : 'pointer',
                  padding: '0.25rem 0.5rem',
                }}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}

          {signOutError && (
            <p style={{ color: '#e53e3e', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>
              {signOutError}
            </p>
          )}

          {/* "Keep using local storage" — State 2 only */}
          {isSignedIn && storageMode === 'local' && (
            <button
              type="button"
              onClick={() => { if (!signingOut) onClose(); }}
              disabled={signingOut}
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: '6px',
                fontWeight: 500,
                fontSize: '0.9rem',
                cursor: signingOut ? 'not-allowed' : 'pointer',
              }}
            >
              Keep using local storage
            </button>
          )}

          {/* Upload-confirm + cleanup-confirm flow (invisible until triggered) */}
          <UploadConfirmFlow
            ref={uploadFlowRef}
            colors={colors}
            isSwitching={isSwitching}
            localProjectCount={data.projects.length}
            uploadResult={uploadResult}
            storage={storage}
            onModeChange={(m) => switchMode(m, data.projects.length)}
            onClearUploadResult={clearUploadResult}
          />

          {/* Cloud→local keep/discard prompt (driven by StorageContext global state) */}
          {needsCloudToLocalPrompt && (
            <ConfirmDialog
              message={<>Keep a local copy of your <strong>{needsCloudToLocalPrompt.projectCount}</strong> cloud project(s)?</>}
              colors={colors}
              buttons={[
                {
                  label: 'Keep Local Copy',
                  onClick: () => confirmKeepLocalCopy(data),
                  variant: 'primary',
                  disabled: isSwitching,
                },
                {
                  label: 'Discard',
                  onClick: confirmDiscardCloudData,
                  variant: 'danger',
                  disabled: isSwitching,
                },
              ]}
            />
          )}

          {isSwitching && (
            <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Switching storage mode…
            </p>
          )}
        </section>

        {/* === Export Attribution (always visible) === */}
        <ExportAttributionSection
          colors={colors}
          exportAttribution={exportAttribution}
          onChangeAttribution={setExportAttribution}
        />

        {/* === Notifications (always visible) === */}
        <LocalStorageWarningToggle colors={colors} alwaysVisible />
      </div>

      {gate.tosModalOpen && (
        <TosConsentModal
          colors={colors}
          onAccept={gate.onTosAccept}
          onCancel={gate.onTosCancel}
        />
      )}
    </div>
  );
}
