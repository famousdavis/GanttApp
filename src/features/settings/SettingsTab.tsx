// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Settings Tab — orchestrates storage mode and export attribution sections
// v13.0: Intercepts sign-in to show ToS consent modal before Firebase Auth.
// v17.0: ToS gate extracted to useSignInWithTosGate hook (shared with the new
// CloudStorageModal). Notifications toggle extracted to LocalStorageWarningToggle.

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { useAppData } from '../../context/AppDataContext';
import { isFirebaseAvailable } from '../../lib/firebase';
import { sanitizeFirebaseError, DEFAULT_WORK_DAYS } from '../../shared/utils/validation';
import { useSignInWithTosGate } from '../../shared/hooks/useSignInWithTosGate';
import { LocalStorageWarningToggle } from '../../shared/components/LocalStorageWarningToggle';
import { StorageSection } from './StorageSection';
import { ExportAttributionSection } from './ExportAttributionSection';
import { TosConsentModal } from './TosConsentModal';
import { WorkWeekSection } from './WorkWeekSection';
import { DefaultLegendLabelsSection } from './DefaultLegendLabelsSection';

export function SettingsTab() {
  const { colors } = useTheme();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
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

  const gate = useSignInWithTosGate();

  const handleSignOut = async () => {
    gate.setAuthError(null);
    try {
      // v16.6: centralized helper handles cancelPendingSaves, clearAllData,
      // dispose, mode reset, storage swap, and firebaseSignOut in the
      // correct order.
      await performSignOutWithCleanup();
    } catch (error) {
      gate.setAuthError(sanitizeFirebaseError(error));
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

      {gate.tosModalOpen && (
        <TosConsentModal
          colors={colors}
          onAccept={gate.onTosAccept}
          onCancel={gate.onTosCancel}
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
        authError={gate.authError}
        onSignIn={gate.signIn}
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

      <LocalStorageWarningToggle colors={colors} />
    </div>
  );
}
