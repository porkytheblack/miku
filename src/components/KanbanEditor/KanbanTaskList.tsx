'use client';

import { useState, useRef, useEffect } from 'react';
import type { KanbanTask, TaskState } from '@/types';

interface KanbanTaskListProps {
  tasks: KanbanTask[];
  onAddTask: (text: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<Omit<KanbanTask, 'id'>>) => void;
  onDeleteTask: (taskId: string) => void;
  onCycleTaskState: (taskId: string) => void;
}

/**
 * Task state indicator component
 * Shows visual representation of todo, in-progress, or done
 */
function TaskStateIndicator({
  state,
  onClick,
}: {
  state: TaskState;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${state} - click to change`}
      style={{
        width: '18px',
        height: '18px',
        borderRadius: 'var(--radius-sm)',
        border: state === 'done' ? 'none' : '2px solid var(--border-default)',
        background: state === 'done' ? 'var(--accent-primary)' : 'transparent',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all var(--duration-fast) var(--easing-default)',
      }}
    >
      {state === 'todo' && null}
      {state === 'in-progress' && (
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '2px',
            background: 'var(--accent-primary)',
          }}
        />
      )}
      {state === 'done' && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 6l3 3 5-6" />
        </svg>
      )}
    </button>
  );
}

/**
 * Single task item component
 */
function TaskItem({
  task,
  onUpdate,
  onDelete,
  onCycleState,
}: {
  task: KanbanTask;
  onUpdate: (updates: Partial<Omit<KanbanTask, 'id'>>) => void;
  onDelete: () => void;
  onCycleState: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== task.text) {
      onUpdate({ text: trimmed });
    }
    setEditText(task.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(task.text);
      setIsEditing(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '6px 0',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <TaskStateIndicator state={task.state} onClick={onCycleState} />

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            fontSize: 'var(--text-sm)',
            padding: '2px 4px',
            border: '1px solid var(--border-focus)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          style={{
            flex: 1,
            fontSize: 'var(--text-sm)',
            color: task.state === 'done' ? 'var(--text-tertiary)' : 'var(--text-primary)',
            textDecoration: task.state === 'done' ? 'line-through' : 'none',
            cursor: 'text',
            wordBreak: 'break-word',
          }}
        >
          {task.text}
        </span>
      )}

      <button
        type="button"
        onClick={onDelete}
        title="Delete task"
        style={{
          padding: '2px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          opacity: 0.5,
          transition: 'opacity var(--duration-fast) var(--easing-default)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.color = 'var(--highlight-grammar)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.5';
          e.currentTarget.style.color = 'var(--text-tertiary)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Task list component for card modal
 * Displays tasks with three-state checkboxes and allows adding new tasks
 */
export default function KanbanTaskList({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onCycleTaskState,
}: KanbanTaskListProps) {
  const [newTaskText, setNewTaskText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddTask = () => {
    const trimmed = newTaskText.trim();
    if (trimmed) {
      onAddTask(trimmed);
      setNewTaskText('');
      // Keep focus on input for adding multiple tasks
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    }
  };

  // Calculate progress
  const doneCount = tasks.filter((t) => t.state === 'done').length;
  const totalCount = tasks.length;

  return (
    <div>
      {/* Progress indicator */}
      {totalCount > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '4px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(doneCount / totalCount) * 100}%`,
                background: 'var(--accent-primary)',
                transition: 'width var(--duration-normal) var(--easing-default)',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
            }}
          >
            {doneCount}/{totalCount}
          </span>
        </div>
      )}

      {/* Task list */}
      <div style={{ marginBottom: '12px' }}>
        {tasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onUpdate={(updates) => onUpdateTask(task.id, updates)}
            onDelete={() => onDeleteTask(task.id)}
            onCycleState={() => onCycleTaskState(task.id)}
          />
        ))}
      </div>

      {/* Add task input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Add a task..."
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={tasks.length >= 20}
          style={{
            flex: 1,
            fontSize: 'var(--text-sm)',
            padding: '8px 12px',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-focus)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
          }}
        />
        <button
          type="button"
          onClick={handleAddTask}
          disabled={!newTaskText.trim() || tasks.length >= 20}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: newTaskText.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            color: newTaskText.trim() ? 'white' : 'var(--text-tertiary)',
            border: 'none',
            cursor: newTaskText.trim() ? 'pointer' : 'not-allowed',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            transition: 'opacity var(--duration-fast) var(--easing-default)',
          }}
          onMouseEnter={(e) => {
            if (newTaskText.trim()) {
              e.currentTarget.style.opacity = '0.9';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          Add
        </button>
      </div>

      {tasks.length >= 20 && (
        <p
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            marginTop: '8px',
          }}
        >
          Maximum 20 tasks per card
        </p>
      )}
    </div>
  );
}
