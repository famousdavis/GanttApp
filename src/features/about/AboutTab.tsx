// About Tab component

import { useTheme } from '../../context/ThemeContext';

export function AboutTab() {
  const { colors } = useTheme();

  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: colors.text }}>About This App</h2>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Purpose</h3>
        <p style={{ lineHeight: '1.6', color: colors.textSecondary }}>
          <strong>GanttApp<sup style={{ fontSize: '0.2em', color: '#ccc', fontWeight: 300, letterSpacing: '0.05em' }}>TM</sup></strong> helps project managers communicate release uncertainty to stakeholders.
          Traditional Gantt charts show single delivery dates, but real projects have uncertainty.
          GanttApp visualizes this by showing:
        </p>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '2rem', lineHeight: '1.8', color: colors.textSecondary }}>
          <li><strong>Solid bars:</strong> Design, Code, Test phase (predictable work)</li>
          <li><strong>Hatched bars:</strong> Delivery uncertainty window (the &ldquo;maybe&rdquo; zone)</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Your Data &amp; Storage Options</h3>

        <p style={{ lineHeight: '1.6', color: colors.textSecondary, marginBottom: '1rem' }}>
          GanttApp offers two storage modes. Switch between them in the <strong>Settings</strong> tab.
        </p>

        <h4 style={{ fontSize: '1rem', color: colors.text, marginBottom: '0.5rem' }}>Local Storage (Default)</h4>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: colors.textSecondary, marginBottom: '1rem' }}>
          <li>Data stored in your <strong>browser</strong> &mdash; never leaves your device</li>
          <li>No external servers, no third-party access, no data governance concerns</li>
          <li>Safe for corporate/organizational data</li>
          <li>Use <strong>Export</strong> to backup and <strong>Import</strong> to restore</li>
          <li><strong>Note:</strong> Clearing browser cache/data will remove stored data unless you&apos;ve exported a backup</li>
        </ul>

        <h4 style={{ fontSize: '1rem', color: colors.text, marginBottom: '0.5rem' }}>Cloud Storage (Optional)</h4>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: colors.textSecondary, marginBottom: '1rem' }}>
          <li>Sign in with <strong>Google</strong> or <strong>Microsoft</strong></li>
          <li>Data synced via Firebase/Firestore &mdash; access from any device</li>
          <li>Share projects with team members (owner, editor, viewer roles)</li>
          <li>Encrypted in transit (TLS) and at rest</li>
        </ul>

        <p style={{ lineHeight: '1.6', color: colors.textMuted, fontSize: '0.9rem' }}>
          Theme preference is always stored locally regardless of storage mode. Chart display settings
          (colors, labels, toggles) are personal preferences &mdash; each user sees their own settings,
          even on shared projects.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Version Updates</h3>
        <p style={{ lineHeight: '1.6', color: colors.textSecondary }}>
          When new versions are released, your data remains safe &mdash; whether stored locally
          in your browser or synced to the cloud. I recommend exporting a backup before major
          updates as a precaution.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Quick Start Guide</h3>
        <p style={{ lineHeight: '1.6', color: colors.textSecondary, marginBottom: '0.5rem' }}>
          New to GanttApp? My quick reference guide covers creating projects, adding releases,
          reading the chart, and using snapshots.
        </p>
        <a
          href="https://github.com/famousdavis/GanttApp/raw/main/GanttApp_Quick_Reference_Guide.pdf"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: '#0070f3',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: '600',
            marginTop: '0.5rem'
          }}
        >
          Download Quick Reference Guide (PDF)
        </a>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Author & Source Code</h3>
        <p style={{ lineHeight: '1.6', color: colors.textSecondary, marginBottom: '0.5rem' }}>
          Created by <strong>William W. Davis, MSPM, PMP</strong>
        </p>
        <a
          href="https://github.com/famousdavis/GanttApp"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: '#0070f3',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: '600',
            marginTop: '0.5rem'
          }}
        >
          View Source Code on GitHub
        </a>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>License</h3>
        <p style={{ lineHeight: '1.6', color: colors.textSecondary }}>
          This software is licensed under the <strong>GNU General Public License v3.0 (GPL-3.0)</strong>.
          You are free to use, modify, and distribute this software under the terms of the GPL-3.0 license.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>No Warranty Disclaimer</h3>
        <p style={{ lineHeight: '1.6', color: colors.textSecondary, fontSize: '0.85rem' }}>
          THERE IS NO WARRANTY FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW. EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES PROVIDE THE PROGRAM &ldquo;AS IS&rdquo; WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU. SHOULD THE PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING, REPAIR OR CORRECTION.
        </p>
      </section>
    </div>
  );
}
