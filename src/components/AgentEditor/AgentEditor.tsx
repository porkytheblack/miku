'use client';

/**
 * AgentEditor Component
 *
 * EXPERIMENTAL: Main editor for .miku-agent files.
 * Provides a chat interface with Claude Code integration,
 * task progress tracking, and approval workflow.
 *
 * Layout:
 * - Left panel: Chat interface (AgentChat)
 * - Right panel: Tasks and Approvals (tabs or stacked)
 * - Bottom: Input bar (integrated in AgentChat)
 * - Top-right: Config toggle
 */

import { useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { AgentEditorProvider, useAgentEditor } from '@/context/AgentEditorContext';
import { useDocument } from '@/context/DocumentContext';
import AgentChat from './AgentChat';
import AgentTaskList from './AgentTaskList';
import AgentApprovalPanel from './AgentApprovalPanel';

// ============================================
// Status Indicator Component
// ============================================

function StatusIndicator() {
  const { state } = useAgentEditor();
  const { connectionStatus, activityStatus } = state.ui;

  const getStatusColor = () => {
    if (connectionStatus === 'error') return 'var(--status-error)';
    if (connectionStatus === 'connecting') return 'var(--status-warning)';
    if (connectionStatus === 'connected') return 'var(--status-success)';
    return 'var(--text-tertiary)';
  };

  const getStatusText = () => {
    if (connectionStatus === 'error') return 'Error';
    if (connectionStatus === 'connecting') return 'Connecting...';
    if (connectionStatus === 'connected') {
      if (activityStatus === 'thinking') return 'Thinking...';
      if (activityStatus === 'working') return 'Working...';
      if (activityStatus === 'waiting_approval') return 'Needs approval';
      return 'Connected';
    }
    return 'Ready';
  };

  const isActive = activityStatus === 'thinking' || activityStatus === 'working';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 10px',
        borderRadius: '6px',
        background: connectionStatus === 'connected' ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: getStatusColor(),
          boxShadow: connectionStatus === 'connected' ? `0 0 6px ${getStatusColor()}` : 'none',
          animation: isActive ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      <span
        style={{
          fontSize: '12px',
          color: connectionStatus === 'connected' ? 'var(--status-success)' : 'var(--text-secondary)',
          fontWeight: 500,
        }}
      >
        {getStatusText()}
      </span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Config Panel Component
// ============================================

function ConfigPanel() {
  const { state, updateConfig, setConfigPanelOpen } = useAgentEditor();
  const { config } = state.document;

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateConfig({ model: e.target.value });
  };

  const handleAutoApproveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ autoApprove: e.target.checked });
  };

  const handleWorkingDirChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ workingDirectory: e.target.value });
  };

  const handleBrowseDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Working Directory',
        defaultPath: config.workingDirectory || undefined,
      });
      if (selected && typeof selected === 'string') {
        updateConfig({ workingDirectory: selected });
      }
    } catch (error) {
      console.error('Failed to open directory picker:', error);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '52px',
        right: '12px',
        width: '320px',
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px var(--border-primary)',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <span
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Configuration
        </span>
        <button
          onClick={() => setConfigPanelOpen(false)}
          style={{
            padding: '4px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-tertiary)';
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Config fields */}
      <div style={{ padding: '16px' }}>
        {/* Model */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 500,
            }}
          >
            Model
          </label>
          <select
            value={config.model}
            onChange={handleModelChange}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--accent-primary)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-primary)';
            }}
          >
            <option value="claude-sonnet-4">Claude Sonnet 4</option>
            <option value="claude-opus-4">Claude Opus 4</option>
            <option value="claude-haiku-3">Claude Haiku 3</option>
          </select>
        </div>

        {/* Working Directory */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 500,
            }}
          >
            Working Directory
          </label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={config.workingDirectory}
              onChange={handleWorkingDirChange}
              placeholder="/path/to/project"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-primary)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-primary)';
              }}
            />
            <button
              onClick={handleBrowseDirectory}
              style={{
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid var(--border-primary)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title="Browse for directory"
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-subtle)';
                e.currentTarget.style.color = 'var(--accent-primary)';
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-primary)';
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              marginTop: '6px',
              lineHeight: 1.4,
            }}
          >
            Claude will operate in this directory
          </p>
        </div>

        {/* Auto Approve */}
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'var(--bg-tertiary)',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={config.autoApprove}
              onChange={handleAutoApproveChange}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                marginTop: '2px',
                accentColor: 'var(--accent-primary)',
              }}
            />
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                Auto-approve low-risk actions
              </span>
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--text-tertiary)',
                  marginTop: '4px',
                  lineHeight: 1.4,
                }}
              >
                Automatically approve web fetch operations
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Toolbar Component
// ============================================

function AgentToolbar() {
  const { state, toggleConfigPanel, clearConversation } = useAgentEditor();
  const { metadata } = state.document;
  const pendingCount = state.document.pendingApprovals.filter(
    (a) => a.status === 'pending'
  ).length;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
        minHeight: '52px',
      }}
    >
      {/* Agent icon and name */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary, var(--accent-primary)) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.25)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </div>
        <div>
          <span
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {metadata.name}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)',
            }}
          >
            Claude Code Agent
          </span>
        </div>
      </div>

      <div style={{ marginLeft: '8px' }}>
        <StatusIndicator />
      </div>

      {/* Pending approval badge */}
      {pendingCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: 'rgba(234, 179, 8, 0.12)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: 'var(--status-warning)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          {pendingCount} pending
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Clear conversation */}
      <button
        onClick={clearConversation}
        style={{
          padding: '8px',
          borderRadius: '8px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s ease, background 0.15s ease',
        }}
        title="Clear conversation"
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.background = 'var(--bg-tertiary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      </button>

      {/* Config toggle */}
      <button
        onClick={toggleConfigPanel}
        style={{
          padding: '8px',
          borderRadius: '8px',
          border: 'none',
          background: state.ui.isConfigOpen
            ? 'var(--accent-subtle)'
            : 'transparent',
          color: state.ui.isConfigOpen
            ? 'var(--accent-primary)'
            : 'var(--text-tertiary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s ease, background 0.15s ease',
        }}
        title="Settings"
        onMouseEnter={(e) => {
          if (!state.ui.isConfigOpen) {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'var(--bg-tertiary)';
          }
        }}
        onMouseLeave={(e) => {
          if (!state.ui.isConfigOpen) {
            e.currentTarget.style.color = 'var(--text-tertiary)';
            e.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}

// ============================================
// Sidebar Tab Button Component
// ============================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}

function TabButton({ active, onClick, icon, label, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '8px',
        border: 'none',
        background: active ? 'var(--bg-primary)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--bg-tertiary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'white',
            background: 'var(--status-warning)',
            padding: '1px 6px',
            borderRadius: '10px',
            minWidth: '18px',
            textAlign: 'center',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ============================================
// Inner Editor Component
// ============================================

interface AgentEditorInnerProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

function AgentEditorInner({ initialContent, onContentChange }: AgentEditorInnerProps) {
  const { state, loadContent, getContent } = useAgentEditor();
  const { registerContentGetter, setOriginalContent } = useDocument();

  const baselineContentRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'approvals'>('tasks');

  // Register content getter
  useEffect(() => {
    registerContentGetter(getContent);
  }, [registerContentGetter, getContent]);

  // Load initial content
  useEffect(() => {
    if (initialContent !== undefined) {
      loadContent(initialContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture baseline content
  useEffect(() => {
    if (state.hasLoaded && baselineContentRef.current === null) {
      const baseline = getContent();
      baselineContentRef.current = baseline;
      setOriginalContent(baseline);
      setTimeout(() => setIsInitialized(true), 0);
    }
  }, [state.hasLoaded, getContent, setOriginalContent]);

  // Notify parent of content changes
  useEffect(() => {
    if (!onContentChange) return;
    if (!isInitialized) return;
    if (baselineContentRef.current === null) return;

    const currentContent = getContent();
    onContentChange(currentContent);
  }, [state.document, getContent, onContentChange, isInitialized]);

  // Switch to approvals tab when there are pending approvals
  useEffect(() => {
    const pendingCount = state.document.pendingApprovals.filter(
      (a) => a.status === 'pending'
    ).length;
    if (pendingCount > 0) {
      setActiveTab('approvals');
    }
  }, [state.document.pendingApprovals]);

  const pendingApprovalsCount = state.document.pendingApprovals.filter(
    (a) => a.status === 'pending'
  ).length;

  const activeTasksCount = state.document.tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  ).length;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
        position: 'relative',
      }}
    >
      <AgentToolbar />

      {/* Config panel (absolute positioned) */}
      {state.ui.isConfigOpen && <ConfigPanel />}

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {/* Left panel: Chat */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--border-primary)',
          }}
        >
          <AgentChat />
        </div>

        {/* Right panel: Tasks/Approvals */}
        <div
          style={{
            width: '320px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-secondary)',
          }}
        >
          {/* Tab switcher */}
          <div
            style={{
              display: 'flex',
              gap: '4px',
              padding: '10px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-primary)',
            }}
          >
            <TabButton
              active={activeTab === 'tasks'}
              onClick={() => setActiveTab('tasks')}
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              }
              label="Tasks"
              badge={activeTasksCount > 0 ? activeTasksCount : undefined}
            />
            <TabButton
              active={activeTab === 'approvals'}
              onClick={() => setActiveTab('approvals')}
              icon={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              }
              label="Approvals"
              badge={pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined}
            />
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'tasks' ? <AgentTaskList /> : <AgentApprovalPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Export
// ============================================

interface AgentEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Agent editor component
 * Provides a chat interface for Claude Code integration with .miku-agent files
 *
 * EXPERIMENTAL: This is an experimental feature. The API and file format
 * may change in future versions.
 */
export default function AgentEditor({ initialContent, onContentChange }: AgentEditorProps) {
  return (
    <AgentEditorProvider>
      <AgentEditorInner
        initialContent={initialContent}
        onContentChange={onContentChange}
      />
    </AgentEditorProvider>
  );
}
