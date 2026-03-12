'use client';

/**
 * AgentApprovalPanel Component
 *
 * EXPERIMENTAL: Displays pending approval requests from the agent.
 * Shows file edits, commands, and other actions requiring user approval
 * before the agent can proceed.
 *
 * Design principles:
 * - Clear, prominent action buttons for approve/reject
 * - Good visual context for what's being approved
 * - Code diffs shown with syntax highlighting
 */

import { useCallback } from 'react';
import { useAgentEditor } from '@/context/AgentEditorContext';
import type { AgentApprovalRequest, AgentApprovalType } from '@/types/agent';
import { getApprovalTypeLabel } from '@/types/agent';

// ============================================
// Approval Type Icon Component
// ============================================

interface ApprovalTypeIconProps {
  type: AgentApprovalType;
}

function ApprovalTypeIcon({ type }: ApprovalTypeIconProps) {
  const iconStyle = {
    width: '18px',
    height: '18px',
    flexShrink: 0,
  };

  switch (type) {
    case 'file_edit':
      return (
        <svg
          style={iconStyle}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--status-warning)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );

    case 'file_create':
      return (
        <svg
          style={iconStyle}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--status-success)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
      );

    case 'file_delete':
      return (
        <svg
          style={iconStyle}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--status-error)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      );

    case 'command':
      return (
        <svg
          style={iconStyle}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );

    case 'web_fetch':
      return (
        <svg
          style={iconStyle}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
      );

    case 'other':
    default:
      return (
        <svg
          style={iconStyle}
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-tertiary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

// ============================================
// Diff Preview Component
// ============================================

interface DiffPreviewProps {
  diff: string;
}

function DiffPreview({ diff }: DiffPreviewProps) {
  const lines = diff.split('\n').slice(0, 20); // Limit preview to 20 lines
  const hasMore = diff.split('\n').length > 20;

  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        borderRadius: '8px',
        padding: '8px 0',
        marginTop: '10px',
        overflow: 'auto',
        maxHeight: '200px',
        fontSize: '11px',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.6,
        border: '1px solid var(--border-primary)',
      }}
    >
      {lines.map((line, index) => {
        let color = 'var(--text-secondary)';
        let background = 'transparent';
        let borderLeft = '3px solid transparent';

        if (line.startsWith('+') && !line.startsWith('+++')) {
          color = 'var(--status-success)';
          background = 'rgba(34, 197, 94, 0.08)';
          borderLeft = '3px solid var(--status-success)';
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          color = 'var(--status-error)';
          background = 'rgba(239, 68, 68, 0.08)';
          borderLeft = '3px solid var(--status-error)';
        } else if (line.startsWith('@@')) {
          color = 'var(--accent-primary)';
          background = 'rgba(var(--accent-rgb), 0.05)';
        }

        return (
          <div
            key={index}
            style={{
              color,
              background,
              padding: '1px 12px 1px 8px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              borderLeft,
            }}
          >
            {line || '\u00A0'}
          </div>
        );
      })}
      {hasMore && (
        <div
          style={{
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
            padding: '8px 12px 4px',
            fontSize: '10px',
          }}
        >
          ... {diff.split('\n').length - 20} more lines
        </div>
      )}
    </div>
  );
}

// ============================================
// Single Approval Card Component
// ============================================

interface ApprovalCardProps {
  approval: AgentApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
}

function ApprovalCard({ approval, onApprove, onReject }: ApprovalCardProps) {
  const { type, description, details } = approval;

  return (
    <div
      style={{
        padding: '16px',
        borderRadius: '12px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-primary)',
        marginBottom: '10px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ApprovalTypeIcon type={type} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
              fontWeight: 500,
            }}
          >
            {getApprovalTypeLabel(type)}
          </div>
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              wordBreak: 'break-word',
              fontWeight: 500,
            }}
          >
            {description}
          </div>
        </div>
      </div>

      {/* Details */}
      {details.filePath && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            marginBottom: '10px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {details.filePath}
        </div>
      )}

      {details.command && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            padding: '10px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            marginBottom: '10px',
            overflow: 'auto',
            maxHeight: '100px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            border: '1px solid var(--border-primary)',
          }}
        >
          <span style={{ color: 'var(--accent-primary)', marginRight: '8px' }}>$</span>
          {details.command}
        </div>
      )}

      {details.url && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--accent-primary)',
            fontFamily: 'var(--font-mono)',
            padding: '8px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
            marginBottom: '10px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {details.url}
        </div>
      )}

      {details.diff && <DiffPreview diff={details.diff} />}

      {details.context && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            marginTop: '10px',
            lineHeight: 1.5,
            padding: '10px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '8px',
          }}
        >
          {details.context}
        </div>
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginTop: '16px',
        }}
      >
        <button
          onClick={onReject}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.borderColor = 'var(--text-tertiary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-secondary)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.borderColor = 'var(--border-primary)';
          }}
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--accent-primary)',
            color: 'white',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.25)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Approve
        </button>
      </div>
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================

function EmptyState() {
  return (
    <div
      style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: 'var(--text-tertiary)',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
        No pending approvals
      </div>
      <div style={{ fontSize: '12px', marginTop: '4px' }}>
        Requests will appear here when Claude needs permission
      </div>
    </div>
  );
}

// ============================================
// Main AgentApprovalPanel Component
// ============================================

export default function AgentApprovalPanel() {
  const { state, respondToPermission, isClaudeConnected } = useAgentEditor();
  const isConnected = isClaudeConnected();

  const handleApprove = useCallback(
    async (id: string) => {
      try {
        // If connected to Claude, send the permission response
        if (isConnected) {
          await respondToPermission(id, true);
        }
      } catch (error) {
        console.error('[AgentApprovalPanel] Error approving request:', error);
      }
    },
    [respondToPermission, isConnected]
  );

  const handleReject = useCallback(
    async (id: string) => {
      try {
        // If connected to Claude, send the permission response
        if (isConnected) {
          await respondToPermission(id, false);
        }
      } catch (error) {
        console.error('[AgentApprovalPanel] Error rejecting request:', error);
      }
    },
    [respondToPermission, isConnected]
  );

  const { pendingApprovals } = state.document;

  // Filter to only show pending approvals
  const pending = pendingApprovals.filter((a) => a.status === 'pending');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Approvals
          </span>
          {pending.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                color: 'white',
                background: 'var(--status-warning)',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 600,
              }}
            >
              {pending.length} pending
            </span>
          )}
        </div>
      </div>

      {/* Approval list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '10px',
        }}
      >
        {pending.length === 0 ? (
          <EmptyState />
        ) : (
          pending.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={() => handleApprove(approval.id)}
              onReject={() => handleReject(approval.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
