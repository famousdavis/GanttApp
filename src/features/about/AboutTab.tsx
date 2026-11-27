// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import type { MouseEvent } from 'react';
import { APP_VERSION } from '../../lib/version';
import { copyrightYear } from '../../shared/utils/copyrightYear';
import { tabHref } from '../../shared/utils/tabLink';

/**
 * GanttApp's guides, a copy of its entry in the Help Center's list (spert-landing-page `src/data/help.ts`, hub v2.15.2):
 * titles and descriptions verbatim, in that order. The PDF is served from this app's own origin (`public/`).
 */
export const GUIDES = [
  {
    file: 'GanttApp_Quick_Reference_Guide.pdf',
    title: 'Quick Reference Guide',
    description:
      'How GanttApp shows each release as a build phase plus a delivery uncertainty window, and how to set one up.',
  },
] as const;

/** The repository the About page links to (help.ts `repo`). */
const REPO = 'https://github.com/famousdavis/GanttApp';

const TM = <span className="sf-mark sf-mark--tm">™</span>;
const REG = <span className="sf-mark">®</span>;

/** The About page's `h1`: the brand row's title with its ™ (contract §3 About page). */
export function AboutHeading() {
  return <>About GanttApp{TM}</>;
}

/** "↗" for a link that opens a new tab, and what a screen reader hears in its place (contract §7 About). */
function NewTab({ label = '' }: { label?: string }) {
  return (
    <>
      <span aria-hidden="true"> ↗</span>
      <span className="sf-sr">{label} (opens in a new tab)</span>
    </>
  );
}

interface AboutTabProps {
  /** Opens the Changelog tab: the footer's own handler, so What's new does exactly what the footer's Version does. */
  onOpenChangelog: () => void;
}

/**
 * The About page (FRAME26 pass 3, contract §3 About page and §7 About, stylesheet v4, v0.36.0). The frame's `.sf-about`
 * styles all of it: no inline style and no colour of its own. ⚠️ Render it as a DIRECT child of `main`, right after the
 * heading row (pages/index.tsx): the contract places it 16 px below that row, with nothing between.
 *
 * The words are William's (FRAME26-ABOUT-WORDS.md, 2026-11-27, and §7's shared words): change none without him.
 */
export function AboutTab({ onOpenChangelog }: AboutTabProps) {
  // What's new is a real link to the Changelog tab, so it is underlined like every About link and opens in a new tab on
  // a middle- or modified click; a plain click switches tabs in place, as the footer's Version button does.
  const openChangelog = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onOpenChangelog();
  };

  return (
    <div className="sf-about" data-sf="about">
      <section>
        <h2>What is GanttApp{TM}?</h2>
        <p>
          GanttApp{TM} helps project managers communicate release uncertainty to stakeholders. Traditional Gantt charts
          show single delivery dates, but real projects have uncertainty. GanttApp visualizes this by showing:
        </p>
        <ul>
          <li><strong>Solid bars:</strong> Design, Code, Test phase (predictable work)</li>
          <li><strong>Hatched bars:</strong> Delivery uncertainty window (the &ldquo;maybe&rdquo; zone)</li>
        </ul>
      </section>

      <section>
        <h2>How it works</h2>
        <ol>
          <li>Create a project, or load the sample</li>
          <li>
            On Releases, add each release with its start date, the date its design, code and test work ends (Early
            Finish), and the latest date it may be delivered (Late Finish)
          </li>
          <li>
            Open the Gantt Chart to see each release as a solid bar for the predictable work and a hatched bar for its
            delivery window
          </li>
          <li>Take snapshots to compare the plan over time</li>
        </ol>
      </section>

      <section>
        <h2>Guides</h2>
        <ul className="sf-guides" data-sf="guides">
          {GUIDES.map(g => (
            <li className="sf-guide" key={g.file}>
              <div className="sf-guide-body">
                <h3 className="sf-guide-title">{g.title}</h3>
                <p className="sf-guide-text">{g.description}</p>
              </div>
              <a className="sf-guide-open" href={`/${g.file}`} target="_blank" rel="noopener noreferrer">
                Open PDF<NewTab label={`: ${g.title}`} />
              </a>
            </li>
          ))}
        </ul>
        <p>
          <a href="https://spertsuite.com/help/ganttapp" target="_blank" rel="noopener noreferrer">
            More help in the Help Center<NewTab />
          </a>
        </p>
      </section>

      <section>
        <h2>Your data and storage</h2>
        <p>
          Unless you sign in and choose cloud storage, GanttApp{TM} keeps your projects in this browser, on this device,
          and sends them to no server. Clearing this site&apos;s data deletes them, so export a backup from time to time.
        </p>
        <p>
          If you sign in, with Google or with a Microsoft work or school account, and choose cloud storage, your projects
          are saved to your account in Google Firebase, over encrypted (HTTPS) connections. You can then open them on any
          device and share them with other people.
        </p>
        <p>
          Your theme stays in this browser whichever storage you use. Chart colors, toggles and default legend labels are
          personal: each person sees their own, even on a shared project. A legend label you edit on a project&apos;s
          chart is saved with that project, so everyone who shares it sees it.
        </p>
      </section>

      <section className="sf-about-legal" data-sf="about-legal">
        <h2>Version and license</h2>
        <p>
          Version {APP_VERSION} · <a href={tabHref('changelog')} onClick={openChangelog}>What&rsquo;s new</a>
        </p>
        <p>
          Created by William W. Davis, MSPM, PMP ·{' '}
          <a href={REPO} target="_blank" rel="noopener noreferrer">Source code on GitHub<NewTab /></a>
        </p>
        <p>
          &copy; {copyrightYear()} William W. Davis, MSPM, PMP. GanttApp{TM} is free software: you may use, change and
          share it under the GNU General Public License, version 3, with the additional terms its{' '}
          <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">LICENSE<NewTab /></a> adds under
          Section 7 of that license: attribution and legal notices, trademarks, the marking of modified versions,
          endorsement, and indemnification.
        </p>
        <p>
          SPERT{REG}, Statistical PERT{REG} and Estimation Made Easy{REG} are registered trademarks of famousdavis, LLC.
          GanttApp{TM} and MyScrumBudget{TM} are trademarks of famousdavis, LLC.
        </p>
        <p>
          THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW. EXCEPT WHEN OTHERWISE STATED IN
          WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM &quot;AS IS&quot; WITHOUT WARRANTY OF
          ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY
          AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH
          YOU. SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR OR CORRECTION.
        </p>
      </section>
    </div>
  );
}
