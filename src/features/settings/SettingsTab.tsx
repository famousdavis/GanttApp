// Settings Tab — orchestrates storage mode, account, and export attribution sections

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { useAppData } from '../../context/AppDataContext';
import { isFirebaseAvailable } from '../../lib/firebase';
import { StorageSection } from './StorageSection';
import { AccountSection } from './AccountSection';
import { ExportAttributionSection } from './ExportAttributionSection';

export function SettingsTab() {
  const { colors } = useTheme();
  const { user, isAuthenticated, signInWithGoogle, signInWithMicrosoft, signOut, loading: authLoading } = useAuth();
  const { mode, switchMode, isSwitching, switchError } = useStorage();
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
      setAuthError(error instanceof Error ? error.message : 'Sign-in failed');
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      if (mode === 'cloud') {
        await switchMode('local');
      }
      await signOut();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Sign-out failed');
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
      />

      <AccountSection
        colors={colors}
        user={user}
        isAuthenticated={isAuthenticated}
        authLoading={authLoading}
        isFirebaseAvailable={isFirebaseAvailable}
        authError={authError}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      <ExportAttributionSection
        colors={colors}
        exportAttribution={exportAttribution}
        onChangeAttribution={setExportAttribution}
      />
    </div>
  );
}
