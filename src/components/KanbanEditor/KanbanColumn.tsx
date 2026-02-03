'use client';

import { useState, useRef, useEffect } from 'react';
import type { KanbanColumn as KanbanColumnType } from '@/types';
import KanbanCard from './KanbanCard';
import type { DropTarget } from './useDragAndDrop';

interface KanbanColumnProps {
  column: KanbanColumnType;
  onUpdateTitle: (title: string) => void;
  onDelete: () => void;
  onMoveColumn: (direction: 'left' | 'right') => void;
  onAddCard: () => void;
  onCardClick: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  draggingCardId: string | null;
  dropTarget: DropTarget | null;
  onMouseDragStart: (cardId: string, columnId: string, element: HTMLElement, clientX: number, clientY: number) => void;
  registerColumn: (columnId: string, element: HTMLElement | null) => void;
  registerCard: (cardId: string, element: HTMLElement | null) => void;
  isFirstColumn: boolean;
  isLastColumn: boolean;
  isOnlyColumn: boolean;
}

/**
 * Single column in the kanban board
 * Contains a header with editable title, cards list, and add card button
 *
 * Uses mouse-based drag and drop for Tauri WKWebView compatibility.
 */
export default function KanbanColumn({
  column,
  onUpdateTitle,
  onDelete,
  onMoveColumn,
  onAddCard,
  onCardClick,
  onDeleteCard,
  draggingCardId,
  dropTarget,
  onMouseDragStart,
  registerColumn,
  registerCard,
  isFirstColumn,
  isLastColumn,
  isOnlyColumn,
}: KanbanColumnProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [showMenu, setShowMenu] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  // Register this column for drop target detection
  useEffect(() => {
    if (columnRef.current) {
      registerColumn(column.id, columnRef.current);
      return () => registerColumn(column.id, null);
    }
  }, [column.id, registerColumn]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleTitleSave = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== column.title) {
      onUpdateTitle(trimmed);
    }
    setEditTitle(column.title);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditTitle(column.title);
      setIsEditingTitle(false);
    }
  };

  // Check if this column is the drop target
  const isDropTarget = dropTarget?.columnId === column.id;
  const dropInsertIndex = isDropTarget ? dropTarget.insertIndex : null;

  return (
    <div
      ref={columnRef}
      style={{
        width: '280px',
        minWidth: '280px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: isDropTarget && draggingCardId
          ? '2px solid var(--accent-primary)'
          : '1px solid var(--border-default)',
        transition: 'border-color var(--duration-fast) var(--easing-default)',
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            maxLength={50}
            style={{
              flex: 1,
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              padding: '4px 8px',
              border: '1px solid var(--border-focus)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => setIsEditingTitle(true)}
            style={{
              flex: 1,
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              cursor: 'text',
              padding: '4px 0',
            }}
          >
            {column.title}
          </span>
        )}

        {/* Card count badge */}
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-tertiary)',
            background: 'var(--bg-tertiary)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          {column.cards.length}
        </span>

        {/* Column menu */}
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              padding: '4px',
              background: showMenu ? 'var(--bg-tertiary)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="6" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="18" r="2" />
            </svg>
          </button>

          {showMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                width: '160px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 10,
                padding: '4px 0',
              }}
            >
              <button
                onClick={() => {
                  setIsEditingTitle(true);
                  setShowMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
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
                Rename
              </button>

              {!isFirstColumn && (
                <button
                  onClick={() => {
                    onMoveColumn('left');
                    setShowMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
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
                  Move Left
                </button>
              )}

              {!isLastColumn && (
                <button
                  onClick={() => {
                    onMoveColumn('right');
                    setShowMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
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
                  Move Right
                </button>
              )}

              {!isOnlyColumn && (
                <>
                  <div
                    style={{
                      height: '1px',
                      background: 'var(--border-default)',
                      margin: '4px 0',
                    }}
                  />
                  <button
                    onClick={() => {
                      if (column.cards.length > 0) {
                        if (!confirm(`Delete column "${column.title}" and all ${column.cards.length} cards?`)) {
                          setShowMenu(false);
                          return;
                        }
                      }
                      onDelete();
                      setShowMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--highlight-grammar)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
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
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cards container */}
      <div
        data-cards-container="true"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minHeight: '100px',
          // Visual feedback when this is the drop target
          background: isDropTarget && draggingCardId ? 'var(--bg-tertiary)' : 'transparent',
          transition: 'background var(--duration-fast) var(--easing-default)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {column.cards.map((card, index) => (
          <div key={card.id}>
            {/* Drop indicator before this card */}
            {dropInsertIndex === index && draggingCardId && draggingCardId !== card.id && (
              <div
                style={{
                  height: '4px',
                  background: 'var(--accent-primary)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '8px',
                  boxShadow: '0 0 8px var(--accent-primary)',
                }}
              />
            )}
            <KanbanCard
              card={card}
              columnId={column.id}
              onClick={() => onCardClick(card.id)}
              onDelete={() => onDeleteCard(card.id)}
              isDragging={draggingCardId === card.id}
              onMouseDragStart={onMouseDragStart}
              registerCard={registerCard}
            />
          </div>
        ))}

        {/* Drop indicator at end of column */}
        {dropInsertIndex === column.cards.length && draggingCardId && (
          <div
            style={{
              height: '4px',
              background: 'var(--accent-primary)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 0 8px var(--accent-primary)',
            }}
          />
        )}

        {/* Empty column drop zone indicator */}
        {column.cards.length === 0 && draggingCardId && isDropTarget && (
          <div
            style={{
              height: '60px',
              border: '2px dashed var(--accent-primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Drop here
          </div>
        )}
      </div>

      {/* Add card button */}
      <div
        style={{
          padding: '8px',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        <button
          onClick={onAddCard}
          disabled={column.cards.length >= 100}
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-default)',
            background: 'transparent',
            cursor: column.cards.length >= 100 ? 'not-allowed' : 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background var(--duration-fast) var(--easing-default), color var(--duration-fast) var(--easing-default)',
          }}
          onMouseEnter={(e) => {
            if (column.cards.length < 100) {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Card
        </button>
      </div>
    </div>
  );
}
