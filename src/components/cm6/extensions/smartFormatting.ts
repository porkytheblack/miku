/**
 * Smart formatting keymap + input rules for CodeMirror 6.
 *
 * Ports the existing SmartFormatting.ts and markdownUtils.ts logic:
 *   - Enter: list continuation (bullet, numbered, checkbox, blockquote)
 *   - Tab / Shift-Tab: indent / outdent list items
 *   - Auto-pair brackets, backticks, asterisks, underscores
 *   - Cmd+B / Cmd+I / Cmd+` / Cmd+Shift+S: toggle formatting
 */

import { EditorView, KeyBinding, keymap } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { toggleFormatting } from '@/lib/markdown/markdownUtils';

// ─── Format toggle adapter ──────────────────────────────────────────────────

function cmToggle(
  view: EditorView,
  type: 'bold' | 'italic' | 'code' | 'strikethrough',
): boolean {
  const content = view.state.doc.toString();
  const { from, to } = view.state.selection.main;
  const result = toggleFormatting(content, from, to, type);
  view.dispatch({
    changes: { from: 0, to: content.length, insert: result.newText },
    selection: EditorSelection.single(
      result.newSelectionStart,
      result.newSelectionEnd,
    ),
  });
  return true;
}

// ─── List continuation on Enter ──────────────────────────────────────────────

function handleEnter(view: EditorView): boolean {
  const { state } = view;
  const { head } = state.selection.main;
  const line = state.doc.lineAt(head);
  const text = line.text;

  // Checkbox lists: - [ ] / - [x]
  const checkboxMatch = text.match(
    /^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)/,
  );
  if (checkboxMatch) {
    const [, indent, bullet, , content] = checkboxMatch;
    if (!content.trim()) {
      // Empty checkbox item — remove it
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
      });
      return true;
    }
    const newLine = `\n${indent}${bullet} [ ] `;
    view.dispatch({
      changes: { from: head, insert: newLine },
      selection: EditorSelection.cursor(head + newLine.length),
    });
    return true;
  }

  // Unordered lists: - / * / +
  const ulMatch = text.match(/^(\s*)([-*+])\s+(.*)/);
  if (ulMatch) {
    const [, indent, bullet, content] = ulMatch;
    if (!content.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
      });
      return true;
    }
    const newLine = `\n${indent}${bullet} `;
    view.dispatch({
      changes: { from: head, insert: newLine },
      selection: EditorSelection.cursor(head + newLine.length),
    });
    return true;
  }

  // Ordered lists: 1. / 2. etc.
  const olMatch = text.match(/^(\s*)(\d+)\.\s+(.*)/);
  if (olMatch) {
    const [, indent, numStr, content] = olMatch;
    if (!content.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
      });
      return true;
    }
    const next = parseInt(numStr, 10) + 1;
    const newLine = `\n${indent}${next}. `;
    view.dispatch({
      changes: { from: head, insert: newLine },
      selection: EditorSelection.cursor(head + newLine.length),
    });
    return true;
  }

  // Blockquotes: >
  const bqMatch = text.match(/^(\s*>+)\s*(.*)/);
  if (bqMatch) {
    const [, prefix, content] = bqMatch;
    if (!content.trim()) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '' },
      });
      return true;
    }
    const newLine = `\n${prefix} `;
    view.dispatch({
      changes: { from: head, insert: newLine },
      selection: EditorSelection.cursor(head + newLine.length),
    });
    return true;
  }

  return false;
}

// ─── Tab indent ──────────────────────────────────────────────────────────────

function handleTab(view: EditorView): boolean {
  const { state } = view;
  const { head } = state.selection.main;
  const line = state.doc.lineAt(head);
  const text = line.text;

  if (/^\s*([-*+]|\d+\.)\s/.test(text)) {
    view.dispatch({
      changes: { from: line.from, insert: '  ' },
      selection: EditorSelection.cursor(head + 2),
    });
    return true;
  }

  // Insert 2 spaces otherwise
  view.dispatch({
    changes: { from: head, insert: '  ' },
    selection: EditorSelection.cursor(head + 2),
  });
  return true;
}

function handleShiftTab(view: EditorView): boolean {
  const { state } = view;
  const { head } = state.selection.main;
  const line = state.doc.lineAt(head);
  const text = line.text;

  const match = text.match(/^( {1,2})/);
  if (match) {
    const removeCount = match[1].length;
    view.dispatch({
      changes: { from: line.from, to: line.from + removeCount },
      selection: EditorSelection.cursor(Math.max(line.from, head - removeCount)),
    });
    return true;
  }

  return false;
}

// ─── Auto-pairing ────────────────────────────────────────────────────────────

const PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '`': '`',
  '"': '"',
  "'": "'",
};

function autoPairInputHandler() {
  return EditorView.inputHandler.of((view, from, to, text) => {
    if (text.length !== 1) return false;

    const closing = PAIRS[text];
    if (!closing) return false;

    const { state } = view;
    const sel = state.selection.main;

    // If text is selected, wrap it
    if (sel.from !== sel.to) {
      const selected = state.doc.sliceString(sel.from, sel.to);
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text + selected + closing },
        selection: EditorSelection.single(
          sel.from + 1,
          sel.from + 1 + selected.length,
        ),
      });
      return true;
    }

    // For matching quotes/backticks, check if we're closing an existing one
    if (text === closing && text === '`' || text === '"' || text === "'") {
      const after = state.doc.sliceString(from, from + 1);
      if (after === closing) {
        // Skip over closing character
        view.dispatch({
          selection: EditorSelection.cursor(from + 1),
        });
        return true;
      }
    }

    // Insert pair
    view.dispatch({
      changes: { from, to, insert: text + closing },
      selection: EditorSelection.cursor(from + 1),
    });
    return true;
  });
}

// ─── Callbacks (passed in from React) ────────────────────────────────────────

interface SmartFormattingCallbacks {
  onManualReview?: () => void;
  onRewriteSelection?: () => void;
  onAcceptAll?: () => void;
  onDeclineAll?: () => void;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export function smartFormattingExtension(callbacks: SmartFormattingCallbacks = {}) {
  const keys: KeyBinding[] = [
    {
      key: 'Enter',
      run: handleEnter,
    },
    {
      key: 'Tab',
      run: handleTab,
    },
    {
      key: 'Shift-Tab',
      run: handleShiftTab,
    },
    {
      key: 'Mod-b',
      run: (view) => cmToggle(view, 'bold'),
    },
    {
      key: 'Mod-i',
      run: (view) => cmToggle(view, 'italic'),
    },
    {
      key: 'Mod-`',
      run: (view) => cmToggle(view, 'code'),
    },
    {
      key: 'Mod-Shift-s',
      run: (view) => cmToggle(view, 'strikethrough'),
    },
  ];

  if (callbacks.onManualReview) {
    const cb = callbacks.onManualReview;
    keys.push({
      key: 'Mod-Enter',
      run: () => {
        cb();
        return true;
      },
    });
  }

  if (callbacks.onRewriteSelection) {
    const cb = callbacks.onRewriteSelection;
    keys.push({
      key: 'Mod-r',
      run: () => {
        cb();
        return true;
      },
    });
  }

  if (callbacks.onAcceptAll) {
    const cb = callbacks.onAcceptAll;
    keys.push({
      key: 'Mod-Shift-a',
      run: () => {
        cb();
        return true;
      },
    });
  }

  if (callbacks.onDeclineAll) {
    const cb = callbacks.onDeclineAll;
    keys.push({
      key: 'Mod-Shift-d',
      run: () => {
        cb();
        return true;
      },
    });
  }

  return [keymap.of(keys), autoPairInputHandler()];
}
