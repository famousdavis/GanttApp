// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Tab navigation component

import { TabType } from '../types';
import { useTheme } from '../../context/ThemeContext';

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
    </div>
  );
}
