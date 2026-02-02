import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutTab } from '../AboutTab';

describe('AboutTab', () => {
  it('renders without crashing', () => {
    const { container } = render(<AboutTab />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the About This App heading', () => {
    render(<AboutTab />);
    expect(screen.getByText('About This App')).toBeTruthy();
  });

  it('renders the Purpose section', () => {
    render(<AboutTab />);
    expect(screen.getByText('Purpose')).toBeTruthy();
  });

  it('renders the author name', () => {
    render(<AboutTab />);
    expect(screen.getByText(/William W. Davis/)).toBeTruthy();
  });
});
