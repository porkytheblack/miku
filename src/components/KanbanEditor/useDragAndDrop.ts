'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Represents a card being dragged in the kanban board
 */
export interface DraggedCard {
  cardId: string;
  columnId: string;
  element: HTMLElement;
  initialRect: DOMRect;
  offsetX: number;
  offsetY: number;
}

/**
 * Represents a drop target position in the kanban board
 */
export interface DropTarget {
  columnId: string;
  insertIndex: number;
}

/**
 * Global state for drag operations across the kanban board.
 * Uses mouse events instead of HTML5 Drag and Drop API for
 * compatibility with Tauri's WKWebView on macOS.
 */
interface DragState {
  isDragging: boolean;
  draggedCard: DraggedCard | null;
  currentPosition: { x: number; y: number } | null;
  dropTarget: DropTarget | null;
}

/**
 * Custom hook for managing kanban card drag-and-drop operations.
 *
 * This implementation uses mouse events (mousedown, mousemove, mouseup)
 * instead of the HTML5 Drag and Drop API because WKWebView in Tauri
 * on macOS does not reliably support HTML5 drag and drop.
 *
 * @param onMoveCard - Callback to execute when a card is dropped
 */
export function useDragAndDrop(
  onMoveCard: (cardId: string, fromColumnId: string, toColumnId: string, toIndex: number) => void
) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedCard: null,
    currentPosition: null,
    dropTarget: null,
  });

  // Track column elements for drop target detection
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Track card elements within columns for precise drop positioning
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

  /**
   * Register a column element for drop target detection
   */
  const registerColumn = useCallback((columnId: string, element: HTMLElement | null) => {
    if (element) {
      columnRefs.current.set(columnId, element);
    } else {
      columnRefs.current.delete(columnId);
    }
  }, []);

  /**
   * Register a card element for drop position calculation
   */
  const registerCard = useCallback((cardId: string, element: HTMLElement | null) => {
    if (element) {
      cardRefs.current.set(cardId, element);
    } else {
      cardRefs.current.delete(cardId);
    }
  }, []);

  /**
   * Start dragging a card
   */
  const startDrag = useCallback((
    cardId: string,
    columnId: string,
    element: HTMLElement,
    clientX: number,
    clientY: number
  ) => {
    const rect = element.getBoundingClientRect();

    setDragState({
      isDragging: true,
      draggedCard: {
        cardId,
        columnId,
        element,
        initialRect: rect,
        offsetX: clientX - rect.left,
        offsetY: clientY - rect.top,
      },
      currentPosition: { x: clientX, y: clientY },
      dropTarget: null,
    });
  }, []);

  /**
   * Find the drop target column and position based on current mouse coordinates
   */
  const findDropTarget = useCallback((clientX: number, clientY: number, draggedCardId: string): DropTarget | null => {
    // Find which column the mouse is over
    let targetColumn: { id: string; element: HTMLElement } | null = null;

    for (const [columnId, element] of columnRefs.current.entries()) {
      const rect = element.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top && clientY <= rect.bottom) {
        targetColumn = { id: columnId, element };
        break;
      }
    }

    if (!targetColumn) {
      return null;
    }

    // Find the insert position within the column
    const cardsContainer = targetColumn.element.querySelector('[data-cards-container]');
    if (!cardsContainer) {
      return { columnId: targetColumn.id, insertIndex: 0 };
    }

    const cardElements = cardsContainer.querySelectorAll('[data-card-id]');
    let insertIndex = cardElements.length;

    for (let i = 0; i < cardElements.length; i++) {
      const cardElement = cardElements[i] as HTMLElement;
      const cardId = cardElement.getAttribute('data-card-id');

      // Skip the card being dragged
      if (cardId === draggedCardId) {
        continue;
      }

      const rect = cardElement.getBoundingClientRect();
      const cardMiddle = rect.top + rect.height / 2;

      if (clientY < cardMiddle) {
        // Adjust index for cards we've skipped
        let adjustedIndex = i;
        for (let j = 0; j < i; j++) {
          const prevCardId = (cardElements[j] as HTMLElement).getAttribute('data-card-id');
          if (prevCardId === draggedCardId) {
            adjustedIndex--;
            break;
          }
        }
        insertIndex = adjustedIndex;
        break;
      }
    }

    // Adjust the final index if the dragged card is in this column and comes before the insert position
    let finalIndex = insertIndex;
    for (let i = 0; i < cardElements.length && i < insertIndex; i++) {
      const cardId = (cardElements[i] as HTMLElement).getAttribute('data-card-id');
      if (cardId === draggedCardId) {
        finalIndex--;
        break;
      }
    }

    return { columnId: targetColumn.id, insertIndex: finalIndex };
  }, []);

  /**
   * Update drag position and find drop target
   */
  const updateDrag = useCallback((clientX: number, clientY: number) => {
    setDragState(prev => {
      if (!prev.isDragging || !prev.draggedCard) {
        return prev;
      }

      const dropTarget = findDropTarget(clientX, clientY, prev.draggedCard.cardId);

      return {
        ...prev,
        currentPosition: { x: clientX, y: clientY },
        dropTarget,
      };
    });
  }, [findDropTarget]);

  /**
   * End the drag operation and execute the move if there's a valid drop target
   *
   * IMPORTANT: We capture state values before resetting, then call onMoveCard
   * AFTER the state reset. Calling onMoveCard inside setDragState's updater
   * function is an anti-pattern that can cause issues with React 18's batching.
   */
  const endDrag = useCallback(() => {
    // Capture the current state before resetting
    const currentDraggedCard = dragState.draggedCard;
    const currentDropTarget = dragState.dropTarget;
    const wasDragging = dragState.isDragging;

    // Reset drag state first
    setDragState({
      isDragging: false,
      draggedCard: null,
      currentPosition: null,
      dropTarget: null,
    });

    // Execute the move after state reset
    if (wasDragging && currentDraggedCard && currentDropTarget) {
      onMoveCard(
        currentDraggedCard.cardId,
        currentDraggedCard.columnId,
        currentDropTarget.columnId,
        currentDropTarget.insertIndex
      );
    }
  }, [dragState.isDragging, dragState.draggedCard, dragState.dropTarget, onMoveCard]);

  /**
   * Cancel the drag without executing a move
   */
  const cancelDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      draggedCard: null,
      currentPosition: null,
      dropTarget: null,
    });
  }, []);

  // Global mouse event handlers
  useEffect(() => {
    if (!dragState.isDragging) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      updateDrag(e.clientX, e.clientY);
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      endDrag();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelDrag();
      }
    };

    // Capture mouse events at the document level during drag
    document.addEventListener('mousemove', handleMouseMove, { capture: true });
    document.addEventListener('mouseup', handleMouseUp, { capture: true });
    document.addEventListener('keydown', handleKeyDown);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, { capture: true });
      document.removeEventListener('mouseup', handleMouseUp, { capture: true });
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragState.isDragging, updateDrag, endDrag, cancelDrag]);

  return {
    // State
    isDragging: dragState.isDragging,
    draggedCard: dragState.draggedCard,
    currentPosition: dragState.currentPosition,
    dropTarget: dragState.dropTarget,

    // Actions
    startDrag,
    endDrag,
    cancelDrag,

    // Registration
    registerColumn,
    registerCard,
  };
}

/**
 * Get the styles for the drag overlay element
 */
export function getDragOverlayStyle(
  currentPosition: { x: number; y: number } | null,
  draggedCard: DraggedCard | null
): React.CSSProperties {
  if (!currentPosition || !draggedCard) {
    return { display: 'none' };
  }

  return {
    position: 'fixed',
    left: currentPosition.x - draggedCard.offsetX,
    top: currentPosition.y - draggedCard.offsetY,
    width: draggedCard.initialRect.width,
    pointerEvents: 'none',
    zIndex: 10000,
    transform: 'rotate(3deg)',
    opacity: 0.95,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
  };
}
