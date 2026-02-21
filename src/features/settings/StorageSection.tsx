// Storage section — Local/Cloud radio buttons with integrated auth UI
// Cloud radio is disabled until the user signs in (SPERT Story Map pattern).

import type { User } from 'firebase/auth';
import type { StorageMode } from '../../shared/types/storage';
import type { ThemeColors } from '../../shared/utils/theme';

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
}

export function StorageSection({
  colors, mode, isSwitching, switchError, isFirebaseAvailable, onModeChange,
  user, isAuthenticated, authLoading, authError, onSignIn, onSignOut,
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
