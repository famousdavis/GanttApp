// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ShareIconButton — borderless icon button for the Share action.
// Default color is grayscale; turns cyan with a soft cyan ring on hover. v0.23.0.

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface ShareIconButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

const HOVER_CYAN = '#06b6d4';
const HOVER_BG_LIGHT = '#ecfeff';
const HOVER_BG_DARK = 'rgba(6, 182, 212, 0.15)';
const DEFAULT_GRAY = '#9ca3af';

export function ShareIconButton({
  onClick,
  ariaLabel = 'Share',
  title = 'Share',
  disabled = false
}: ShareIconButtonProps) {
  const { resolvedTheme } = useTheme();
  const [hover, setHover] = useState(false);

  const isHoverActive = hover && !disabled;
  const iconColor = isHoverActive ? HOVER_CYAN : DEFAULT_GRAY;
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
        boxShadow: isHoverActive ? '0 0 0 1.5px rgba(6, 182, 212, 0.5)' : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        transition: 'background 0.12s ease, box-shadow 0.12s ease'
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="9"
          cy="7"
          r="4"
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="19"
          y1="8"
          x2="19"
          y2="14"
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="22"
          y1="11"
          x2="16"
          y2="11"
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
