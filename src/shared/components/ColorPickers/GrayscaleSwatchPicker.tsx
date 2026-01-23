// Grayscale color swatch picker

import { GRAYSCALE_COLORS } from '../../utils/colors';

interface GrayscaleSwatchPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function GrayscaleSwatchPicker({ label, value, onChange }: GrayscaleSwatchPickerProps) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: '500'
      }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {GRAYSCALE_COLORS.map(({ color, name }) => {
          const isActive = value === color;
          return (
            <div
              key={color}
              onClick={() => onChange(color)}
              title={name}
              style={{
                width: '50px',
                height: '50px',
                background: color,
                border: isActive ? '3px solid #0070f3' : '2px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer',
                boxShadow: isActive ? '0 2px 4px rgba(0, 112, 243, 0.3)' : 'none',
                transition: 'all 0.2s ease',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.borderColor = '#999';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.borderColor = '#ddd';
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
