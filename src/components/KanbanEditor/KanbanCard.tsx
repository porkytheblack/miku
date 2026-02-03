'use client';

import { useRef, useEffect } from 'react';
import type { KanbanCard as KanbanCardType } from '@/types';
import { KANBAN_COLORS } from './KanbanColorPicker';

interface KanbanCardProps {
  card: KanbanCardType;
  columnId: string;
  onClick: () => void;
  onDelete: () => void;
  isDragging?: boolean;
  onMouseDragStart?: (cardId: string, columnId: string, element: HTMLElement, clientX: number, clientY: number) => void;
  registerCard?: (cardId: string, element: HTMLElement | null) => void;
}

/**
 * Individual card component displayed in a column
 * Shows title, description preview, task progress, and color bar
 *
 * Uses mouse events for drag initiation instead of HTML5 Drag and Drop API
 * because WKWebView in Tauri on macOS does not reliably support HTML5 DnD.
 */
export default function KanbanCard({
  card,
  columnId,
  onClick,
  onDelete,
  isDragging = false,
  onMouseDragStart,
  registerCard,
}: KanbanCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Register card element for drop position calculation
  useEffect(() => {
    if (registerCard && cardRef.current) {
      registerCard(card.id, cardRef.current);
      return () => registerCard(card.id, null);
    }
  }, [card.id, registerCard]);

  // Calculate task progress
  const totalTasks = card.tasks.length;
  const doneTasks = card.tasks.filter((t) => t.state === 'done').length;
  const hasProgress = totalTasks > 0;

  // Get color bar color
  const colorBarColor = card.color ? KANBAN_COLORS[card.color] : 'transparent';

  /**
   * Handle mouse down to potentially start a drag operation.
   * We use a threshold to distinguish between clicks and drags.
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left mouse button
    if (e.button !== 0) return;

    // Ignore if clicking on the delete button or other interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;

    // Store the initial mouse position to detect drag intent
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartPos.current) return;

      // Calculate distance moved
      const dx = moveEvent.clientX - dragStartPos.current.x;
      const dy = moveEvent.clientY - dragStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Start drag if moved more than 5 pixels (threshold to distinguish from click)
      if (distance > 5 && !isDraggingRef.current && cardRef.current && onMouseDragStart) {
        isDraggingRef.current = true;
        onMouseDragStart(card.id, columnId, cardRef.current, moveEvent.clientX, moveEvent.clientY);

        // Clean up these handlers since the drag system takes over
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }
    };

    const handleMouseUp = () => {
      // If we didn't start dragging, this was a click
      if (!isDraggingRef.current && dragStartPos.current) {
        // Allow the click handler to fire naturally
      }

      dragStartPos.current = null;
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      ref={cardRef}
      data-card-id={card.id}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        boxShadow: isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        transition: isDragging
          ? 'none'
          : 'box-shadow var(--duration-fast) var(--easing-default), opacity var(--duration-fast) var(--easing-default)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }
      }}
    >
      {/* Color bar */}
      {card.color && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: '4px',
            background: colorBarColor,
          }}
        />
      )}

      {/* Card content */}
      <div style={{ padding: '12px', paddingLeft: card.color ? '16px' : '12px' }}>
        {/* Title */}
        <div
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
            marginBottom: card.description || hasProgress ? '8px' : 0,
          }}
        >
          {card.title}
        </div>

        {/* Description preview */}
        {card.description && (
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              marginBottom: hasProgress ? '8px' : 0,
            }}
          >
            {card.description}
          </div>
        )}

        {/* Task progress */}
        {hasProgress && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                color: doneTasks === totalTasks ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              }}
            >
              {doneTasks}/{totalTasks}
            </span>
          </div>
        )}
      </div>

      {/* Delete button - shown on hover */}
      <button
        onClick={handleDeleteClick}
        title="Delete card"
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          padding: '4px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          opacity: 0,
          transition: 'opacity var(--duration-fast) var(--easing-default), color var(--duration-fast) var(--easing-default)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--highlight-grammar)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)';
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Style to show delete button on card hover */}
      <style jsx>{`
        div:hover button {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
