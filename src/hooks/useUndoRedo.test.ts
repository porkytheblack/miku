import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo, useTextUndoRedo, TextRevision } from './useUndoRedo';

describe('useUndoRedo', () => {
  it('initializes with the given state', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));
    expect(result.current.current).toBe('initial');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('pushes new state and enables undo', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));

    act(() => {
      result.current.push('second');
    });

    expect(result.current.current).toBe('second');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('undoes to previous state', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));

    act(() => {
      result.current.push('second');
    });

    act(() => {
      const undone = result.current.undo();
      expect(undone).toBe('initial');
    });

    expect(result.current.current).toBe('initial');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redoes to next state', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));

    act(() => {
      result.current.push('second');
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      const redone = result.current.redo();
      expect(redone).toBe('second');
    });

    expect(result.current.current).toBe('second');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('clears redo stack when new state is pushed', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));

    act(() => {
      result.current.push('second');
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.push('third');
    });

    expect(result.current.current).toBe('third');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('respects maxHistory limit', () => {
    const { result } = renderHook(() => useUndoRedo('initial', 3));

    act(() => {
      result.current.push('1');
      result.current.push('2');
      result.current.push('3');
      result.current.push('4');
    });

    // Should have kept last 3 entries + current
    let undoCount = 0;
    while (result.current.canUndo) {
      act(() => {
        result.current.undo();
      });
      undoCount++;
    }

    expect(undoCount).toBe(3);
  });

  it('clear resets history', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));

    // Push states one at a time to ensure proper batching
    act(() => {
      result.current.push('second');
    });

    act(() => {
      result.current.push('third');
    });

    expect(result.current.current).toBe('third');
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.clear();
    });

    // Clear should clear undo/redo stacks but NOT change current value
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.current).toBe('third');
  });

  it('returns null when undoing with no history', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));

    let undone: string | null;
    act(() => {
      undone = result.current.undo();
    });

    expect(undone!).toBeNull();
    expect(result.current.current).toBe('initial');
  });

  it('returns null when redoing with no future', () => {
    const { result } = renderHook(() => useUndoRedo('initial'));

    let redone: string | null;
    act(() => {
      redone = result.current.redo();
    });

    expect(redone!).toBeNull();
    expect(result.current.current).toBe('initial');
  });
});

describe('useTextUndoRedo', () => {
  const createRevision = (original: string, revised: string): TextRevision => ({
    id: 'test-id',
    originalText: original,
    revisedText: revised,
    position: 0,
  });

  it('initializes with the given content', () => {
    const { result } = renderHook(() => useTextUndoRedo('Hello World'));
    expect(result.current.content).toBe('Hello World');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('accepts a revision and updates content', () => {
    const { result } = renderHook(() => useTextUndoRedo('Hello World'));

    act(() => {
      const revision = createRevision('Hello', 'Hi');
      result.current.acceptRevision('Hi World', revision);
    });

    expect(result.current.content).toBe('Hi World');
    expect(result.current.canUndo).toBe(true);
  });

  it('undoes a revision', () => {
    const { result } = renderHook(() => useTextUndoRedo('Hello World'));

    act(() => {
      const revision = createRevision('Hello', 'Hi');
      result.current.acceptRevision('Hi World', revision);
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.content).toBe('Hello World');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('redoes an undone revision', () => {
    const { result } = renderHook(() => useTextUndoRedo('Hello World'));

    act(() => {
      const revision = createRevision('Hello', 'Hi');
      result.current.acceptRevision('Hi World', revision);
    });

    act(() => {
      result.current.undo();
    });

    act(() => {
      result.current.redo();
    });

    expect(result.current.content).toBe('Hi World');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('handles multiple revisions', () => {
    const { result } = renderHook(() => useTextUndoRedo('The quick brown fox'));

    // First revision: "quick" -> "fast"
    act(() => {
      result.current.acceptRevision(
        'The fast brown fox',
        createRevision('quick', 'fast')
      );
    });

    // Second revision: "brown" -> "red"
    act(() => {
      result.current.acceptRevision(
        'The fast red fox',
        createRevision('brown', 'red')
      );
    });

    expect(result.current.content).toBe('The fast red fox');

    // Undo second revision
    act(() => {
      result.current.undo();
    });
    expect(result.current.content).toBe('The fast brown fox');

    // Undo first revision
    act(() => {
      result.current.undo();
    });
    expect(result.current.content).toBe('The quick brown fox');

    // Redo both
    act(() => {
      result.current.redo();
    });
    expect(result.current.content).toBe('The fast brown fox');

    act(() => {
      result.current.redo();
    });
    expect(result.current.content).toBe('The fast red fox');
  });

  it('setContent with clearHistory clears stacks', () => {
    const { result } = renderHook(() => useTextUndoRedo('Hello'));

    act(() => {
      result.current.acceptRevision('Hi', createRevision('Hello', 'Hi'));
    });

    act(() => {
      result.current.setContent('New content', true);
    });

    expect(result.current.content).toBe('New content');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('setContent without clearHistory preserves stacks', () => {
    const { result } = renderHook(() => useTextUndoRedo('Hello'));

    act(() => {
      result.current.acceptRevision('Hi', createRevision('Hello', 'Hi'));
    });

    act(() => {
      result.current.setContent('Modified');
    });

    expect(result.current.content).toBe('Modified');
    expect(result.current.canUndo).toBe(true);
  });
});
