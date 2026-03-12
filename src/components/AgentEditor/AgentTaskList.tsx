'use client';

/**
 * AgentTaskList Component
 *
 * EXPERIMENTAL: Displays current agent tasks with real-time status updates.
 * Similar to Claude Code's todo list functionality.
 *
 * Design principles:
 * - Clear visual distinction between task states
 * - Compact but readable list items
 * - Smooth transitions for status changes
 */

import { useCallback } from 'react';
import { useAgentEditor } from '@/context/AgentEditorContext';
import type { AgentTask, AgentTaskStatus } from '@/types/agent';

// ============================================
// Task Status Icon Component
// ============================================

interface TaskStatusIconProps {
  status: AgentTaskStatus;
}

function TaskStatusIcon({ status }: TaskStatusIconProps) {
  switch (status) {
    case 'pending':
      return (
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            border: '2px solid var(--border-primary)',
            background: 'var(--bg-primary)',
          }}
        />
      );

    case 'in_progress':
      return (
        <div
          style={{
            width: '18px',
            height: '18px',
            position: 'relative',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: 'spin 1.2s linear infinite',
            }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      );

    case 'completed':
      return (
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: 'var(--status-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      );

    case 'failed':
      return (
        <div
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: 'var(--status-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      );

    default:
      return null;
  }
}

// ============================================
// Single Task Item Component
// ============================================

interface TaskItemProps {
  task: AgentTask;
  onDelete: (id: string) => void;
}

function TaskItem({ task, onDelete }: TaskItemProps) {
  const isActive = task.status === 'in_progress';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '10px',
        background: isActive ? 'var(--accent-subtle)' : 'transparent',
        border: isActive ? '1px solid rgba(var(--accent-rgb), 0.2)' : '1px solid transparent',
        transition: 'all 0.2s ease',
        marginBottom: '4px',
      }}
    >
      {/* Status icon */}
      <div style={{ flexShrink: 0, paddingTop: '1px' }}>
        <TaskStatusIcon status={task.status} />
      </div>

      {/* Task content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            color: isCompleted || isFailed ? 'var(--text-tertiary)' : 'var(--text-primary)',
            textDecoration: isCompleted ? 'line-through' : 'none',
            lineHeight: 1.5,
            wordBreak: 'break-word',
            fontWeight: isActive ? 500 : 400,
          }}
        >
          {isActive ? task.activeForm : task.content}
        </div>

        {/* Error message */}
        {task.error && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--status-error)',
              marginTop: '6px',
              padding: '6px 10px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '6px',
              lineHeight: 1.4,
            }}
          >
            {task.error}
          </div>
        )}
      </div>

      {/* Delete button (only show for completed/failed) */}
      {(isCompleted || isFailed) && (
        <button
          onClick={() => onDelete(task.id)}
          style={{
            padding: '4px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            opacity: 0.5,
            transition: 'opacity 0.15s ease, color 0.15s ease, background 0.15s ease',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'var(--bg-tertiary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.5';
            e.currentTarget.style.color = 'var(--text-tertiary)';
            e.currentTarget.style.background = 'transparent';
          }}
          title="Remove task"
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
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
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
        No tasks yet
      </div>
      <div style={{ fontSize: '12px', marginTop: '4px' }}>
        Tasks will appear here as Claude works
      </div>
    </div>
  );
}

// ============================================
// Main AgentTaskList Component
// ============================================

export default function AgentTaskList() {
  const { state, deleteTask, clearCompletedTasks } = useAgentEditor();

  const handleDeleteTask = useCallback(
    (id: string) => {
      deleteTask(id);
    },
    [deleteTask]
  );

  const handleClearCompleted = useCallback(() => {
    clearCompletedTasks();
  }, [clearCompletedTasks]);

  const { tasks } = state.document;

  // Separate active and completed tasks
  const activeTasks = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  );
  const completedTasks = tasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed'
  );

  const hasCompletedTasks = completedTasks.length > 0;

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
            Tasks
          </span>
          {activeTasks.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                background: 'var(--bg-tertiary)',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 500,
              }}
            >
              {activeTasks.length} active
            </span>
          )}
        </div>

        {/* Clear completed button */}
        {hasCompletedTasks && (
          <button
            onClick={handleClearCompleted}
            style={{
              fontSize: '11px',
              color: 'var(--text-tertiary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'color 0.15s ease, background 0.15s ease',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-tertiary)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Clear completed
          </button>
        )}
      </div>

      {/* Task list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px',
        }}
      >
        {tasks.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Active tasks */}
            {activeTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onDelete={handleDeleteTask}
              />
            ))}

            {/* Divider if both active and completed tasks exist */}
            {activeTasks.length > 0 && completedTasks.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  margin: '12px 16px',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: 'var(--border-primary)',
                  }}
                />
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: 500,
                  }}
                >
                  Completed
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: 'var(--border-primary)',
                  }}
                />
              </div>
            )}

            {/* Completed tasks */}
            {completedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onDelete={handleDeleteTask}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
