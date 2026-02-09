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
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Your Data & Security</h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: colors.textSecondary }}>
          <li>Stored locally in your <strong>browser</strong> (not in any cloud database)</li>
          <li><strong>Your data never leaves your device</strong></li>
          <li>No external database servers, no third-party access, no data governance concerns</li>
          <li>Safe for corporate/organizational data - all data stays within your network</li>
          <li>Use <strong>Export</strong> to backup your data to your file system anytime</li>
          <li>Use <strong>Import</strong> to restore from a backup or share with colleagues</li>
          <li><strong>Note:</strong> If you clear your browser cache/data, you will lose all stored projects and releases unless you&apos;ve exported a backup</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Version Updates</h3>
        <p style={{ lineHeight: '1.6', color: colors.textSecondary }}>
          When new versions are released, your data remains safe in localStorage. I recommend
          exporting a backup before major updates as a precaution.
        </p>
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
