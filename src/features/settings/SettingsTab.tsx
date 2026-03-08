// Settings Tab — orchestrates storage mode and export attribution sections

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { useAppData } from '../../context/AppDataContext';
import { isFirebaseAvailable } from '../../lib/firebase';
import { sanitizeFirebaseError } from '../../shared/utils/validation';
import { StorageSection } from './StorageSection';
import { ExportAttributionSection } from './ExportAttributionSection';

export function SettingsTab() {
  const { colors } = useTheme();
  const { user, isAuthenticated, signInWithGoogle, signInWithMicrosoft, signOut, loading: authLoading } = useAuth();
  const {
    storage, mode, switchMode, isSwitching, switchError,
    uploadResult, clearUploadResult,
    needsUploadPrompt, confirmUploadPrompt, cancelUploadPrompt,
  } = useStorage();
  const { exportAttribution, setExportAttribution } = useAppData();

  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async (provider: 'google' | 'microsoft') => {
    setAuthError(null);
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

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      // v12.0: switchMode('local') no longer downloads data — just flushes and disposes
      if (mode === 'cloud') {
        await switchMode('local');
      }
      await signOut();
    } catch (error) {
      setAuthError(sanitizeFirebaseError(error));
    }
  };

  const handleModeChange = async (newMode: 'local' | 'cloud') => {
    if (newMode === mode) return;
    await switchMode(newMode);
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: colors.text }}>Settings</h2>

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
      />

      <ExportAttributionSection
        colors={colors}
        exportAttribution={exportAttribution}
        onChangeAttribution={setExportAttribution}
      />
    </div>
  );
}
