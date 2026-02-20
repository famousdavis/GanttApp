// Settings Tab — storage mode, account management, export attribution

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useStorage } from '../../context/StorageContext';
import { useAppData } from '../../context/AppDataContext';
import { isFirebaseAvailable } from '../../lib/firebase';

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

  const sectionStyle = { marginBottom: '2rem' };
  const headingStyle = { fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' };
  const labelStyle = { display: 'block', marginBottom: '0.75rem', color: colors.text, cursor: 'pointer' as const };
  const inputStyle = {
    padding: '0.5rem 0.75rem',
    border: `1px solid ${colors.border}`,
    borderRadius: '4px',
    background: colors.inputBg,
    color: colors.text,
    fontSize: '0.95rem',
    width: '100%',
    maxWidth: '400px',
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: colors.text }}>Settings</h2>

      {/* Storage Mode */}
      <section style={sectionStyle}>
        <h3 style={headingStyle}>Storage</h3>

        <label style={labelStyle}>
          <input
            type="radio"
            name="storageMode"
            value="local"
            checked={mode === 'local'}
            onChange={() => handleModeChange('local')}
            disabled={isSwitching}
            style={{ marginRight: '0.5rem' }}
          />
          <strong>Local</strong>
          <span style={{ color: colors.textSecondary, marginLeft: '0.5rem' }}>
            &mdash; Data stored in your browser. Never leaves your device.
          </span>
        </label>

        <label style={{
          ...labelStyle,
          opacity: isFirebaseAvailable ? 1 : 0.5,
          cursor: isFirebaseAvailable ? 'pointer' : 'not-allowed',
        }}>
          <input
            type="radio"
            name="storageMode"
            value="cloud"
            checked={mode === 'cloud'}
            onChange={() => handleModeChange('cloud')}
            disabled={isSwitching || !isFirebaseAvailable}
            style={{ marginRight: '0.5rem' }}
          />
          <strong>Cloud</strong>
          <span style={{ color: colors.textSecondary, marginLeft: '0.5rem' }}>
            &mdash; Data synced via Firebase. Access from any device.
          </span>
        </label>

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
      </section>

      {/* Account Section */}
      <section style={sectionStyle}>
        <h3 style={headingStyle}>Account</h3>

        {authLoading ? (
          <p style={{ color: colors.textSecondary }}>Loading authentication...</p>
        ) : isAuthenticated && user ? (
          <div style={{
            padding: '1rem',
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            background: colors.surface,
          }}>
            <p style={{ color: colors.text, marginBottom: '0.75rem' }}>
              Signed in as: <strong>{user.displayName ?? 'Unknown'}</strong>
              {user.email && (
                <span style={{ color: colors.textSecondary }}> ({user.email})</span>
              )}
            </p>
            <button
              onClick={handleSignOut}
              style={{
                padding: '0.5rem 1rem',
                background: '#e53e3e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleSignIn('google')}
              disabled={!isFirebaseAvailable}
              style={{
                padding: '0.5rem 1.25rem',
                background: isFirebaseAvailable ? '#4285f4' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isFirebaseAvailable ? 'pointer' : 'not-allowed',
                fontWeight: '600',
              }}
            >
              Sign in with Google
            </button>
            <button
              onClick={() => handleSignIn('microsoft')}
              disabled={!isFirebaseAvailable}
              style={{
                padding: '0.5rem 1.25rem',
                background: isFirebaseAvailable ? '#00a4ef' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isFirebaseAvailable ? 'pointer' : 'not-allowed',
                fontWeight: '600',
              }}
            >
              Sign in with Microsoft
            </button>
          </div>
        )}

        {authError && (
          <p style={{ color: '#e53e3e', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            {authError}
          </p>
        )}
      </section>

      {/* Export Attribution */}
      <section style={sectionStyle}>
        <h3 style={headingStyle}>Export Attribution</h3>
        <p style={{ color: colors.textSecondary, marginBottom: '1rem', lineHeight: '1.6' }}>
          These fields are included when you export data as JSON. They identify who prepared the export.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: '600', color: colors.text, marginBottom: '0.25rem' }}>
            Name
          </label>
          <input
            type="text"
            value={exportAttribution?.name ?? ''}
            onChange={(e) => setExportAttribution({
              name: e.target.value,
              identifier: exportAttribution?.identifier ?? '',
            })}
            placeholder="e.g., Mark Twain"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontWeight: '600', color: colors.text, marginBottom: '0.25rem' }}>
            Identifier
          </label>
          <input
            type="text"
            value={exportAttribution?.identifier ?? ''}
            onChange={(e) => setExportAttribution({
              name: exportAttribution?.name ?? '',
              identifier: e.target.value,
            })}
            placeholder="e.g, student ID, email, or team name"
            style={inputStyle}
          />
        </div>
      </section>
    </div>
  );
}
