// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ArchiveIconButton — borderless icon button that archives a project or brings
// it back. Same shape as the other tile icons; turns slate on hover or focus.

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface ArchiveIconButtonProps {
  variant: 'archive' | 'unarchive';
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
}

const HOVER_SLATE_LIGHT = '#475569';
const HOVER_SLATE_DARK = '#cbd5e1';
const HOVER_BG_LIGHT = '#f1f5f9';
const HOVER_BG_DARK = 'rgba(148, 163, 184, 0.15)';
// Resting grey: at least 3:1 against every tile and dialog background in each theme.
const REST_GRAY_LIGHT = '#808080';
const REST_GRAY_DARK = '#9ca3af';

const BOX = 'M21 8v13H3V8M1 3h22v5H1z';
const ICON_PATHS = { archive: `${BOX}M10 12h4`, unarchive: `${BOX}M12 18v-6M9 15l3-3 3 3` } as const;

export function ArchiveIconButton({
  variant,
  onClick,
  ariaLabel,
  title,
  disabled = false
}: ArchiveIconButtonProps) {
  const { resolvedTheme } = useTheme();
  const [hover, setHover] = useState(false);
  const label = variant === 'archive' ? 'Archive project' : 'Unarchive project';

  const isHoverActive = hover && !disabled;
  const isDark = resolvedTheme === 'dark';
  const iconColor = isHoverActive
    ? (isDark ? HOVER_SLATE_DARK : HOVER_SLATE_LIGHT)
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
      style={{
        width: '28px',
        height: '28px',
        padding: 0,
        flexShrink: 0,
        background: isHoverActive ? hoverBg : 'transparent',
        border: 'none',
        borderRadius: '6px',
        boxShadow: isHoverActive ? '0 0 0 1.5px rgba(100, 116, 139, 0.5)' : 'none',
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
          d={ICON_PATHS[variant]}
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
