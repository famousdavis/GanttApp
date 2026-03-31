// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// TosConsentModal — clickwrap consent modal shown before Cloud Storage sign-in.
// Checkbox resets to unchecked each time the component mounts.
// Follows ConfirmDialog modal styling pattern.

import { useState } from 'react';
import type { ThemeColors } from '../../shared/utils/theme';

interface TosConsentModalProps {
  colors: ThemeColors;
  onAccept: () => void;
  onCancel: () => void;
}

export function TosConsentModal({ colors, onAccept, onCancel }: TosConsentModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div style={{
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
    }}>
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '520px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: colors.text,
          marginBottom: '1rem',
          marginTop: 0,
        }}>
          Terms of Service &amp; Privacy Policy
        </h3>

        <div style={{
          color: colors.textSecondary,
          lineHeight: '1.6',
          fontSize: '0.95rem',
          marginBottom: '1.25rem',
        }}>
          <p style={{ margin: '0 0 0.75rem 0' }}>
            Cloud Storage stores your project planning data in Firebase/Firestore on Google Cloud.
            Use is governed by the Terms of Service and Privacy Policy for SPERT&reg; Suite web apps.
          </p>
          <p style={{ margin: 0 }}>
            Please review:{' '}
            <a
              href="https://spertsuite.com/TOS.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0070f3', textDecoration: 'none' }}
            >
              Terms of Service
            </a>
            {' '}and{' '}
            <a
              href="https://spertsuite.com/PRIVACY.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0070f3', textDecoration: 'none' }}
            >
              Privacy Policy
            </a>
          </p>
        </div>

        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          cursor: 'pointer',
          color: colors.text,
          fontSize: '0.9rem',
          lineHeight: '1.4',
        }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: '0.2rem', flexShrink: 0 }}
          />
          I have read and agree to the Terms of Service and Privacy Policy.
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '0.6rem 1.25rem',
              background: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            disabled={!checked}
            style={{
              padding: '0.6rem 1.25rem',
              background: checked ? '#0070f3' : '#999',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: checked ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              fontSize: '0.9rem',
              opacity: checked ? 1 : 0.6,
            }}
          >
            Enable Cloud Storage
          </button>
        </div>
      </div>
    </div>
  );
}
