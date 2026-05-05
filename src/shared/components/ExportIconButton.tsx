// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ExportIconButton — borderless icon button for the per-tile Export action.
// Default color is grayscale; turns green on hover. v19.0 (matches TrashIconButton pattern).

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface ExportIconButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

const HOVER_GREEN = '#10b981';
const HOVER_BG_LIGHT = '#ecfdf5';
const HOVER_BG_DARK = 'rgba(16, 185, 129, 0.15)';
const DEFAULT_GRAY = '#9ca3af';

export function ExportIconButton({
  onClick,
  ariaLabel = 'Export',
  title = 'Export',
  disabled = false
}: ExportIconButtonProps) {
  const { resolvedTheme } = useTheme();
  const [hover, setHover] = useState(false);

  const isHoverActive = hover && !disabled;
  const iconColor = isHoverActive ? HOVER_GREEN : DEFAULT_GRAY;
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
