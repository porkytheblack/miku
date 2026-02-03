'use client';

import React from 'react';
import type { KanbanCardColor } from '@/types';

interface KanbanColorPickerProps {
  value: KanbanCardColor | undefined;
  onChange: (color: KanbanCardColor | undefined) => void;
}

/**
 * Color values for card labels
 */
export const KANBAN_COLORS: Record<KanbanCardColor, string> = {
  gray: '#78716C',
  red: '#EF4444',
  orange: '#F97316',
  yellow: '#EAB308',
  green: '#22C55E',
  blue: '#3B82F6',
  purple: '#A855F7',
};

/**
 * Color picker for card labels
 * Shows 7 color swatches plus a "none" option
 */
export default function KanbanColorPicker({ value, onChange }: KanbanColorPickerProps) {
  const colors: (KanbanCardColor | 'none')[] = ['none', 'gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple'];

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
      }}
    >
      {colors.map((color) => {
        const isSelected = color === 'none' ? !value : value === color;
        const bgColor = color === 'none' ? 'transparent' : KANBAN_COLORS[color];

        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color === 'none' ? undefined : color)}
            title={color === 'none' ? 'No color' : color.charAt(0).toUpperCase() + color.slice(1)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: 'var(--radius-sm)',
              border: isSelected
                ? '2px solid var(--accent-primary)'
                : color === 'none'
                ? '2px dashed var(--border-default)'
                : '2px solid transparent',
              background: bgColor,
              cursor: 'pointer',
              padding: 0,
              transition: 'transform var(--duration-fast) var(--easing-default)',
              position: 'relative',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {color === 'none' && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="var(--text-tertiary)"
                strokeWidth="2"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
