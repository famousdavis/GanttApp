// Tab navigation component

import { TabType } from '../types';

interface TabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function Tabs({ activeTab, onTabChange }: TabsProps) {
  const tabs: { id: TabType; label: string }[] = [
    { id: 'projects', label: 'Projects' },
    { id: 'releases', label: 'Releases' },
    { id: 'chart', label: 'Gantt Chart' },
    { id: 'about', label: 'About' }
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '0.5rem',
      borderBottom: '2px solid #eee',
      marginBottom: '2rem'
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === tab.id ? '#0070f3' : 'transparent',
            color: activeTab === tab.id ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === tab.id ? '3px solid #0070f3' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === tab.id ? '600' : '500',
            fontSize: '1rem',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.background = '#f5f5f5';
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
