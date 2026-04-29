// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// TrashIconButton — borderless icon button for destructive list actions.
// Default color is theme-aware grayscale; turns red on hover. v17.1.

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface TrashIconButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

const HOVER_RED = '#ef4444';
const HOVER_BG_LIGHT = '#fef2f2';
const HOVER_BG_DARK = 'rgba(239, 68, 68, 0.15)';

export function TrashIconButton({
  onClick,
  ariaLabel = 'Delete',
  title = 'Delete',
  disabled = false
}: TrashIconButtonProps) {
  const { colors, resolvedTheme } = useTheme();
  const [hover, setHover] = useState(false);

  const isHoverActive = hover && !disabled;
  const iconColor = isHoverActive ? HOVER_RED : colors.textSecondary;
  const hoverBg = resolvedTheme === 'dark' ? HOVER_BG_DARK : HOVER_BG_LIGHT;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => !disabled && setHover(true)}
      onBlur={() => setHover(false)}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      style={{
        padding: '0.35rem',
        background: isHoverActive ? hoverBg : 'transparent',
        border: 'none',
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        transition: 'background 0.12s ease'
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
