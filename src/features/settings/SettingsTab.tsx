// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Settings Tab — orchestrates storage mode and export attribution sections
// v13.0: Intercepts sign-in to show ToS consent modal before Firebase Auth.

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { useAppData } from '../../context/AppDataContext';
import { isFirebaseAvailable } from '../../lib/firebase';
import { TOS_VERSION } from '../../lib/version';
import { sanitizeFirebaseError, DEFAULT_WORK_DAYS } from '../../shared/utils/validation';
import { StorageSection } from './StorageSection';
import { ExportAttributionSection } from './ExportAttributionSection';
import { TosConsentModal } from './TosConsentModal';
import { WorkWeekSection } from './WorkWeekSection';
import { DefaultLegendLabelsSection } from './DefaultLegendLabelsSection';

const TOS_ACCEPTED_KEY = 'spert_tos_accepted_version';
const TOS_WRITE_PENDING_KEY = 'spert_tos_write_pending';

export function SettingsTab() {
  const { colors } = useTheme();
  const { user, isAuthenticated, signInWithGoogle, signInWithMicrosoft, loading: authLoading } = useAuth();
  const {
    storage, mode, switchMode, isSwitching, switchError,
    uploadResult, clearUploadResult,
    needsUploadPrompt, confirmUploadPrompt, cancelUploadPrompt,
    performSignOutWithCleanup,
    needsCloudToLocalPrompt, confirmKeepLocalCopy, confirmDiscardCloudData,
  } = useStorage();
  const {
    data,
    exportAttribution, setExportAttribution,
    globalWorkDays, setGlobalWorkDays,
    solidBarLabel, setSolidBarLabel,
    hatchedBarLabel, setHatchedBarLabel,
    finishDateLabel, setFinishDateLabel,
    mostLikelyLineLabel, setMostLikelyLineLabel,
    inProgressLabel, setInProgressLabel,
  } = useAppData();

  const [authError, setAuthError] = useState<string | null>(null);
  const [showTosModal, setShowTosModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<'google' | 'microsoft' | null>(null);

  const SUPPRESS_KEY = 'ganttapp-suppress-local-warning';
  const [warnOnLocal, setWarnOnLocal] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem(SUPPRESS_KEY) !== 'true';
  });

  const handleWarnOnLocalChange = (checked: boolean) => {
    setWarnOnLocal(checked);
    localStorage.setItem(SUPPRESS_KEY, checked ? 'false' : 'true');
  };

  // Execute Firebase Auth sign-in (extracted for reuse)
  const executeSignIn = async (provider: 'google' | 'microsoft') => {
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithMicrosoft();
      }
    } catch (error) {
      setAuthError(sanitizeFirebaseError(error));
    }
  };

  // Intercept sign-in: check ToS acceptance before Firebase Auth fires
  const handleSignIn = async (provider: 'google' | 'microsoft') => {
    setAuthError(null);
    const accepted = localStorage.getItem(TOS_ACCEPTED_KEY);
    if (accepted === TOS_VERSION) {
      // ToS already accepted at current version — proceed to Firebase Auth
      // Set write pending in case Firestore record is missing (e.g., previous cancelled popup)
      const writePending = localStorage.getItem(TOS_WRITE_PENDING_KEY);
      if (writePending === 'true') {
        // Already pending from a previous cancelled popup — proceed
      }
      await executeSignIn(provider);
    } else {
      // Show consent modal before Firebase Auth
      setPendingProvider(provider);
      setShowTosModal(true);
    }
  };

  // User accepted ToS in the consent modal
  const handleTosAccept = async () => {
    setShowTosModal(false);
    // Record consent in localStorage BEFORE Firebase Auth fires
    localStorage.setItem(TOS_ACCEPTED_KEY, TOS_VERSION);
    localStorage.setItem(TOS_WRITE_PENDING_KEY, 'true');
    // Now trigger Firebase Auth
    if (pendingProvider) {
      await executeSignIn(pendingProvider);
      setPendingProvider(null);
    }
  };

  // User cancelled the consent modal
  const handleTosCancel = () => {
    setShowTosModal(false);
    setPendingProvider(null);
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      // v16.6: centralized helper handles cancelPendingSaves, clearAllData,
      // dispose, mode reset, storage swap, and firebaseSignOut in the
      // correct order.
      await performSignOutWithCleanup();
    } catch (error) {
      setAuthError(sanitizeFirebaseError(error));
    }
  };

  const handleModeChange = async (newMode: 'local' | 'cloud') => {
    if (newMode === mode) return;
    // v16.6 (UX-2): pass in-memory project count so switchMode can decide
    // whether to fire the Keep/Discard prompt on cloud→local.
    await switchMode(newMode, data.projects.length);
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: colors.text }}>Settings</h2>

      {showTosModal && (
        <TosConsentModal
          colors={colors}
          onAccept={handleTosAccept}
          onCancel={handleTosCancel}
        />
      )}

      <StorageSection
        colors={colors}
        mode={mode}
        isSwitching={isSwitching}
        switchError={switchError}
        isFirebaseAvailable={isFirebaseAvailable}
        onModeChange={handleModeChange}
        user={user}
        isAuthenticated={isAuthenticated}
        authLoading={authLoading}
        authError={authError}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        uploadResult={uploadResult}
        onClearUploadResult={clearUploadResult}
        needsUploadPrompt={needsUploadPrompt}
        onConfirmUploadPrompt={confirmUploadPrompt}
        onCancelUploadPrompt={cancelUploadPrompt}
        storage={storage}
        localProjectCount={data.projects.length}
        currentAppData={data}
        needsCloudToLocalPrompt={needsCloudToLocalPrompt}
        onConfirmKeepLocalCopy={confirmKeepLocalCopy}
        onConfirmDiscardCloudData={confirmDiscardCloudData}
      />

      <ExportAttributionSection
        colors={colors}
        exportAttribution={exportAttribution}
        onChangeAttribution={setExportAttribution}
      />

      <WorkWeekSection
        colors={colors}
        globalWorkDays={globalWorkDays}
        onChange={setGlobalWorkDays}
        onReset={() => setGlobalWorkDays([...DEFAULT_WORK_DAYS])}
      />

      <DefaultLegendLabelsSection
        colors={colors}
        solidBarLabel={solidBarLabel}
        setSolidBarLabel={setSolidBarLabel}
        hatchedBarLabel={hatchedBarLabel}
        setHatchedBarLabel={setHatchedBarLabel}
        finishDateLabel={finishDateLabel}
        setFinishDateLabel={setFinishDateLabel}
        mostLikelyLineLabel={mostLikelyLineLabel}
        setMostLikelyLineLabel={setMostLikelyLineLabel}
        inProgressLabel={inProgressLabel}
        setInProgressLabel={setInProgressLabel}
      />

      {mode === 'local' && (
        <section style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>
            Notifications
          </h3>
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={warnOnLocal}
              onChange={(e) => handleWarnOnLocalChange(e.target.checked)}
              style={{ marginTop: '0.2rem' }}
            />
            <div>
              <span style={{ fontWeight: '600', color: colors.text }}>
                Warn me on startup when using local storage
              </span>
              <p style={{
                color: colors.textSecondary,
                fontSize: '0.85rem',
                lineHeight: '1.5',
                margin: '0.25rem 0 0 0',
              }}>
                Shows a caution banner each time the app loads while your data is stored
                locally in this browser. Takes effect on the next time the app loads.
              </p>
            </div>
          </label>
        </section>
      )}
    </div>
  );
}
