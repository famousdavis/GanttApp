import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from '../Tabs';
import { ThemeWrapper } from '../../../test/ThemeWrapper';

describe('Tabs', () => {
  const mockOnTabChange = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all five tabs', () => {
    render(<Tabs activeTab="projects" onTabChange={mockOnTabChange} />, { wrapper: ThemeWrapper });
    expect(screen.getByText('Projects')).toBeTruthy();
    expect(screen.getByText('Releases')).toBeTruthy();
    expect(screen.getByText('Gantt Chart')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('About')).toBeTruthy();
  });

  it('renders tabs in correct order', () => {
    render(<Tabs activeTab="projects" onTabChange={mockOnTabChange} />, { wrapper: ThemeWrapper });
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].textContent).toBe('Projects');
    expect(buttons[1].textContent).toBe('Releases');
    expect(buttons[2].textContent).toBe('Gantt Chart');
    expect(buttons[3].textContent).toBe('Settings');
    expect(buttons[4].textContent).toBe('About');
  });

  it('calls onTabChange with "projects" when clicking Projects', () => {
    render(<Tabs activeTab="releases" onTabChange={mockOnTabChange} />, { wrapper: ThemeWrapper });
    fireEvent.click(screen.getByText('Projects'));
    expect(mockOnTabChange).toHaveBeenCalledWith('projects');
  });

  it('calls onTabChange with "releases" when clicking Releases', () => {
    render(<Tabs activeTab="projects" onTabChange={mockOnTabChange} />, { wrapper: ThemeWrapper });
    fireEvent.click(screen.getByText('Releases'));
    expect(mockOnTabChange).toHaveBeenCalledWith('releases');
  });

  it('calls onTabChange with "chart" when clicking Gantt Chart', () => {
    render(<Tabs activeTab="projects" onTabChange={mockOnTabChange} />, { wrapper: ThemeWrapper });
    fireEvent.click(screen.getByText('Gantt Chart'));
    expect(mockOnTabChange).toHaveBeenCalledWith('chart');
  });

  it('calls onTabChange with "settings" when clicking Settings', () => {
    render(<Tabs activeTab="projects" onTabChange={mockOnTabChange} />, { wrapper: ThemeWrapper });
    fireEvent.click(screen.getByText('Settings'));
    expect(mockOnTabChange).toHaveBeenCalledWith('settings');
  });

  it('calls onTabChange with "about" when clicking About', () => {
    render(<Tabs activeTab="projects" onTabChange={mockOnTabChange} />, { wrapper: ThemeWrapper });
    fireEvent.click(screen.getByText('About'));
    expect(mockOnTabChange).toHaveBeenCalledWith('about');
  });

  it('does not call onTabChange on initial render', () => {
    const freshMock = vi.fn();
    render(<Tabs activeTab="projects" onTabChange={freshMock} />, { wrapper: ThemeWrapper });
    expect(freshMock).not.toHaveBeenCalled();
  });

  it('highlights the active tab with blue background', () => {
    render(<Tabs activeTab="projects" onTabChange={mockOnTabChange} />, { wrapper: ThemeWrapper });
    const projectsTab = screen.getByText('Projects');
    expect(projectsTab.style.color).toBe('white');
    // jsdom converts hex to rgb
    expect(projectsTab.style.background).toContain('0, 112, 243');
  });
});
