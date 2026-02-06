import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AboutTab } from '../AboutTab';
import { ThemeWrapper } from '../../../test/ThemeWrapper';

describe('AboutTab', () => {
  it('renders without crashing', () => {
    const { container } = render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the About This App heading', () => {
    render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText('About This App')).toBeTruthy();
  });

  it('renders the Purpose section', () => {
    render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText('Purpose')).toBeTruthy();
  });

  it('renders the author name', () => {
    render(<AboutTab />, { wrapper: ThemeWrapper });
    expect(screen.getByText(/William W. Davis/)).toBeTruthy();
  });
});
