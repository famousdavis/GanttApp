// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DragHandle } from '../DragHandle';

describe('DragHandle', () => {
  it('renders without crashing', () => {
    const { container } = render(<DragHandle />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders three dot elements', () => {
    const { container } = render(<DragHandle />);
    const outerDiv = container.firstChild as HTMLElement;
    const dots = outerDiv.children;
    expect(dots).toHaveLength(3);
  });

  it('has cursor: grab styling on container', () => {
    const { container } = render(<DragHandle />);
    const handle = container.firstChild as HTMLElement;
    expect(handle.style.cursor).toBe('grab');
  });
});
