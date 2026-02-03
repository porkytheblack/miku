/**
 * Markdown Utilities
 *
 * Provides utilities for:
 * 1. Parsing markdown structure into a basic AST
 * 2. Finding markdown elements at cursor positions
 * 3. Toggling inline formatting (bold, italic, code)
 * 4. Extracting headings and code blocks with positions
 */

/**
 * Types of markdown elements we track
 */
export type MarkdownElementType =
  | 'heading'
  | 'paragraph'
  | 'list-item'
  | 'numbered-list-item'
  | 'checkbox'
  | 'blockquote'
  | 'code-block'
  | 'code-inline'
  | 'horizontal-rule'
  | 'link'
  | 'image'
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'text';

/**
 * Represents a markdown element in the document
 */
export interface MarkdownElement {
  type: MarkdownElementType;
  startIndex: number;
  endIndex: number;
  lineNumber: number;
  content: string;
  level?: number; // For headings (1-6) or list nesting
  language?: string; // For code blocks
  checked?: boolean; // For checkboxes
  url?: string; // For links/images
  children?: MarkdownElement[];
}

/**
 * Represents the structure of a markdown document
 */
export interface MarkdownStructure {
  elements: MarkdownElement[];
  headings: MarkdownElement[];
  codeBlocks: MarkdownElement[];
  links: MarkdownElement[];
  listItems: MarkdownElement[];
}

/**
 * Represents a heading extracted from the document
 */
export interface ExtractedHeading {
  text: string;
  level: number;
  lineNumber: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Represents a code block extracted from the document
 */
export interface ExtractedCodeBlock {
  language: string;
  content: string;
  lineNumber: number;
  startIndex: number;
  endIndex: number;
  startLine: number;
  endLine: number;
}

/**
 * Result of a formatting toggle operation
 */
export interface ToggleResult {
  newText: string;
  newSelectionStart: number;
  newSelectionEnd: number;
}

/**
 * Parse markdown document into a basic structure
 * This is a lightweight parser focused on structural elements, not full AST
 */
export function parseMarkdownStructure(content: string): MarkdownStructure {
  const elements: MarkdownElement[] = [];
  const headings: MarkdownElement[] = [];
  const codeBlocks: MarkdownElement[] = [];
  const links: MarkdownElement[] = [];
  const listItems: MarkdownElement[] = [];

  const lines = content.split('\n');
  let currentIndex = 0;
  let inCodeBlock = false;
  let codeBlockStart = 0;
  let codeBlockStartLine = 0;
  let codeBlockLanguage = '';
  let codeBlockContent = '';

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const lineStart = currentIndex;
    const lineEnd = currentIndex + line.length;
    const lineNumber = lineNum + 1; // 1-indexed

    // Handle code blocks (fenced with ```)
    const codeBlockMatch = line.match(/^(`{3,}|~{3,})(\w*)/);
    if (codeBlockMatch) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        codeBlockStart = lineStart;
        codeBlockStartLine = lineNumber;
        codeBlockLanguage = codeBlockMatch[2] || '';
        codeBlockContent = '';
      } else {
        // Ending a code block
        inCodeBlock = false;
        const element: MarkdownElement = {
          type: 'code-block',
          startIndex: codeBlockStart,
          endIndex: lineEnd,
          lineNumber: codeBlockStartLine,
          content: codeBlockContent,
          language: codeBlockLanguage,
        };
        elements.push(element);
        codeBlocks.push(element);
      }
      currentIndex = lineEnd + 1; // +1 for newline
      continue;
    }

    // Accumulate content inside code blocks
    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      currentIndex = lineEnd + 1;
      continue;
    }

    // Parse headings (# syntax)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const element: MarkdownElement = {
        type: 'heading',
        startIndex: lineStart,
        endIndex: lineEnd,
        lineNumber,
        content: text,
        level,
      };
      elements.push(element);
      headings.push(element);
      currentIndex = lineEnd + 1;
      continue;
    }

    // Parse horizontal rules
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      elements.push({
        type: 'horizontal-rule',
        startIndex: lineStart,
        endIndex: lineEnd,
        lineNumber,
        content: line,
      });
      currentIndex = lineEnd + 1;
      continue;
    }

    // Parse blockquotes
    const blockquoteMatch = line.match(/^(>+)\s?(.*)/);
    if (blockquoteMatch) {
      elements.push({
        type: 'blockquote',
        startIndex: lineStart,
        endIndex: lineEnd,
        lineNumber,
        content: blockquoteMatch[2],
        level: blockquoteMatch[1].length,
      });
      currentIndex = lineEnd + 1;
      continue;
    }

    // Parse checkboxes (- [ ] or - [x])
    const checkboxMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)/);
    if (checkboxMatch) {
      const element: MarkdownElement = {
        type: 'checkbox',
        startIndex: lineStart,
        endIndex: lineEnd,
        lineNumber,
        content: checkboxMatch[3],
        checked: checkboxMatch[2].toLowerCase() === 'x',
        level: Math.floor(checkboxMatch[1].length / 2),
      };
      elements.push(element);
      listItems.push(element);
      currentIndex = lineEnd + 1;
      continue;
    }

    // Parse unordered list items
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.*)/);
    if (ulMatch) {
      const element: MarkdownElement = {
        type: 'list-item',
        startIndex: lineStart,
        endIndex: lineEnd,
        lineNumber,
        content: ulMatch[2],
        level: Math.floor(ulMatch[1].length / 2),
      };
      elements.push(element);
      listItems.push(element);
      currentIndex = lineEnd + 1;
      continue;
    }

    // Parse ordered list items
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (olMatch) {
      const element: MarkdownElement = {
        type: 'numbered-list-item',
        startIndex: lineStart,
        endIndex: lineEnd,
        lineNumber,
        content: olMatch[3],
        level: Math.floor(olMatch[1].length / 2),
      };
      elements.push(element);
      listItems.push(element);
      currentIndex = lineEnd + 1;
      continue;
    }

    // Parse inline links and images within the line
    const linkRegex = /(!?)\[([^\]]*)\]\(([^)]+)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(line)) !== null) {
      const isImage = linkMatch[1] === '!';
      const linkElement: MarkdownElement = {
        type: isImage ? 'image' : 'link',
        startIndex: lineStart + linkMatch.index,
        endIndex: lineStart + linkMatch.index + linkMatch[0].length,
        lineNumber,
        content: linkMatch[2],
        url: linkMatch[3],
      };
      links.push(linkElement);
    }

    // Default to paragraph for non-empty lines
    if (line.trim()) {
      elements.push({
        type: 'paragraph',
        startIndex: lineStart,
        endIndex: lineEnd,
        lineNumber,
        content: line,
      });
    }

    currentIndex = lineEnd + 1;
  }

  // Handle unclosed code block at end of document
  if (inCodeBlock) {
    const element: MarkdownElement = {
      type: 'code-block',
      startIndex: codeBlockStart,
      endIndex: content.length,
      lineNumber: codeBlockStartLine,
      content: codeBlockContent,
      language: codeBlockLanguage,
    };
    elements.push(element);
    codeBlocks.push(element);
  }

  return {
    elements,
    headings,
    codeBlocks,
    links,
    listItems,
  };
}

/**
 * Find the markdown element at a specific cursor position
 */
export function getElementAtPosition(
  content: string,
  position: number
): MarkdownElement | null {
  const structure = parseMarkdownStructure(content);

  // Find the element that contains this position
  for (const element of structure.elements) {
    if (position >= element.startIndex && position <= element.endIndex) {
      return element;
    }
  }

  return null;
}

/**
 * Get the line content and metadata at a specific position
 */
export function getLineAtPosition(
  content: string,
  position: number
): { line: string; lineStart: number; lineEnd: number; lineNumber: number } {
  const lines = content.split('\n');
  let currentIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = currentIndex;
    const lineEnd = currentIndex + line.length;

    if (position >= lineStart && position <= lineEnd) {
      return {
        line,
        lineStart,
        lineEnd,
        lineNumber: i + 1,
      };
    }

    currentIndex = lineEnd + 1; // +1 for newline
  }

  // Return last line if position is beyond content
  const lastLine = lines[lines.length - 1] || '';
  const lastLineStart = content.length - lastLine.length;
  return {
    line: lastLine,
    lineStart: lastLineStart,
    lineEnd: content.length,
    lineNumber: lines.length,
  };
}

/**
 * Toggle inline formatting (bold, italic, code, strikethrough)
 * Handles both applying and removing formatting
 */
export function toggleFormatting(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  formatType: 'bold' | 'italic' | 'code' | 'strikethrough'
): ToggleResult {
  const markers: Record<string, string> = {
    bold: '**',
    italic: '_',
    code: '`',
    strikethrough: '~~',
  };

  const marker = markers[formatType];
  const markerLen = marker.length;

  // If no selection, try to detect if cursor is inside formatted text
  if (selectionStart === selectionEnd) {
    const result = detectAndToggleExisting(content, selectionStart, marker);
    if (result) {
      return result;
    }
    // No existing formatting found, just insert empty markers
    const newText =
      content.slice(0, selectionStart) +
      marker +
      marker +
      content.slice(selectionStart);
    return {
      newText,
      newSelectionStart: selectionStart + markerLen,
      newSelectionEnd: selectionStart + markerLen,
    };
  }

  const selectedText = content.slice(selectionStart, selectionEnd);

  // Check if selection is already wrapped with the marker
  const beforeSelection = content.slice(
    Math.max(0, selectionStart - markerLen),
    selectionStart
  );
  const afterSelection = content.slice(
    selectionEnd,
    Math.min(content.length, selectionEnd + markerLen)
  );

  if (beforeSelection === marker && afterSelection === marker) {
    // Remove formatting
    const newText =
      content.slice(0, selectionStart - markerLen) +
      selectedText +
      content.slice(selectionEnd + markerLen);
    return {
      newText,
      newSelectionStart: selectionStart - markerLen,
      newSelectionEnd: selectionEnd - markerLen,
    };
  }

  // Check if selected text starts and ends with markers
  if (
    selectedText.startsWith(marker) &&
    selectedText.endsWith(marker) &&
    selectedText.length >= markerLen * 2
  ) {
    // Remove formatting from selected text
    const unformatted = selectedText.slice(markerLen, -markerLen);
    const newText =
      content.slice(0, selectionStart) + unformatted + content.slice(selectionEnd);
    return {
      newText,
      newSelectionStart: selectionStart,
      newSelectionEnd: selectionStart + unformatted.length,
    };
  }

  // Apply formatting
  const formattedText = marker + selectedText + marker;
  const newText =
    content.slice(0, selectionStart) + formattedText + content.slice(selectionEnd);

  return {
    newText,
    newSelectionStart: selectionStart,
    newSelectionEnd: selectionStart + formattedText.length,
  };
}

/**
 * Detect if cursor is inside formatted text and toggle it
 */
function detectAndToggleExisting(
  content: string,
  position: number,
  marker: string
): ToggleResult | null {
  const markerLen = marker.length;

  // Search backwards and forwards for the marker
  let searchStart = Math.max(0, position - 100); // Limit search range
  let searchEnd = Math.min(content.length, position + 100);

  const searchRange = content.slice(searchStart, searchEnd);
  const localPos = position - searchStart;

  // Find all marker positions in the search range
  const markerPositions: number[] = [];
  let idx = 0;
  while ((idx = searchRange.indexOf(marker, idx)) !== -1) {
    markerPositions.push(idx);
    idx += markerLen;
  }

  // Check if position is between a pair of markers
  for (let i = 0; i < markerPositions.length - 1; i++) {
    const openPos = markerPositions[i];
    const closePos = markerPositions[i + 1];

    // Check if cursor is between this pair
    if (localPos > openPos + markerLen - 1 && localPos < closePos + markerLen) {
      // Found enclosing markers, remove them
      const globalOpen = searchStart + openPos;
      const globalClose = searchStart + closePos;
      const innerText = content.slice(globalOpen + markerLen, globalClose);

      const newText =
        content.slice(0, globalOpen) +
        innerText +
        content.slice(globalClose + markerLen);

      // Adjust cursor position
      const newPosition = position - markerLen;

      return {
        newText,
        newSelectionStart: newPosition,
        newSelectionEnd: newPosition,
      };
    }
  }

  return null;
}

/**
 * Extract all headings from the document with their positions
 */
export function extractHeadings(content: string): ExtractedHeading[] {
  const headings: ExtractedHeading[] = [];
  const lines = content.split('\n');
  let currentIndex = 0;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const lineStart = currentIndex;
    const lineEnd = currentIndex + line.length;

    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        text: match[2].trim(),
        level: match[1].length,
        lineNumber: lineNum + 1,
        startIndex: lineStart,
        endIndex: lineEnd,
      });
    }

    currentIndex = lineEnd + 1;
  }

  return headings;
}

/**
 * Extract all code blocks from the document with their boundaries
 */
export function extractCodeBlocks(content: string): ExtractedCodeBlock[] {
  const codeBlocks: ExtractedCodeBlock[] = [];
  const lines = content.split('\n');
  let currentIndex = 0;
  let inCodeBlock = false;
  let blockStart = 0;
  let blockStartLine = 0;
  let blockLanguage = '';
  let blockContent = '';

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const lineStart = currentIndex;
    const lineEnd = currentIndex + line.length;

    const fenceMatch = line.match(/^(`{3,}|~{3,})(\w*)/);

    if (fenceMatch) {
      if (!inCodeBlock) {
        // Starting a code block
        inCodeBlock = true;
        blockStart = lineStart;
        blockStartLine = lineNum + 1;
        blockLanguage = fenceMatch[2] || '';
        blockContent = '';
      } else {
        // Ending a code block
        inCodeBlock = false;
        codeBlocks.push({
          language: blockLanguage,
          content: blockContent,
          lineNumber: blockStartLine,
          startIndex: blockStart,
          endIndex: lineEnd,
          startLine: blockStartLine,
          endLine: lineNum + 1,
        });
      }
    } else if (inCodeBlock) {
      blockContent += (blockContent ? '\n' : '') + line;
    }

    currentIndex = lineEnd + 1;
  }

  // Handle unclosed code block
  if (inCodeBlock) {
    codeBlocks.push({
      language: blockLanguage,
      content: blockContent,
      lineNumber: blockStartLine,
      startIndex: blockStart,
      endIndex: content.length,
      startLine: blockStartLine,
      endLine: lines.length,
    });
  }

  return codeBlocks;
}

/**
 * Check if a position is inside a code block
 */
export function isInsideCodeBlock(content: string, position: number): boolean {
  const codeBlocks = extractCodeBlocks(content);

  for (const block of codeBlocks) {
    if (position >= block.startIndex && position <= block.endIndex) {
      return true;
    }
  }

  return false;
}

/**
 * Get the current list context at a position
 */
export function getListContext(
  content: string,
  position: number
): {
  type: 'bullet' | 'numbered' | 'checkbox' | 'quote' | null;
  prefix: string;
  number?: number;
  checked?: boolean;
  indent: string;
} {
  const { line } = getLineAtPosition(content, position);

  // Check for checkbox
  const checkboxMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s/);
  if (checkboxMatch) {
    return {
      type: 'checkbox',
      prefix: `${checkboxMatch[1]}- [ ] `,
      checked: checkboxMatch[2].toLowerCase() === 'x',
      indent: checkboxMatch[1],
    };
  }

  // Check for bullet list
  const bulletMatch = line.match(/^(\s*)[-*+]\s/);
  if (bulletMatch) {
    return {
      type: 'bullet',
      prefix: `${bulletMatch[1]}- `,
      indent: bulletMatch[1],
    };
  }

  // Check for numbered list
  const numberedMatch = line.match(/^(\s*)(\d+)\.\s/);
  if (numberedMatch) {
    return {
      type: 'numbered',
      prefix: `${numberedMatch[1]}${parseInt(numberedMatch[2], 10) + 1}. `,
      number: parseInt(numberedMatch[2], 10),
      indent: numberedMatch[1],
    };
  }

  // Check for blockquote
  const quoteMatch = line.match(/^(>+)\s?/);
  if (quoteMatch) {
    return {
      type: 'quote',
      prefix: `${quoteMatch[1]} `,
      indent: '',
    };
  }

  return {
    type: null,
    prefix: '',
    indent: '',
  };
}

/**
 * Insert a link at the current position
 */
export function insertLink(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  url: string = ''
): ToggleResult {
  const selectedText = content.slice(selectionStart, selectionEnd);
  const linkText = selectedText || 'link text';
  const linkMarkdown = `[${linkText}](${url})`;

  const newText =
    content.slice(0, selectionStart) + linkMarkdown + content.slice(selectionEnd);

  // Position cursor in URL area if no URL provided
  if (!url) {
    const urlStart = selectionStart + linkText.length + 3; // [text](
    return {
      newText,
      newSelectionStart: urlStart,
      newSelectionEnd: urlStart,
    };
  }

  return {
    newText,
    newSelectionStart: selectionStart,
    newSelectionEnd: selectionStart + linkMarkdown.length,
  };
}

/**
 * Insert an image at the current position
 */
export function insertImage(
  content: string,
  position: number,
  altText: string = 'image',
  url: string = ''
): ToggleResult {
  const imageMarkdown = `![${altText}](${url})`;
  const newText =
    content.slice(0, position) + imageMarkdown + content.slice(position);

  // Position cursor in URL area if no URL provided
  if (!url) {
    const urlStart = position + altText.length + 4; // ![alt](
    return {
      newText,
      newSelectionStart: urlStart,
      newSelectionEnd: urlStart,
    };
  }

  return {
    newText,
    newSelectionStart: position,
    newSelectionEnd: position + imageMarkdown.length,
  };
}
