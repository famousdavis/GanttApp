// Color swatch picker with standard colors and custom color input

import { useState, useEffect, useRef } from 'react';
import { STANDARD_COLORS } from '../../utils/colors';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

export function ColorSwatchPicker({ value, onChange, label }: ColorSwatchPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  return (
    <div style={{ position: 'relative' }} ref={pickerRef}>
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#555'
      }}>
        {label}
      </label>
      <div
        onClick={() => setShowPicker(!showPicker)}
        style={{
          width: '100%',
          height: '40px',
          background: value,
          border: '2px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      />

      {showPicker && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '0.5rem',
          background: 'white',
          border: '2px solid #ddd',
          borderRadius: '8px',
          padding: '1rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          minWidth: '280px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '0.5rem',
            marginBottom: '0.75rem'
          }}>
            {STANDARD_COLORS.map(color => (
              <div
                key={color.value}
                onClick={() => {
                  onChange(color.value);
                  setShowPicker(false);
                }}
                title={color.name}
                style={{
                  width: '40px',
                  height: '40px',
                  background: color.value,
                  border: value === color.value ? '3px solid #0070f3' : '2px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              />
            ))}
          </div>
          <div style={{ borderTop: '1px solid #ddd', paddingTop: '0.75rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: '600',
              color: '#555',
              marginBottom: '0.5rem'
            }}>
              Custom Color
            </label>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                border: '2px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
