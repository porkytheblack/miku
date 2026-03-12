'use client';

interface MikuConfigToolbarProps {
  viewMode: 'visual' | 'json';
  onViewModeChange: (mode: 'visual' | 'json') => void;
  agentName: string;
}

export default function MikuConfigToolbar({ viewMode, onViewModeChange, agentName }: MikuConfigToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {agentName || 'Miku Agent Config'}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
          ACP
        </span>
      </div>

      <div className="flex items-center gap-1 bg-[var(--bg-primary)] rounded-md p-0.5">
        <button
          onClick={() => onViewModeChange('visual')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            viewMode === 'visual'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Visual
        </button>
        <button
          onClick={() => onViewModeChange('json')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            viewMode === 'json'
              ? 'bg-[var(--accent-primary)] text-white'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          JSON
        </button>
      </div>
    </div>
  );
}
