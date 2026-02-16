// Color swatch picker with standard colors and custom color input

import { useState, useEffect, useRef } from 'react';
import { STANDARD_COLORS } from '../../utils/colors';
import { useTheme } from '../../../context/ThemeContext';

interface ColorSwatchPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
  hatched?: boolean;
}

export function ColorSwatchPicker({ value, onChange, label, hatched }: ColorSwatchPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const { colors } = useTheme();

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
        color: colors.textSecondary
      }}>
        {label}
      </label>
      {hatched ? (
        <svg
          onClick={() => setShowPicker(!showPicker)}
          width="100%" height="40"
          style={{ display: 'block', border: `2px solid ${colors.border}`, borderRadius: '4px', cursor: 'pointer' }}
        >
          <defs>
            <pattern id="swatch-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke={value} strokeWidth="4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#swatch-hatch)`} stroke={value} strokeWidth="2" rx="2" />
        </svg>
      ) : (
        <div
          onClick={() => setShowPicker(!showPicker)}
          style={{
            width: '100%',
            height: '40px',
            background: value,
            border: `2px solid ${colors.border}`,
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        />
      )}

      {showPicker && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '0.5rem',
          background: colors.surface,
          border: `2px solid ${colors.border}`,
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
                  border: value === color.value ? '3px solid #0070f3' : `2px solid ${colors.border}`,
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
          <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '0.75rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: '600',
              color: colors.textSecondary,
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
                border: `2px solid ${colors.border}`,
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
