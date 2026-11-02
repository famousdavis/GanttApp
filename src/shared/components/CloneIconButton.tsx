// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// CloneIconButton — borderless icon button for the per-tile Clone (duplicate) action.
// Default color is grayscale; turns violet on hover with a soft violet ring. v0.23.1 (matches TrashIconButton pattern).

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface CloneIconButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

const HOVER_VIOLET_LIGHT = '#7c3aed';
const HOVER_VIOLET_DARK = '#a78bfa';
const HOVER_BG_LIGHT = '#f5f3ff';
const HOVER_BG_DARK = 'rgba(139, 92, 246, 0.15)';
// Resting grey: at least 3:1 against every tile and dialog background in each theme.
const REST_GRAY_LIGHT = '#808080';
const REST_GRAY_DARK = '#9ca3af';

export function CloneIconButton({
  onClick,
  ariaLabel = 'Clone',
  title = 'Clone',
  disabled = false
}: CloneIconButtonProps) {
  const { resolvedTheme } = useTheme();
  const [hover, setHover] = useState(false);

  const isHoverActive = hover && !disabled;
  const isDark = resolvedTheme === 'dark';
  const iconColor = isHoverActive
    ? (isDark ? HOVER_VIOLET_DARK : HOVER_VIOLET_LIGHT)
    : (isDark ? REST_GRAY_DARK : REST_GRAY_LIGHT);
  const hoverBg = isDark ? HOVER_BG_DARK : HOVER_BG_LIGHT;

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
        width: '28px',
        height: '28px',
        padding: 0,
        flexShrink: 0,
        background: isHoverActive ? hoverBg : 'transparent',
        border: 'none',
        borderRadius: '6px',
        boxShadow: isHoverActive ? '0 0 0 1.5px rgba(139, 92, 246, 0.5)' : 'none',
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
        <rect
          x="9"
          y="9"
          width="13"
          height="13"
          rx="2"
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
