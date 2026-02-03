'use client';

import { useState } from 'react';
import type { EnvExportFormat } from '@/types';

interface EnvToolbarProps {
  variableCount: number;
  selectedCount: number;
  searchQuery: string;
  showSecrets: boolean;
  onSearch: (query: string) => void;
  onAddVariable: () => void;
  onDeleteSelected: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleSecrets: () => void;
  onCopyAll: () => void;
  onCopySelected: () => void;
  onImportFromClipboard: () => void;
  onExport: (format: EnvExportFormat) => void;
}

/**
 * Toolbar with actions for the EnvEditor
 */
export default function EnvToolbar({
  variableCount,
  selectedCount,
  searchQuery,
  showSecrets,
  onSearch,
  onAddVariable,
  onDeleteSelected,
  onSelectAll,
  onClearSelection,
  onToggleSecrets,
  onCopyAll,
  onCopySelected,
  onImportFromClipboard,
  onExport,
}: EnvToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const iconButtonStyle: React.CSSProperties = {
    padding: '6px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background var(--duration-fast) var(--easing-default), color var(--duration-fast) var(--easing-default)',
  };

  const textButtonStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: 'var(--text-xs)',
    transition: 'background var(--duration-fast) var(--easing-default), color var(--duration-fast) var(--easing-default)',
  };

  const dividerStyle: React.CSSProperties = {
    width: '1px',
    height: '20px',
    background: 'var(--border-default)',
    margin: '0 4px',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-2)',
        padding: 'var(--spacing-2) var(--spacing-4)',
        borderBottom: '1px solid var(--border-default)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: '256px' }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search variables..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '36px',
            paddingRight: '12px',
            paddingTop: '6px',
            paddingBottom: '6px',
            fontSize: 'var(--text-sm)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-focus)';
            e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-subtle)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Variable count */}
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
          padding: '0 8px',
          whiteSpace: 'nowrap',
        }}
      >
        {variableCount} variable{variableCount !== 1 ? 's' : ''}
        {selectedCount > 0 && ` (${selectedCount} selected)`}
      </span>

      <div style={{ flex: 1 }} />

      {/* Selection actions */}
      {selectedCount > 0 ? (
        <>
          <button
            onClick={onCopySelected}
            style={iconButtonStyle}
            title="Copy selected"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={onDeleteSelected}
            style={{ ...iconButtonStyle, color: 'var(--highlight-grammar)' }}
            title="Delete selected"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            onClick={onClearSelection}
            style={textButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Clear
          </button>
          <div style={dividerStyle} />
        </>
      ) : (
        <>
          <button
            onClick={onSelectAll}
            style={textButtonStyle}
            title="Select all"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Select All
          </button>
          <div style={dividerStyle} />
        </>
      )}

      {/* Toggle secrets visibility */}
      <button
        onClick={onToggleSecrets}
        style={{
          ...iconButtonStyle,
          background: showSecrets ? 'var(--accent-subtle)' : 'transparent',
          color: showSecrets ? 'var(--accent-primary)' : 'var(--text-secondary)',
        }}
        title={showSecrets ? 'Hide secrets' : 'Show secrets'}
        onMouseEnter={(e) => {
          if (!showSecrets) {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!showSecrets) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }
        }}
      >
        {showSecrets ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        )}
      </button>

      {/* Copy all */}
      <button
        onClick={onCopyAll}
        style={iconButtonStyle}
        title="Copy all as .env"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-tertiary)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Import */}
      <button
        onClick={onImportFromClipboard}
        style={iconButtonStyle}
        title="Import from clipboard"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-tertiary)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </button>

      {/* Export dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          style={iconButtonStyle}
          title="Export"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>

        {showExportMenu && (
          <>
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 10,
              }}
              onClick={() => setShowExportMenu(false)}
            />
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                width: '128px',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                padding: '4px 0',
                zIndex: 20,
              }}
            >
              {[
                { format: 'env' as EnvExportFormat, label: '.env format' },
                { format: 'json' as EnvExportFormat, label: 'JSON format' },
                { format: 'yaml' as EnvExportFormat, label: 'YAML format' },
              ].map(({ format, label }) => (
                <button
                  key={format}
                  onClick={() => { onExport(format); setShowExportMenu(false); }}
                  style={{
                    width: '100%',
                    padding: '6px 12px',
                    textAlign: 'left',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={dividerStyle} />

      {/* Add variable */}
      <button
        onClick={onAddVariable}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          transition: 'opacity var(--duration-fast) var(--easing-default)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add
      </button>
    </div>
  );
}
