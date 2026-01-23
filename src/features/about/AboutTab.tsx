// About Tab component

export function AboutTab() {
  return (
    <div style={{ maxWidth: '800px' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>About This App</h2>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Purpose</h3>
        <p style={{ lineHeight: '1.6', color: '#555' }}>
          <strong>GanttApp</strong> helps project managers communicate release uncertainty to stakeholders.
          Traditional Gantt charts show single delivery dates, but real projects have uncertainty.
          GanttApp visualizes this by showing:
        </p>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '2rem', lineHeight: '1.8' }}>
          <li><strong>Solid blue bars:</strong> Design, Code, Test phase (predictable work)</li>
          <li><strong>Hatched blue bars:</strong> Delivery uncertainty window (the "maybe" zone)</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Your Data & Security</h3>
        <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
          <li>Stored locally in your <strong>browser</strong> (not in any cloud database)</li>
          <li><strong>Your data never leaves your device</strong></li>
          <li>No external servers, no third-party access, no data governance concerns</li>
          <li>Safe for corporate/organizational data - all data stays within your network</li>
          <li>Use <strong>Export</strong> to backup your data to your file system anytime</li>
          <li>Use <strong>Import</strong> to restore from a backup or share with colleagues</li>
          <li><strong>Note:</strong> If you clear your browser cache/data, you will lose all stored projects and releases unless you've exported a backup</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Version Updates</h3>
        <p style={{ lineHeight: '1.6', color: '#555' }}>
          When new versions are released, your data remains safe in localStorage. I recommend
          exporting a backup before major updates as a precaution.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Author & Source Code</h3>
        <p style={{ lineHeight: '1.6', color: '#555', marginBottom: '0.5rem' }}>
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
    </div>
  );
}
