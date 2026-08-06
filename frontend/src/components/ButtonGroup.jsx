import React from 'react';

export default function ButtonGroup({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {label && (
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
          {label}
        </label>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', direction: 'rtl' }}>
        {options.map((option) => {
          const isSelected = value === option.value;
          const isUnsetOption = option.value === '' || option.value === null;

          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: isSelected ? '1px solid var(--accent, #1f7a6c)' : '1px solid var(--border, #ccc)',
                backgroundColor: isSelected 
                  ? 'var(--accent, #1f7a6c)' 
                  : isUnsetOption ? 'var(--surface-muted, #f5f5f5)' : 'var(--surface, #fff)',
                color: isSelected ? '#ffffff' : isUnsetOption ? 'var(--text-muted, #777)' : 'var(--text, #333)',
                fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.9rem'
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