'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KanbanEditorProvider, useKanbanEditor } from '@/context/KanbanEditorContext';
import { useDocument } from '@/context/DocumentContext';
import KanbanToolbar from './KanbanToolbar';
import KanbanColumn from './KanbanColumn';
import KanbanCardModal from './KanbanCardModal';
import KanbanEmptyState from './KanbanEmptyState';
import { useDragAndDrop, getDragOverlayStyle } from './useDragAndDrop';
import { KANBAN_COLORS } from './KanbanColorPicker';

interface KanbanEditorInnerProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Drag overlay component that renders the card being dragged
 * Uses a portal to render above all other content
 */
function DragOverlay({
  cardId,
  columns,
  currentPosition,
  initialRect,
  offsetX,
  offsetY,
}: {
  cardId: string;
  columns: { id: string; cards: { id: string; title: string; description?: string; color?: string | null; tasks: { state: string }[] }[] }[];
  currentPosition: { x: number; y: number } | null;
  initialRect: DOMRect | null;
  offsetX: number;
  offsetY: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || !currentPosition || !initialRect) {
    return null;
  }

  // Find the card being dragged
  let card: { id: string; title: string; description?: string; color?: string | null; tasks: { state: string }[] } | null = null;
  for (const column of columns) {
    const found = column.cards.find(c => c.id === cardId);
    if (found) {
      card = found;
      break;
    }
  }

  if (!card) {
    return null;
  }

  const totalTasks = card.tasks.length;
  const doneTasks = card.tasks.filter((t) => t.state === 'done').length;
  const hasProgress = totalTasks > 0;
  const colorBarColor = card.color ? KANBAN_COLORS[card.color as keyof typeof KANBAN_COLORS] : 'transparent';

  const overlayContent = (
    <div
      style={{
        position: 'fixed',
        left: currentPosition.x - offsetX,
        top: currentPosition.y - offsetY,
        width: initialRect.width,
        pointerEvents: 'none',
        zIndex: 10000,
        transform: 'rotate(2deg) scale(1.02)',
        opacity: 0.95,
      }}
    >
      <div
        style={{
          position: 'relative',
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: '2px solid var(--accent-primary)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--accent-primary)',
          overflow: 'hidden',
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
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
}

/**
 * Inner component that uses the KanbanEditor context
 */
function KanbanEditorInner({ initialContent, onContentChange }: KanbanEditorInnerProps) {
  const {
    state,
    loadContent,
    getContent,
    addColumn,
    updateColumn,
    deleteColumn,
    moveColumn,
    addCard,
    updateCard,
    deleteCard,
    moveCard,
    addTask,
    updateTask,
    deleteTask,
    cycleTaskState,
    setEditingCard,
    getCardById,
    getTotalCardCount,
  } = useKanbanEditor();

  const { registerContentGetter, setOriginalContent } = useDocument();

  // Track the serialized form of the initial content
  const baselineContentRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize the mouse-based drag and drop system
  const {
    isDragging,
    draggedCard,
    currentPosition,
    dropTarget,
    startDrag,
    registerColumn,
    registerCard,
  } = useDragAndDrop(moveCard);

  // Register content getter so DocumentContext can retrieve current content
  useEffect(() => {
    registerContentGetter(getContent);
  }, [registerContentGetter, getContent]);

  // Load initial content - only on mount
  useEffect(() => {
    if (initialContent !== undefined) {
      loadContent(initialContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture baseline content after the loaded state has been rendered
  useEffect(() => {
    if (state.hasLoaded && baselineContentRef.current === null) {
      const baseline = getContent();
      baselineContentRef.current = baseline;
      setOriginalContent(baseline);
      setTimeout(() => setIsInitialized(true), 0);
    }
  }, [state.hasLoaded, getContent, setOriginalContent]);

  // Notify parent of content changes
  // Only trigger when columns actually change (not the whole document object)
  useEffect(() => {
    if (!onContentChange) return;
    if (!isInitialized) return;
    if (baselineContentRef.current === null) return;

    const currentContent = getContent();
    onContentChange(currentContent);
  }, [state.document.columns, getContent, onContentChange, isInitialized]);

  // Handle adding a new column
  const handleAddColumn = useCallback(() => {
    const columnNumber = state.document.columns.length + 1;
    addColumn(`Column ${columnNumber}`);
  }, [addColumn, state.document.columns.length]);

  // Handle adding a card to the first column (for empty state)
  const handleAddFirstCard = useCallback(() => {
    if (state.document.columns.length > 0) {
      addCard(state.document.columns[0].id);
    }
  }, [addCard, state.document.columns]);

  // Get the card being edited
  const editingCard = state.editingCardId ? getCardById(state.editingCardId) : null;

  // Check if board is empty (no cards in any column)
  const totalCards = getTotalCardCount();
  const isEmpty = totalCards === 0;

  // Get the currently dragged card ID for passing to columns
  const draggingCardId = isDragging && draggedCard ? draggedCard.cardId : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
      }}
    >
      <KanbanToolbar
        boardName={state.document.metadata.name}
        totalCards={totalCards}
        columnCount={state.document.columns.length}
        onAddColumn={handleAddColumn}
      />

      {isEmpty ? (
        <KanbanEmptyState onAddCard={handleAddFirstCard} />
      ) : (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'var(--spacing-4)',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-4)',
              height: '100%',
              minWidth: 'min-content',
            }}
          >
            {state.document.columns.map((column, index) => (
              <KanbanColumn
                key={column.id}
                column={column}
                onUpdateTitle={(title) => updateColumn(column.id, title)}
                onDelete={() => deleteColumn(column.id)}
                onMoveColumn={(direction) => moveColumn(column.id, direction)}
                onAddCard={() => addCard(column.id)}
                onCardClick={(cardId) => setEditingCard(cardId)}
                onDeleteCard={(cardId) => deleteCard(cardId)}
                draggingCardId={draggingCardId}
                dropTarget={dropTarget}
                onMouseDragStart={startDrag}
                registerColumn={registerColumn}
                registerCard={registerCard}
                isFirstColumn={index === 0}
                isLastColumn={index === state.document.columns.length - 1}
                isOnlyColumn={state.document.columns.length === 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Drag overlay - renders the card being dragged */}
      {isDragging && draggedCard && (
        <DragOverlay
          cardId={draggedCard.cardId}
          columns={state.document.columns}
          currentPosition={currentPosition}
          initialRect={draggedCard.initialRect}
          offsetX={draggedCard.offsetX}
          offsetY={draggedCard.offsetY}
        />
      )}

      {/* Card edit modal */}
      <KanbanCardModal
        card={editingCard}
        isOpen={!!editingCard}
        onClose={() => setEditingCard(null)}
        onSave={(updates) => {
          if (state.editingCardId) {
            updateCard(state.editingCardId, updates);
          }
        }}
        onDelete={() => {
          if (state.editingCardId) {
            deleteCard(state.editingCardId);
          }
        }}
        onAddTask={(text) => {
          if (state.editingCardId) {
            addTask(state.editingCardId, text);
          }
        }}
        onUpdateTask={(taskId, updates) => {
          if (state.editingCardId) {
            updateTask(state.editingCardId, taskId, updates);
          }
        }}
        onDeleteTask={(taskId) => {
          if (state.editingCardId) {
            deleteTask(state.editingCardId, taskId);
          }
        }}
        onCycleTaskState={(taskId) => {
          if (state.editingCardId) {
            cycleTaskState(state.editingCardId, taskId);
          }
        }}
      />
    </div>
  );
}

interface KanbanEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Kanban board editor component
 * Provides a visual kanban board interface for .kanban files
 *
 * Uses a custom mouse-event-based drag and drop system instead of
 * HTML5 Drag and Drop API for compatibility with Tauri's WKWebView on macOS.
 */
export default function KanbanEditor({ initialContent, onContentChange }: KanbanEditorProps) {
  return (
    <KanbanEditorProvider>
      <KanbanEditorInner
        initialContent={initialContent}
        onContentChange={onContentChange}
      />
    </KanbanEditorProvider>
  );
}
