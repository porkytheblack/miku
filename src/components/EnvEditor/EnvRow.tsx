'use client';

import { useState, useRef, useEffect } from 'react';
import type { EnvVariable } from '@/types';

interface EnvRowProps {
  variable: EnvVariable;
  isSelected: boolean;
  isEditing: boolean;
  showSecrets: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onUpdate: (updates: Partial<Omit<EnvVariable, 'id'>>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onCopy: () => void;
}

/**
 * Individual row in the environment variables table
 */
export default function EnvRow({
  variable,
  isSelected,
  isEditing,
  showSecrets,
  onSelect,
  onToggleSelect,
  onStartEdit,
  onEndEdit,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onCopy,
}: EnvRowProps) {
  const [editKey, setEditKey] = useState(variable.key);
  const [editValue, setEditValue] = useState(variable.value);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const [showActions, setShowActions] = useState(false);

  // Focus key input when editing starts
  useEffect(() => {
    if (isEditing && keyInputRef.current) {
      keyInputRef.current.focus();
      keyInputRef.current.select();
    }
  }, [isEditing]);

  // Sync edit state with variable
  useEffect(() => {
    setEditKey(variable.key);
    setEditValue(variable.value);
  }, [variable.key, variable.value]);

  const handleSave = () => {
    const trimmedKey = editKey.trim();
    const trimmedValue = editValue.trim();

    // Only save if key is not empty
    if (trimmedKey) {
      onUpdate({
        key: trimmedKey,
        value: trimmedValue,
      });
    } else {
      // Reset to original values if key is empty
      setEditKey(variable.key);
      setEditValue(variable.value);
    }
    onEndEdit();
  };

  // Handle blur - only end editing if focus is leaving the row entirely
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;

    // Check if focus is moving to the other input in this row
    if (relatedTarget === keyInputRef.current || relatedTarget === valueInputRef.current) {
      // Focus is moving within the row, don't end editing
      return;
    }

    // Focus is leaving the row entirely, save and end editing
    handleSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditKey(variable.key);
      setEditValue(variable.value);
      onEndEdit();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      // Tab from key to value
      if (document.activeElement === keyInputRef.current) {
        e.preventDefault();
        valueInputRef.current?.focus();
        valueInputRef.current?.select();
      }
    }
  };

  // Hide all values by default for security - only show when showSecrets is enabled
  const displayValue = showSecrets
    ? variable.value
    : '••••••••';

  const actionButtonStyle: React.CSSProperties = {
    padding: '4px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--text-tertiary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background var(--duration-fast) var(--easing-default), color var(--duration-fast) var(--easing-default)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '4px 8px',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-focus)',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  return (
    <tr
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: isSelected ? 'var(--accent-subtle)' : 'transparent',
        transition: 'background var(--duration-fast) var(--easing-default)',
      }}
      onMouseEnter={(e) => {
        setShowActions(true);
        if (!isSelected) {
          e.currentTarget.style.background = 'var(--bg-secondary)';
        }
      }}
      onMouseLeave={(e) => {
        setShowActions(false);
        if (!isSelected) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
      onDoubleClick={() => {
        if (!isEditing) onStartEdit();
      }}
    >
      {/* Checkbox */}
      <td style={{ width: '40px', padding: '8px' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          style={{
            width: '16px',
            height: '16px',
            cursor: 'pointer',
            accentColor: 'var(--accent-primary)',
          }}
        />
      </td>

      {/* Key */}
      <td
        style={{
          padding: '8px 12px',
          cursor: isEditing ? 'default' : 'pointer',
        }}
        onClick={() => { if (!isEditing) onSelect(); }}
      >
        {isEditing ? (
          <input
            ref={keyInputRef}
            type="text"
            value={editKey}
            onChange={(e) => setEditKey(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={inputStyle}
            placeholder="KEY"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
              }}
            >
              {variable.key || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>empty</span>}
            </span>
            {variable.isSecret && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                }}
              >
                secret
              </span>
            )}
          </div>
        )}
      </td>

      {/* Value */}
      <td
        style={{
          padding: '8px 12px',
          cursor: isEditing ? 'default' : 'pointer',
        }}
        onClick={() => { if (!isEditing) onSelect(); }}
      >
        {isEditing ? (
          <input
            ref={valueInputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={inputStyle}
            placeholder="value"
          />
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              color: showSecrets ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              display: 'block',
            }}
          >
            {displayValue || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>empty</span>}
          </span>
        )}
      </td>

      {/* Actions */}
      <td style={{ width: '128px', padding: '8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: showActions || isSelected ? 1 : 0,
            transition: 'opacity var(--duration-fast) var(--easing-default)',
          }}
        >
          <button
            onClick={onCopy}
            style={actionButtonStyle}
            title="Copy"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={onMoveUp}
            style={actionButtonStyle}
            title="Move up"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            style={actionButtonStyle}
            title="Move down"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onDuplicate}
            style={actionButtonStyle}
            title="Duplicate"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            style={{ ...actionButtonStyle, color: 'var(--highlight-grammar)' }}
            title="Delete"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}
