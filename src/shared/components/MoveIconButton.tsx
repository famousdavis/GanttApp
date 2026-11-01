// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// MoveIconButton — borderless icon button that moves a list item one place earlier
// or later: the way to reorder without dragging. Same shape as TrashIconButton;
// turns blue on hover or focus.

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface MoveIconButtonProps {
  direction: 'earlier' | 'later';
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

const HOVER_BLUE_LIGHT = '#0070f3';
const HOVER_BLUE_DARK = '#60a5fa';
const HOVER_BG_LIGHT = '#eff6ff';
const HOVER_BG_DARK = 'rgba(0, 112, 243, 0.15)';
// Resting grey: at least 3:1 against every tile and dialog background in each theme.
const REST_GRAY_LIGHT = '#808080';
const REST_GRAY_DARK = '#9ca3af';

const CHEVRON = { earlier: 'M15 18l-6-6 6-6', later: 'M9 18l6-6-6-6' } as const;

export function MoveIconButton({
  direction,
  onClick,
  ariaLabel,
  title,
  disabled = false
}: MoveIconButtonProps) {
  const { resolvedTheme } = useTheme();
  const [hover, setHover] = useState(false);
  const label = direction === 'earlier' ? 'Move earlier' : 'Move later';

  const isHoverActive = hover && !disabled;
  const isDark = resolvedTheme === 'dark';
  const iconColor = isHoverActive
    ? (isDark ? HOVER_BLUE_DARK : HOVER_BLUE_LIGHT)
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
      aria-label={ariaLabel ?? label}
      title={title ?? label}
      disabled={disabled}
      data-move={direction}
      style={{
        width: '28px',
        height: '28px',
        padding: 0,
        flexShrink: 0,
        background: isHoverActive ? hoverBg : 'transparent',
        border: 'none',
        borderRadius: '6px',
        boxShadow: isHoverActive ? '0 0 0 1.5px rgba(0, 112, 243, 0.5)' : 'none',
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
          d={CHEVRON[direction]}
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
