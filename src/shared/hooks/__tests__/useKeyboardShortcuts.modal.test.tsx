// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// Page-wide shortcuts wait while a modal surface is open: an arrow key behind a
// dialog would switch the tab and unmount it, and Ctrl+S or Escape would act on
// a form the dialog hides. Each surface is opened for real and each key pressed;
// then the surface is closed and the same key must reach the page again, so a
// probe that never fires cannot pass.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { ThemeWrapper } from '../../../test/ThemeWrapper';
import { ShortcutProbe, makeProbeSpies, PROBE_KEYS, pressOnPage } from '../../../test/shortcutProbe';
import { isModalSurfaceOpen, modalSurfaceProps } from '../../utils/modalSurface';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ProjectDialog } from '../../../features/projects/ProjectDialog';
import { projectsTabPalette } from '../../../features/projects/projectsTabPalette';
import { TosConsentModal } from '../../../features/settings/TosConsentModal';
import { ShareDialog } from '../../../features/projects/ShareDialog';
import { LIGHT_THEME } from '../../utils/theme';
import type { CloudGanttStorageService } from '../../storage';

function cloudStorageStub(): CloudGanttStorageService {
  return {
    mode: 'cloud',
    getProjectMembers: vi.fn().mockResolvedValue([]),
    listPendingInvites: vi.fn().mockResolvedValue([]),
  } as unknown as CloudGanttStorageService;
}

const SURFACES: Array<{ name: string; el: () => ReactElement }> = [
  { name: 'a bare modal surface', el: () => <div {...modalSurfaceProps} /> },
  {
    name: 'a modal confirmation dialog',
    el: () => (
      <ConfirmDialog
        modal
        title="Delete Project"
        message="Delete?"
        colors={LIGHT_THEME}
        buttons={[{ label: 'Cancel', variant: 'secondary', onClick: vi.fn() }, { label: 'Delete', variant: 'danger', onClick: vi.fn() }]}
      />
    ),
  },
  {
    name: 'the project dialog',
    el: () => (
      <ProjectDialog
        mode="new"
        name="" onNameChange={vi.fn()}
        finishDate="" onFinishDateChange={vi.fn()}
        workDays={undefined} onWorkDaysChange={vi.fn()}
        globalWorkDays={[1, 2, 3, 4, 5]}
        onSave={vi.fn()} onCancel={vi.fn()}
        returnFocusTo={() => null}
        colors={LIGHT_THEME}
        palette={projectsTabPalette('light')}
      />
    ),
  },
  { name: 'the terms consent dialog', el: () => <TosConsentModal colors={LIGHT_THEME} onAccept={vi.fn()} onCancel={vi.fn()} /> },
  {
    name: 'the sharing dialog',
    el: () => <ShareDialog projectId="p1" projectName="Alpha" cloudStorage={cloudStorageStub()} onClose={vi.fn()} />,
  },
];

describe('page-wide shortcuts and modal surfaces', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it.each(PROBE_KEYS)('with no modal surface open, $name reaches the page', ({ init, spy }) => {
    const spies = makeProbeSpies();
    render(<ShortcutProbe spies={spies} />);
    expect(isModalSurfaceOpen()).toBe(false);
    pressOnPage(init);
    expect(spies[spy]).toHaveBeenCalledTimes(1);
  });

  describe.each(SURFACES)('while $name is open', ({ el }) => {
    it.each(PROBE_KEYS)('$name waits, and reaches the page once it closes', async ({ init, spy }) => {
      const spies = makeProbeSpies();
      const view = render(
        <ThemeWrapper>
          <ShortcutProbe spies={spies} />
          {el()}
        </ThemeWrapper>,
      );
      await waitFor(() => expect(isModalSurfaceOpen()).toBe(true));
      pressOnPage(init);
      Object.values(spies).forEach(s => expect(s).not.toHaveBeenCalled());

      view.rerender(
        <ThemeWrapper>
          <ShortcutProbe spies={spies} />
        </ThemeWrapper>,
      );
      expect(isModalSurfaceOpen()).toBe(false);
      pressOnPage(init);
      expect(spies[spy]).toHaveBeenCalledTimes(1);
    });
  });
});
