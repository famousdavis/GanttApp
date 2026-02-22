import { describe, it, expect, beforeEach } from 'vitest';
import { clearLocalProjectData } from '../local-gantt-storage-service';

describe('clearLocalProjectData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes ganttAppData from localStorage', () => {
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [], releases: [] }));
    clearLocalProjectData();
    expect(localStorage.getItem('ganttAppData')).toBeNull();
  });

  it('removes ganttAppSnapshots from localStorage', () => {
    localStorage.setItem('ganttAppSnapshots', JSON.stringify([{ id: 'snap1' }]));
    clearLocalProjectData();
    expect(localStorage.getItem('ganttAppSnapshots')).toBeNull();
  });

  it('preserves ganttapp-storage-mode', () => {
    localStorage.setItem('ganttapp-storage-mode', 'cloud');
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [] }));
    clearLocalProjectData();
    expect(localStorage.getItem('ganttapp-storage-mode')).toBe('cloud');
  });

  it('preserves ganttapp-has-uploaded-to-cloud', () => {
    localStorage.setItem('ganttapp-has-uploaded-to-cloud', 'true');
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [] }));
    clearLocalProjectData();
    expect(localStorage.getItem('ganttapp-has-uploaded-to-cloud')).toBe('true');
  });

  it('preserves gantt-theme', () => {
    localStorage.setItem('gantt-theme', 'dark');
    localStorage.setItem('ganttAppData', JSON.stringify({ projects: [] }));
    clearLocalProjectData();
    expect(localStorage.getItem('gantt-theme')).toBe('dark');
  });

  it('does not throw when keys do not exist', () => {
    expect(() => clearLocalProjectData()).not.toThrow();
  });
});
