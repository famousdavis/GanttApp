// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Tab navigation component

import { TabType } from '../types';
import { useTheme } from '../../context/ThemeContext';

// This app's page in the SPERT® Suite Help Center. Module-local: the link below
// is its only consumer, and the app's other spertsuite.com addresses are inline
// literals too. Deliberately not exported, so the tests compare the address as a
// literal and a wrong address here cannot satisfy them.
const HELP_CENTER_URL = 'https://spertsuite.com/help/ganttapp';

interface TabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function Tabs({ activeTab, onTabChange }: TabsProps) {
  const { colors } = useTheme();

  const tabs: { id: TabType; label: string }[] = [
    { id: 'projects', label: 'Projects' },
    { id: 'releases', label: 'Releases' },
    { id: 'chart', label: 'Gantt Chart' },
    { id: 'settings', label: 'Settings' },
    { id: 'about', label: 'About' }
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '0.5rem',
      borderBottom: `2px solid ${colors.border}`,
      marginBottom: '2rem'
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: '0.5rem 1.25rem',
            background: activeTab === tab.id ? colors.accent : 'transparent',
            color: activeTab === tab.id ? colors.accentText : colors.textSecondary,
            border: 'none',
            borderBottom: activeTab === tab.id ? `3px solid ${colors.accent}` : '3px solid transparent',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.background = colors.hoverBg;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          {tab.label}
        </button>
      ))}
      {/* Help Center: a LINK that leaves the app, never a tab. So it is not in
          `tabs`, not a <button>, and not in pages/index.tsx's arrow-key tabOrder.
          It sits after About, at the bar's right-hand end, as quiet muted text
          with none of the tabs' fill, radius or bottom border. The arrow is
          decoration, hidden from assistive technology; the visually hidden text
          gives the accessible name "Help Center (opens in a new tab)".
          ⚠️ The spaces are their own text nodes, OUTSIDE the spans: a space inside
          a span is trimmed by the accessible-name computation, giving
          "Help Center(opens in a new tab)". */}
      <a
        href={HELP_CENTER_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          marginLeft: 'auto',
          alignSelf: 'center',
          color: colors.textSecondary,
          fontSize: '0.875rem',
          whiteSpace: 'nowrap',
          textDecoration: 'none'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
        onMouseLeave={(e) => {
          if (document.activeElement !== e.currentTarget) e.currentTarget.style.textDecoration = 'none';
        }}
        onFocus={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
        onBlur={(e) => {
          if (!e.currentTarget.matches(':hover')) e.currentTarget.style.textDecoration = 'none';
        }}
      >
        Help Center{' '}<span aria-hidden="true">↗</span>{' '}<span className="pt-sr-only">(opens in a new tab)</span>
      </a>
    </div>
  );
}
