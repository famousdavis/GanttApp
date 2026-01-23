// Preset button group for font size and line width controls

interface PresetButtonGroupProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function PresetButtonGroup({ label, value, options, onChange }: PresetButtonGroupProps) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {options.map(option => {
          const isActive = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              style={{
                padding: '0.5rem 1rem',
                background: isActive ? '#e6f2ff' : 'white',
                border: isActive ? '2px solid #0070f3' : '2px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: isActive ? '600' : '500',
                boxShadow: isActive ? '0 2px 4px rgba(0, 112, 243, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#999';
                  e.currentTarget.style.background = '#f8f8f8';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = '#ddd';
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
