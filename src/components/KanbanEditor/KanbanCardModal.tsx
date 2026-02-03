'use client';

import { useState, useEffect } from 'react';
import type { KanbanCard, KanbanCardColor } from '@/types';
import Modal, { ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import KanbanColorPicker from './KanbanColorPicker';
import KanbanTaskList from './KanbanTaskList';

interface KanbanCardModalProps {
  card: KanbanCard | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Omit<KanbanCard, 'id' | 'createdAt'>>) => void;
  onDelete: () => void;
  onAddTask: (text: string) => void;
  onUpdateTask: (taskId: string, updates: { text?: string; state?: KanbanCard['tasks'][0]['state'] }) => void;
  onDeleteTask: (taskId: string) => void;
  onCycleTaskState: (taskId: string) => void;
}

/**
 * Modal for editing a card's full details
 * Includes title, description, color, and task list
 */
export default function KanbanCardModal({
  card,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onCycleTaskState,
}: KanbanCardModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<KanbanCardColor | undefined>(undefined);

  // Sync local state with card prop when card changes or modal opens
  useEffect(() => {
    if (card && isOpen) {
      setTitle(card.title);
      setDescription(card.description || '');
      setColor(card.color);
    }
  }, [card, isOpen]);

  if (!card) return null;

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      // Don't allow empty title
      return;
    }

    onSave({
      title: trimmedTitle,
      description: description.trim() || undefined,
      color,
    });
    onClose();
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this card?')) {
      onDelete();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="560px">
      <div onKeyDown={handleKeyDown}>
        <ModalHeader>Edit Card</ModalHeader>

        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Title */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}
              >
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Card title"
                maxLength={200}
                style={{
                  width: '100%',
                  fontSize: 'var(--text-sm)',
                  padding: '10px 12px',
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
            </div>

            {/* Description */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '6px',
                }}
              >
                Description
                <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}> (optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                maxLength={2000}
                rows={4}
                style={{
                  width: '100%',
                  fontSize: 'var(--text-sm)',
                  padding: '10px 12px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '80px',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-focus)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }}
              />
            </div>

            {/* Color */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}
              >
                Color
              </label>
              <KanbanColorPicker value={color} onChange={setColor} />
            </div>

            {/* Tasks */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}
              >
                Tasks
              </label>
              <KanbanTaskList
                tasks={card.tasks}
                onAddTask={onAddTask}
                onUpdateTask={onUpdateTask}
                onDeleteTask={onDeleteTask}
                onCycleTaskState={onCycleTaskState}
              />
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <button
            onClick={handleDelete}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'var(--highlight-grammar)',
              border: '1px solid var(--highlight-grammar)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              marginRight: 'auto',
              transition: 'background var(--duration-fast) var(--easing-default)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Delete
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              transition: 'background var(--duration-fast) var(--easing-default)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!title.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: title.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: title.trim() ? 'white' : 'var(--text-tertiary)',
              border: 'none',
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              transition: 'opacity var(--duration-fast) var(--easing-default)',
            }}
            onMouseEnter={(e) => {
              if (title.trim()) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Save
          </button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
