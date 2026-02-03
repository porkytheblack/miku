/**
 * Markdown Syntax Highlighter
 *
 * Parses markdown content and returns HTML with syntax highlighting.
 * Designed to be used as a background layer behind text input.
 *
 * Key features:
 * - Highlights markdown syntax tokens (headings, emphasis, code, links, etc.)
 * - Uses CSS variables for theming (light/dark mode support)
 * - Designed to work alongside AI suggestion highlights
 * - AI suggestion highlights take precedence over syntax highlighting
 */

/**
 * Token types for syntax highlighting
 */
export type SyntaxTokenType =
  | 'heading-marker'    // The # symbols
  | 'heading-text'      // The heading content
  | 'emphasis-marker'   // * or _ markers
  | 'emphasis-text'     // Bold/italic content
  | 'code-fence'        // ``` markers
  | 'code-language'     // Language identifier after ```
  | 'code-inline'       // Inline `code`
  | 'code-block'        // Code block content
  | 'link-bracket'      // [ ] in links
  | 'link-text'         // Link display text
  | 'link-paren'        // ( ) in links
  | 'link-url'          // The URL in links
  | 'image-marker'      // The ! before images
  | 'list-marker'       // -, *, +, or numbers
  | 'checkbox'          // [ ] or [x]
  | 'checkbox-checked'  // [x]
  | 'blockquote-marker' // > character
  | 'horizontal-rule'   // ---, ***, ___
  | 'strikethrough'     // ~~text~~
  | 'text';             // Regular text

/**
 * Represents a syntax token with position and type
 */
export interface SyntaxToken {
  type: SyntaxTokenType;
  start: number;
  end: number;
  content: string;
}

/**
 * Parse markdown content into syntax tokens
 * This is a single-pass parser that identifies all syntax elements
 */
export function parseMarkdownSyntax(content: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  const lines = content.split('\n');
  let currentIndex = 0;
  let inCodeBlock = false;
  let codeBlockFenceLength = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const lineStart = currentIndex;

    // Handle code block fences
    const codeFenceMatch = line.match(/^(`{3,}|~{3,})(\w*)/);
    if (codeFenceMatch) {
      const fence = codeFenceMatch[1];
      const language = codeFenceMatch[2];

      if (!inCodeBlock) {
        // Opening fence
        inCodeBlock = true;
        codeBlockFenceLength = fence.length;

        tokens.push({
          type: 'code-fence',
          start: lineStart,
          end: lineStart + fence.length,
          content: fence,
        });

        if (language) {
          tokens.push({
            type: 'code-language',
            start: lineStart + fence.length,
            end: lineStart + fence.length + language.length,
            content: language,
          });
        }
      } else if (fence.length >= codeBlockFenceLength) {
        // Closing fence
        inCodeBlock = false;
        codeBlockFenceLength = 0;

        tokens.push({
          type: 'code-fence',
          start: lineStart,
          end: lineStart + fence.length,
          content: fence,
        });
      } else {
        // Inside code block, treat as code
        tokens.push({
          type: 'code-block',
          start: lineStart,
          end: lineStart + line.length,
          content: line,
        });
      }

      currentIndex = lineStart + line.length + 1;
      continue;
    }

    // Inside code block
    if (inCodeBlock) {
      if (line.length > 0) {
        tokens.push({
          type: 'code-block',
          start: lineStart,
          end: lineStart + line.length,
          content: line,
        });
      }
      currentIndex = lineStart + line.length + 1;
      continue;
    }

    // Parse line-level syntax
    parseLineTokens(line, lineStart, tokens);

    currentIndex = lineStart + line.length + 1;
  }

  return tokens;
}

/**
 * Parse tokens within a single line (not in code block)
 */
function parseLineTokens(
  line: string,
  lineStart: number,
  tokens: SyntaxToken[]
): void {
  // Headings
  const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
  if (headingMatch) {
    const [, hashes, text] = headingMatch;
    tokens.push({
      type: 'heading-marker',
      start: lineStart,
      end: lineStart + hashes.length,
      content: hashes,
    });
    if (text) {
      // Parse inline content within heading
      parseInlineTokens(text, lineStart + hashes.length + 1, tokens, 'heading-text');
    }
    return;
  }

  // Horizontal rules
  if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
    tokens.push({
      type: 'horizontal-rule',
      start: lineStart,
      end: lineStart + line.length,
      content: line,
    });
    return;
  }

  // Blockquotes
  const blockquoteMatch = line.match(/^(>+)\s?(.*)/);
  if (blockquoteMatch) {
    const [, markers, text] = blockquoteMatch;
    tokens.push({
      type: 'blockquote-marker',
      start: lineStart,
      end: lineStart + markers.length,
      content: markers,
    });
    if (text) {
      parseInlineTokens(text, lineStart + markers.length + 1, tokens);
    }
    return;
  }

  // Checkbox lists
  const checkboxMatch = line.match(/^(\s*)([-*+])\s+(\[([ xX])\])\s*(.*)/);
  if (checkboxMatch) {
    const [, indent, bullet, checkbox, checkState, text] = checkboxMatch;
    const bulletStart = lineStart + indent.length;

    tokens.push({
      type: 'list-marker',
      start: bulletStart,
      end: bulletStart + bullet.length,
      content: bullet,
    });

    const checkboxStart = bulletStart + bullet.length + 1;
    tokens.push({
      type: checkState.toLowerCase() === 'x' ? 'checkbox-checked' : 'checkbox',
      start: checkboxStart,
      end: checkboxStart + checkbox.length,
      content: checkbox,
    });

    if (text) {
      parseInlineTokens(text, checkboxStart + checkbox.length + 1, tokens);
    }
    return;
  }

  // Unordered lists
  const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
  if (ulMatch) {
    const [, indent, bullet, text] = ulMatch;
    const bulletStart = lineStart + indent.length;

    tokens.push({
      type: 'list-marker',
      start: bulletStart,
      end: bulletStart + bullet.length,
      content: bullet,
    });

    if (text) {
      parseInlineTokens(text, bulletStart + bullet.length + 1, tokens);
    }
    return;
  }

  // Ordered lists
  const olMatch = line.match(/^(\s*)(\d+\.)\s+(.*)/);
  if (olMatch) {
    const [, indent, number, text] = olMatch;
    const numberStart = lineStart + indent.length;

    tokens.push({
      type: 'list-marker',
      start: numberStart,
      end: numberStart + number.length,
      content: number,
    });

    if (text) {
      parseInlineTokens(text, numberStart + number.length + 1, tokens);
    }
    return;
  }

  // Regular paragraph - parse inline elements
  if (line.trim()) {
    parseInlineTokens(line, lineStart, tokens);
  }
}

/**
 * Parse inline tokens (emphasis, code, links, etc.)
 */
function parseInlineTokens(
  text: string,
  startOffset: number,
  tokens: SyntaxToken[],
  wrapperType?: SyntaxTokenType
): void {
  // If this is heading text, add a wrapper token
  if (wrapperType === 'heading-text') {
    tokens.push({
      type: 'heading-text',
      start: startOffset,
      end: startOffset + text.length,
      content: text,
    });
  }

  let i = 0;

  while (i < text.length) {
    // Inline code (single or double backticks)
    if (text[i] === '`') {
      const backtickCount = text[i + 1] === '`' ? 2 : 1;
      const closeIndex = findClosingBackticks(text, i + backtickCount, backtickCount);
      if (closeIndex !== -1) {
        tokens.push({
          type: 'code-inline',
          start: startOffset + i,
          end: startOffset + closeIndex + backtickCount,
          content: text.slice(i, closeIndex + backtickCount),
        });
        i = closeIndex + backtickCount;
        continue;
      }
    }

    // Strikethrough ~~text~~
    if (text.slice(i, i + 2) === '~~') {
      const closeIndex = text.indexOf('~~', i + 2);
      if (closeIndex !== -1) {
        tokens.push({
          type: 'strikethrough',
          start: startOffset + i,
          end: startOffset + closeIndex + 2,
          content: text.slice(i, closeIndex + 2),
        });
        i = closeIndex + 2;
        continue;
      }
    }

    // Bold **text** or __text__
    if (
      (text.slice(i, i + 2) === '**' || text.slice(i, i + 2) === '__') &&
      !isEscaped(text, i)
    ) {
      const marker = text.slice(i, i + 2);
      const closeIndex = findClosingMarker(text, i + 2, marker);
      if (closeIndex !== -1) {
        // Opening marker
        tokens.push({
          type: 'emphasis-marker',
          start: startOffset + i,
          end: startOffset + i + 2,
          content: marker,
        });
        // Content
        tokens.push({
          type: 'emphasis-text',
          start: startOffset + i + 2,
          end: startOffset + closeIndex,
          content: text.slice(i + 2, closeIndex),
        });
        // Closing marker
        tokens.push({
          type: 'emphasis-marker',
          start: startOffset + closeIndex,
          end: startOffset + closeIndex + 2,
          content: marker,
        });
        i = closeIndex + 2;
        continue;
      }
    }

    // Italic *text* or _text_ (but not inside words for _)
    if (
      (text[i] === '*' || text[i] === '_') &&
      text[i + 1] !== text[i] &&
      !isEscaped(text, i)
    ) {
      const marker = text[i];
      // For underscore, check it's not mid-word
      if (marker === '_' && i > 0 && /\w/.test(text[i - 1])) {
        i++;
        continue;
      }
      const closeIndex = findClosingMarker(text, i + 1, marker);
      if (closeIndex !== -1 && closeIndex > i + 1) {
        // For underscore, check closing is not mid-word
        if (marker === '_' && closeIndex + 1 < text.length && /\w/.test(text[closeIndex + 1])) {
          i++;
          continue;
        }
        // Opening marker
        tokens.push({
          type: 'emphasis-marker',
          start: startOffset + i,
          end: startOffset + i + 1,
          content: marker,
        });
        // Content
        tokens.push({
          type: 'emphasis-text',
          start: startOffset + i + 1,
          end: startOffset + closeIndex,
          content: text.slice(i + 1, closeIndex),
        });
        // Closing marker
        tokens.push({
          type: 'emphasis-marker',
          start: startOffset + closeIndex,
          end: startOffset + closeIndex + 1,
          content: marker,
        });
        i = closeIndex + 1;
        continue;
      }
    }

    // Images ![alt](url)
    if (text[i] === '!' && text[i + 1] === '[') {
      const result = parseLink(text, i + 1, startOffset);
      if (result) {
        tokens.push({
          type: 'image-marker',
          start: startOffset + i,
          end: startOffset + i + 1,
          content: '!',
        });
        tokens.push(...result.tokens.map(t => ({
          ...t,
          start: t.start,
          end: t.end,
        })));
        i = result.endIndex;
        continue;
      }
    }

    // Links [text](url)
    if (text[i] === '[' && !isEscaped(text, i)) {
      const result = parseLink(text, i, startOffset);
      if (result) {
        tokens.push(...result.tokens);
        i = result.endIndex;
        continue;
      }
    }

    i++;
  }
}

/**
 * Parse a markdown link and return tokens
 */
function parseLink(
  text: string,
  startIndex: number,
  startOffset: number
): { tokens: SyntaxToken[]; endIndex: number } | null {
  const tokens: SyntaxToken[] = [];

  // Find closing bracket
  let bracketDepth = 1;
  let closeIndex = startIndex + 1;
  while (closeIndex < text.length && bracketDepth > 0) {
    if (text[closeIndex] === '[' && !isEscaped(text, closeIndex)) bracketDepth++;
    if (text[closeIndex] === ']' && !isEscaped(text, closeIndex)) bracketDepth--;
    closeIndex++;
  }

  if (bracketDepth !== 0) return null;

  closeIndex--; // Point to the ]

  // Check for (url) after ]
  if (text[closeIndex + 1] !== '(') return null;

  // Find closing paren
  const urlStart = closeIndex + 2;
  let parenDepth = 1;
  let urlEnd = urlStart;
  while (urlEnd < text.length && parenDepth > 0) {
    if (text[urlEnd] === '(' && !isEscaped(text, urlEnd)) parenDepth++;
    if (text[urlEnd] === ')' && !isEscaped(text, urlEnd)) parenDepth--;
    urlEnd++;
  }

  if (parenDepth !== 0) return null;

  urlEnd--; // Point to the )

  // Opening bracket
  tokens.push({
    type: 'link-bracket',
    start: startOffset + startIndex,
    end: startOffset + startIndex + 1,
    content: '[',
  });

  // Link text
  const linkText = text.slice(startIndex + 1, closeIndex);
  if (linkText) {
    tokens.push({
      type: 'link-text',
      start: startOffset + startIndex + 1,
      end: startOffset + closeIndex,
      content: linkText,
    });
  }

  // Closing bracket
  tokens.push({
    type: 'link-bracket',
    start: startOffset + closeIndex,
    end: startOffset + closeIndex + 1,
    content: ']',
  });

  // Opening paren
  tokens.push({
    type: 'link-paren',
    start: startOffset + closeIndex + 1,
    end: startOffset + closeIndex + 2,
    content: '(',
  });

  // URL
  const url = text.slice(urlStart, urlEnd);
  if (url) {
    tokens.push({
      type: 'link-url',
      start: startOffset + urlStart,
      end: startOffset + urlEnd,
      content: url,
    });
  }

  // Closing paren
  tokens.push({
    type: 'link-paren',
    start: startOffset + urlEnd,
    end: startOffset + urlEnd + 1,
    content: ')',
  });

  return { tokens, endIndex: urlEnd + 1 };
}

/**
 * Find matching backticks for inline code
 */
function findClosingBackticks(text: string, start: number, count: number): number {
  let i = start;
  while (i < text.length) {
    if (text[i] === '`') {
      let matchCount = 0;
      while (i + matchCount < text.length && text[i + matchCount] === '`') {
        matchCount++;
      }
      if (matchCount === count) {
        return i;
      }
      i += matchCount;
    } else {
      i++;
    }
  }
  return -1;
}

/**
 * Find closing marker for emphasis
 */
function findClosingMarker(text: string, start: number, marker: string): number {
  const markerLen = marker.length;
  let i = start;

  while (i < text.length) {
    if (text.slice(i, i + markerLen) === marker && !isEscaped(text, i)) {
      // Make sure there's content between markers
      if (i > start) {
        return i;
      }
    }
    i++;
  }
  return -1;
}

/**
 * Check if a character is escaped with backslash
 */
function isEscaped(text: string, index: number): boolean {
  let backslashCount = 0;
  let i = index - 1;
  while (i >= 0 && text[i] === '\\') {
    backslashCount++;
    i--;
  }
  return backslashCount % 2 === 1;
}

/**
 * Get CSS color for a token type using CSS variables
 */
export function getTokenColor(type: SyntaxTokenType): string {
  switch (type) {
    case 'heading-marker':
    case 'heading-text':
      return 'var(--md-heading-color)';

    case 'emphasis-marker':
    case 'emphasis-text':
    case 'strikethrough':
      return 'var(--md-emphasis-color)';

    case 'code-fence':
    case 'code-language':
    case 'code-inline':
    case 'code-block':
      return 'var(--md-code-color)';

    case 'link-bracket':
    case 'link-paren':
    case 'link-text':
    case 'link-url':
    case 'image-marker':
      return 'var(--md-link-color)';

    case 'list-marker':
    case 'checkbox':
    case 'checkbox-checked':
    case 'blockquote-marker':
    case 'horizontal-rule':
      return 'var(--md-list-marker-color)';

    default:
      return 'inherit';
  }
}

/**
 * Get background color for a token type
 */
export function getTokenBackground(type: SyntaxTokenType): string | null {
  switch (type) {
    case 'code-inline':
      return 'var(--md-code-bg)';
    default:
      return null;
  }
}

/**
 * Get font weight for a token type
 */
export function getTokenFontWeight(type: SyntaxTokenType): string | null {
  switch (type) {
    case 'heading-marker':
    case 'heading-text':
      return '600';
    default:
      return null;
  }
}

/**
 * Get font style for a token type
 */
export function getTokenFontStyle(type: SyntaxTokenType): string | null {
  switch (type) {
    case 'emphasis-text':
      return 'italic';
    default:
      return null;
  }
}

/**
 * Apply syntax highlighting to markdown content
 * Returns HTML with spans for styling
 *
 * @param content - The markdown content to highlight
 * @param existingHighlights - Ranges that are already highlighted (e.g., AI suggestions)
 *                             These take precedence over syntax highlighting
 */
export function highlightMarkdownSyntax(
  content: string,
  existingHighlights: Array<{ start: number; end: number }> = []
): string {
  if (!content) {
    return '';
  }

  const tokens = parseMarkdownSyntax(content);

  // Sort tokens by start position
  const sortedTokens = [...tokens].sort((a, b) => a.start - b.start);

  // Build the highlighted HTML
  let html = '';
  let lastIndex = 0;

  for (const token of sortedTokens) {
    // Check if this token overlaps with an existing highlight
    const isOverlapping = existingHighlights.some(
      h => (token.start >= h.start && token.start < h.end) ||
           (token.end > h.start && token.end <= h.end) ||
           (token.start <= h.start && token.end >= h.end)
    );

    // Skip syntax highlighting for overlapping regions
    if (isOverlapping) {
      continue;
    }

    // Add text before this token (if any)
    if (token.start > lastIndex) {
      html += escapeHtml(content.slice(lastIndex, token.start));
    }

    // Skip if we've already processed past this point
    if (token.start < lastIndex) {
      continue;
    }

    // Build style string
    const color = getTokenColor(token.type);
    const background = getTokenBackground(token.type);
    const fontWeight = getTokenFontWeight(token.type);
    const fontStyle = getTokenFontStyle(token.type);

    let style = `color: ${color};`;
    if (background) {
      style += ` background: ${background}; padding: 0.125em 0.25em; border-radius: 3px;`;
    }
    if (fontWeight) {
      style += ` font-weight: ${fontWeight};`;
    }
    if (fontStyle) {
      style += ` font-style: ${fontStyle};`;
    }

    // Add the highlighted token
    html += `<span style="${style}" data-token-type="${token.type}">${escapeHtml(token.content)}</span>`;

    lastIndex = token.end;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    html += escapeHtml(content.slice(lastIndex));
  }

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Merge syntax highlighting with AI suggestion highlights
 * AI suggestions always take precedence
 */
export function mergeHighlights(
  content: string,
  syntaxHighlightedHtml: string,
  suggestionHighlights: Array<{
    id: string;
    start: number;
    end: number;
    color: string;
    isActive: boolean;
  }>
): string {
  if (suggestionHighlights.length === 0) {
    return syntaxHighlightedHtml;
  }

  // For now, we'll rebuild the HTML with suggestions taking precedence
  // This is simpler than trying to merge the existing HTML
  const sortedSuggestions = [...suggestionHighlights].sort((a, b) => a.start - b.start);

  let html = '';
  let lastIndex = 0;

  for (const suggestion of sortedSuggestions) {
    // Skip overlapping suggestions
    if (suggestion.start < lastIndex) {
      continue;
    }

    // Add syntax-highlighted text before this suggestion
    if (suggestion.start > lastIndex) {
      const beforeText = content.slice(lastIndex, suggestion.start);
      html += highlightMarkdownSyntax(beforeText, []);
    }

    // Add the suggestion highlight
    const suggestionText = content.slice(suggestion.start, suggestion.end);
    const activeStyle = suggestion.isActive ? 'outline: 2px solid var(--accent-primary);' : '';
    html += `<mark data-suggestion-id="${suggestion.id}" style="background-color: ${suggestion.color}; border-radius: 2px; cursor: pointer; pointer-events: auto; ${activeStyle}">${escapeHtml(suggestionText)}</mark>`;

    lastIndex = suggestion.end;
  }

  // Add remaining syntax-highlighted text
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    html += highlightMarkdownSyntax(remainingText, []);
  }

  return html;
}
