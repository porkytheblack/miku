'use client';

import type { EnvVariable } from '@/types';
import EnvRow from './EnvRow';

interface EnvTableProps {
  variables: EnvVariable[];
  selectedIds: Set<string>;
  editingId: string | null;
  showSecrets: boolean;
  onToggleSelect: (id: string) => void;
  onSetEditing: (id: string | null) => void;
  onUpdateVariable: (id: string, updates: Partial<Omit<EnvVariable, 'id'>>) => void;
  onDeleteVariable: (id: string) => void;
  onDuplicateVariable: (id: string) => void;
  onMoveVariable: (id: string, direction: 'up' | 'down') => void;
  onCopyVariable: (variable: EnvVariable) => void;
}

/**
 * Table displaying environment variables
 */
export default function EnvTable({
  variables,
  selectedIds,
  editingId,
  showSecrets,
  onToggleSelect,
  onSetEditing,
  onUpdateVariable,
  onDeleteVariable,
  onDuplicateVariable,
  onMoveVariable,
  onCopyVariable,
}: EnvTableProps) {
  const thStyle: React.CSSProperties = {
    padding: '8px 12px',
    textAlign: 'left',
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead
          style={{
            position: 'sticky',
            top: 0,
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-default)',
            zIndex: 1,
          }}
        >
          <tr>
            <th style={{ ...thStyle, width: '40px', padding: '8px' }}>
              <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                Select
              </span>
            </th>
            <th style={thStyle}>Key</th>
            <th style={thStyle}>Value</th>
            <th style={{ ...thStyle, width: '128px', padding: '8px' }}>
              <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                Actions
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {variables.map((variable) => (
            <EnvRow
              key={variable.id}
              variable={variable}
              isSelected={selectedIds.has(variable.id)}
              isEditing={editingId === variable.id}
              showSecrets={showSecrets}
              onSelect={() => onSetEditing(variable.id)}
              onToggleSelect={() => onToggleSelect(variable.id)}
              onStartEdit={() => onSetEditing(variable.id)}
              onEndEdit={() => onSetEditing(null)}
              onUpdate={(updates) => onUpdateVariable(variable.id, updates)}
              onDelete={() => onDeleteVariable(variable.id)}
              onDuplicate={() => onDuplicateVariable(variable.id)}
              onMoveUp={() => onMoveVariable(variable.id, 'up')}
              onMoveDown={() => onMoveVariable(variable.id, 'down')}
              onCopy={() => onCopyVariable(variable)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
