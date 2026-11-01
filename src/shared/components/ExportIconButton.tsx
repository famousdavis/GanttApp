// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ExportIconButton — borderless icon button for the per-tile Export action.
// Default color is grayscale; turns green on hover with a soft green ring. v0.23.1 (matches TrashIconButton pattern).

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface ExportIconButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

const HOVER_GREEN_LIGHT = '#047857';
const HOVER_GREEN_DARK = '#34d399';
const HOVER_BG_LIGHT = '#ecfdf5';
const HOVER_BG_DARK = 'rgba(16, 185, 129, 0.15)';
// Resting grey: at least 3:1 against every tile and dialog background in each theme.
const REST_GRAY_LIGHT = '#808080';
const REST_GRAY_DARK = '#9ca3af';

export function ExportIconButton({
  onClick,
  ariaLabel = 'Export',
  title = 'Export',
  disabled = false
}: ExportIconButtonProps) {
  const { resolvedTheme } = useTheme();
  const [hover, setHover] = useState(false);

  const isHoverActive = hover && !disabled;
  const isDark = resolvedTheme === 'dark';
  const iconColor = isHoverActive
    ? (isDark ? HOVER_GREEN_DARK : HOVER_GREEN_LIGHT)
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
        boxShadow: isHoverActive ? '0 0 0 1.5px rgba(16, 185, 129, 0.5)' : 'none',
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
          d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
