/**
 * Smart Formatting Module
 *
 * Provides intelligent formatting behaviors for markdown editing:
 * 1. List continuation - Enter after list items continues the list
 * 2. Numbered list auto-increment - Numbers increment automatically
 * 3. Checkbox handling - Properly continues checkbox lists
 * 4. Quote continuation - Blockquotes continue on Enter
 * 5. Auto-pair characters - Auto-close backticks, asterisks, brackets
 */

import { getLineAtPosition, isInsideCodeBlock } from './markdownUtils';

/**
 * Result of a smart formatting operation
 */
export interface SmartFormattingResult {
  handled: boolean;
  newContent?: string;
  newCursorPosition?: number;
  preventDefault?: boolean;
}

/**
 * Characters that should be auto-paired
 */
const AUTO_PAIR_MAP: Record<string, string> = {
  '`': '`',
  '*': '*',
  '_': '_',
  '[': ']',
  '(': ')',
  '{': '}',
  '"': '"',
  "'": "'",
  '~': '~',
};

/**
 * Characters that close an auto-pair
 */
const CLOSING_CHARS = new Set(Object.values(AUTO_PAIR_MAP));

/**
 * Handle Enter key press with smart list/quote continuation
 */
export function handleEnterKey(
  content: string,
  cursorPosition: number
): SmartFormattingResult {
  const { line, lineStart, lineEnd } = getLineAtPosition(content, cursorPosition);
  const cursorInLine = cursorPosition - lineStart;

  // Don't interfere inside code blocks
  if (isInsideCodeBlock(content, cursorPosition)) {
    return { handled: false };
  }

  // Check for checkbox list (- [ ] or - [x])
  const checkboxMatch = line.match(/^(\s*)([-*+])\s+\[([ xX])\]\s*(.*)/);
  if (checkboxMatch) {
    const [, indent, bullet, , itemContent] = checkboxMatch;
    const prefixLength = indent.length + bullet.length + 5; // "- [ ] "

    // If cursor is at end of empty item, remove the list marker
    if (itemContent.trim() === '' && cursorInLine >= prefixLength) {
      const newContent =
        content.slice(0, lineStart) +
        indent +
        content.slice(lineEnd);
      return {
        handled: true,
        newContent,
        newCursorPosition: lineStart + indent.length,
        preventDefault: true,
      };
    }

    // Continue the checkbox list with unchecked box
    const newLine = `\n${indent}${bullet} [ ] `;
    const insertPosition = cursorPosition;
    const newContent =
      content.slice(0, insertPosition) +
      newLine +
      content.slice(insertPosition);

    return {
      handled: true,
      newContent,
      newCursorPosition: insertPosition + newLine.length,
      preventDefault: true,
    };
  }

  // Check for bullet list (-, *, +)
  const bulletMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
  if (bulletMatch) {
    const [, indent, bullet, itemContent] = bulletMatch;
    const prefixLength = indent.length + bullet.length + 1; // "- "

    // If cursor is at end of empty item, remove the list marker
    if (itemContent.trim() === '' && cursorInLine >= prefixLength) {
      const newContent =
        content.slice(0, lineStart) +
        indent +
        content.slice(lineEnd);
      return {
        handled: true,
        newContent,
        newCursorPosition: lineStart + indent.length,
        preventDefault: true,
      };
    }

    // Continue the bullet list
    const newLine = `\n${indent}${bullet} `;
    const insertPosition = cursorPosition;
    const newContent =
      content.slice(0, insertPosition) +
      newLine +
      content.slice(insertPosition);

    return {
      handled: true,
      newContent,
      newCursorPosition: insertPosition + newLine.length,
      preventDefault: true,
    };
  }

  // Check for numbered list
  const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
  if (numberedMatch) {
    const [, indent, numberStr, itemContent] = numberedMatch;
    const number = parseInt(numberStr, 10);
    const prefixLength = indent.length + numberStr.length + 2; // "1. "

    // If cursor is at end of empty item, remove the list marker
    if (itemContent.trim() === '' && cursorInLine >= prefixLength) {
      const newContent =
        content.slice(0, lineStart) +
        indent +
        content.slice(lineEnd);
      return {
        handled: true,
        newContent,
        newCursorPosition: lineStart + indent.length,
        preventDefault: true,
      };
    }

    // Continue with incremented number
    const nextNumber = number + 1;
    const newLine = `\n${indent}${nextNumber}. `;
    const insertPosition = cursorPosition;
    const newContent =
      content.slice(0, insertPosition) +
      newLine +
      content.slice(insertPosition);

    return {
      handled: true,
      newContent,
      newCursorPosition: insertPosition + newLine.length,
      preventDefault: true,
    };
  }

  // Check for blockquote
  const quoteMatch = line.match(/^(>+)\s?(.*)/);
  if (quoteMatch) {
    const [, quotes, quoteContent] = quoteMatch;

    // If cursor is at end of empty quote, remove the quote marker
    if (quoteContent.trim() === '' && cursorInLine >= quotes.length) {
      const newContent =
        content.slice(0, lineStart) +
        content.slice(lineEnd);
      return {
        handled: true,
        newContent,
        newCursorPosition: lineStart,
        preventDefault: true,
      };
    }

    // Continue the blockquote
    const newLine = `\n${quotes} `;
    const insertPosition = cursorPosition;
    const newContent =
      content.slice(0, insertPosition) +
      newLine +
      content.slice(insertPosition);

    return {
      handled: true,
      newContent,
      newCursorPosition: insertPosition + newLine.length,
      preventDefault: true,
    };
  }

  return { handled: false };
}

/**
 * Handle Tab key for list indentation
 */
export function handleTabKey(
  content: string,
  cursorPosition: number,
  shiftKey: boolean
): SmartFormattingResult {
  const { line, lineStart, lineEnd } = getLineAtPosition(content, cursorPosition);

  // Don't interfere inside code blocks
  if (isInsideCodeBlock(content, cursorPosition)) {
    return { handled: false };
  }

  // Check if we're on a list item
  const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s/);
  if (!listMatch) {
    return { handled: false };
  }

  const [, currentIndent] = listMatch;
  const indentUnit = '  '; // 2 spaces per indent level

  if (shiftKey) {
    // Outdent: remove one level of indentation
    if (currentIndent.length >= indentUnit.length) {
      const newIndent = currentIndent.slice(indentUnit.length);
      const newLine = newIndent + line.slice(currentIndent.length);
      const newContent =
        content.slice(0, lineStart) +
        newLine +
        content.slice(lineEnd);
      const newCursorPosition = Math.max(
        lineStart + newIndent.length,
        cursorPosition - indentUnit.length
      );
      return {
        handled: true,
        newContent,
        newCursorPosition,
        preventDefault: true,
      };
    }
  } else {
    // Indent: add one level of indentation
    const newLine = indentUnit + line;
    const newContent =
      content.slice(0, lineStart) +
      newLine +
      content.slice(lineEnd);
    return {
      handled: true,
      newContent,
      newCursorPosition: cursorPosition + indentUnit.length,
      preventDefault: true,
    };
  }

  return { handled: false };
}

/**
 * Handle Backspace key for smart deletion
 */
export function handleBackspaceKey(
  content: string,
  cursorPosition: number,
  selectionStart: number,
  selectionEnd: number
): SmartFormattingResult {
  // If there's a selection, let default behavior handle it
  if (selectionStart !== selectionEnd) {
    return { handled: false };
  }

  // Can't delete at start of document
  if (cursorPosition === 0) {
    return { handled: false };
  }

  const charBefore = content[cursorPosition - 1];
  const charAfter = content[cursorPosition] || '';

  // Check for auto-paired characters to delete both
  if (AUTO_PAIR_MAP[charBefore] === charAfter) {
    const newContent =
      content.slice(0, cursorPosition - 1) +
      content.slice(cursorPosition + 1);
    return {
      handled: true,
      newContent,
      newCursorPosition: cursorPosition - 1,
      preventDefault: true,
    };
  }

  // Check if we're at the beginning of a list item
  const { line, lineStart } = getLineAtPosition(content, cursorPosition);
  const cursorInLine = cursorPosition - lineStart;

  // If at the start of a list marker, remove the whole marker
  const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s/);
  if (listMatch) {
    const markerEnd = listMatch[0].length;
    if (cursorInLine === markerEnd) {
      // Remove the list marker, keep the content
      const indent = listMatch[1];
      const contentAfterMarker = line.slice(markerEnd);
      const newLine = indent + contentAfterMarker;
      const newContent =
        content.slice(0, lineStart) +
        newLine +
        content.slice(lineStart + line.length);
      return {
        handled: true,
        newContent,
        newCursorPosition: lineStart + indent.length,
        preventDefault: true,
      };
    }
  }

  return { handled: false };
}

/**
 * Handle character input for auto-pairing
 */
export function handleCharacterInput(
  content: string,
  cursorPosition: number,
  selectionStart: number,
  selectionEnd: number,
  char: string
): SmartFormattingResult {
  // Don't auto-pair inside code blocks (except for the initial backticks)
  if (char !== '`' && isInsideCodeBlock(content, cursorPosition)) {
    return { handled: false };
  }

  const hasSelection = selectionStart !== selectionEnd;
  const closingChar = AUTO_PAIR_MAP[char];

  // Handle closing character - skip over it if it matches what's ahead
  if (CLOSING_CHARS.has(char) && !hasSelection) {
    const charAhead = content[cursorPosition];
    if (charAhead === char) {
      // Skip over the closing character instead of inserting
      return {
        handled: true,
        newContent: content,
        newCursorPosition: cursorPosition + 1,
        preventDefault: true,
      };
    }
  }

  // If there's no matching close character, don't auto-pair
  if (!closingChar) {
    return { handled: false };
  }

  // For quotes, only auto-pair if:
  // - At start of document
  // - After whitespace or opening brackets
  // - Not after alphanumeric characters (to avoid breaking contractions)
  if (char === '"' || char === "'" || char === '`') {
    if (cursorPosition > 0) {
      const charBefore = content[cursorPosition - 1];
      if (/\w/.test(charBefore)) {
        return { handled: false };
      }
    }
  }

  // For asterisks and underscores, be more conservative
  // Only auto-pair if followed by non-alphanumeric or end
  if (char === '*' || char === '_') {
    const charAfter = content[cursorPosition];
    if (charAfter && /\w/.test(charAfter)) {
      return { handled: false };
    }
  }

  if (hasSelection) {
    // Wrap selection with the pair
    const selectedText = content.slice(selectionStart, selectionEnd);
    const wrappedText = char + selectedText + closingChar;
    const newContent =
      content.slice(0, selectionStart) +
      wrappedText +
      content.slice(selectionEnd);
    return {
      handled: true,
      newContent,
      newCursorPosition: selectionEnd + 2, // After the closing char
      preventDefault: true,
    };
  }

  // Insert the pair and position cursor in the middle
  const newContent =
    content.slice(0, cursorPosition) +
    char +
    closingChar +
    content.slice(cursorPosition);
  return {
    handled: true,
    newContent,
    newCursorPosition: cursorPosition + 1,
    preventDefault: true,
  };
}

/**
 * Handle triple backtick for code block creation
 */
export function handleTripleBacktick(
  content: string,
  cursorPosition: number
): SmartFormattingResult {
  // Check if we just typed the third backtick
  if (cursorPosition < 2) {
    return { handled: false };
  }

  const charsBefore = content.slice(cursorPosition - 2, cursorPosition);
  if (charsBefore !== '``') {
    return { handled: false };
  }

  // Check if we're at the start of a line (or after only whitespace)
  const { line, lineStart } = getLineAtPosition(content, cursorPosition);
  const textBeforeOnLine = line.slice(0, cursorPosition - lineStart);
  if (textBeforeOnLine.trim() !== '``') {
    return { handled: false };
  }

  // Create a full code block with closing fence
  const indent = textBeforeOnLine.replace('``', '');
  const codeBlock = '`\n' + indent + '\n' + indent + '```';
  const newContent =
    content.slice(0, cursorPosition) +
    codeBlock +
    content.slice(cursorPosition);

  // Position cursor after the opening fence (where language would go)
  return {
    handled: true,
    newContent,
    newCursorPosition: cursorPosition + 1,
    preventDefault: true,
  };
}

/**
 * Main handler for keydown events
 * Returns a result indicating if the event was handled
 */
export function handleSmartFormatting(
  event: KeyboardEvent,
  content: string,
  cursorPosition: number,
  selectionStart: number,
  selectionEnd: number
): SmartFormattingResult {
  // Handle Enter key
  if (event.key === 'Enter' && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
    return handleEnterKey(content, cursorPosition);
  }

  // Handle Tab key
  if (event.key === 'Tab') {
    return handleTabKey(content, cursorPosition, event.shiftKey);
  }

  // Handle Backspace key
  if (event.key === 'Backspace') {
    return handleBackspaceKey(content, cursorPosition, selectionStart, selectionEnd);
  }

  return { handled: false };
}

/**
 * Handler for input events (character typing)
 * Called after the character is inserted
 */
export function handleSmartInput(
  content: string,
  cursorPosition: number,
  selectionStart: number,
  selectionEnd: number,
  inputChar: string
): SmartFormattingResult {
  // Handle auto-pairing
  if (inputChar.length === 1 && AUTO_PAIR_MAP[inputChar]) {
    return handleCharacterInput(
      content,
      cursorPosition,
      selectionStart,
      selectionEnd,
      inputChar
    );
  }

  // Handle triple backtick
  if (inputChar === '`') {
    return handleTripleBacktick(content, cursorPosition);
  }

  return { handled: false };
}

/**
 * Check if a character should trigger auto-pairing
 */
export function shouldAutoPair(char: string): boolean {
  return char in AUTO_PAIR_MAP;
}

/**
 * Get the closing character for an opening character
 */
export function getClosingChar(char: string): string | null {
  return AUTO_PAIR_MAP[char] || null;
}
