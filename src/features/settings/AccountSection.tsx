// Account section — sign-in/out buttons and user info

import type { User } from 'firebase/auth';
import type { ThemeColors } from '../../shared/utils/theme';

interface AccountSectionProps {
  colors: ThemeColors;
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  isFirebaseAvailable: boolean;
  authError: string | null;
  onSignIn: (provider: 'google' | 'microsoft') => void;
  onSignOut: () => void;
}

export function AccountSection({
  colors, user, isAuthenticated, authLoading, isFirebaseAvailable,
  authError, onSignIn, onSignOut,
}: AccountSectionProps) {
  const btnBase = {
    padding: '0.5rem 1.25rem',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontWeight: '600' as const,
  };

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Account</h3>

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
            onClick={onSignOut}
            style={{ ...btnBase, background: '#e53e3e', cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onSignIn('google')}
            disabled={!isFirebaseAvailable}
            style={{
              ...btnBase,
              background: isFirebaseAvailable ? '#4285f4' : '#ccc',
              cursor: isFirebaseAvailable ? 'pointer' : 'not-allowed',
            }}
          >
            Sign in with Google
          </button>
          <button
            onClick={() => onSignIn('microsoft')}
            disabled={!isFirebaseAvailable}
            style={{
              ...btnBase,
              background: isFirebaseAvailable ? '#00a4ef' : '#ccc',
              cursor: isFirebaseAvailable ? 'pointer' : 'not-allowed',
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
  );
}
