// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// PencilIconButton — borderless icon button for the Edit list action.
// Default color is grayscale; turns blue on hover with a soft blue ring. v0.25.0 adds
// optional `active` prop — when true, renders the hover state permanently so the row
// being edited stays visibly marked even when the cursor moves away.

import { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';

interface PencilIconButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
  disabled?: boolean;
  /** v0.25.0 — when true, the button renders as if hovered (blue icon + blue tint + blue ring)
   *  even when the cursor is not over it. Used by ReleasesTab to mark the row currently
   *  being edited. Disabled overrides active (no visual on disabled buttons). */
  active?: boolean;
}

const HOVER_BLUE = '#0070f3';
const HOVER_BG_LIGHT = '#eff6ff';
const HOVER_BG_DARK = 'rgba(0, 112, 243, 0.15)';
const DEFAULT_GRAY = '#9ca3af';

export function PencilIconButton({
  onClick,
  ariaLabel = 'Edit',
  title = 'Edit',
  disabled = false,
  active = false
}: PencilIconButtonProps) {
  const { resolvedTheme } = useTheme();
  const [hover, setHover] = useState(false);

  const isHoverActive = (hover || active) && !disabled;
  const iconColor = isHoverActive ? HOVER_BLUE : DEFAULT_GRAY;
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
          d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
          stroke={iconColor}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
