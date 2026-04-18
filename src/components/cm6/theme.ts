import { EditorView } from '@codemirror/view';

/**
 * Miku editor theme for CodeMirror 6.
 * Uses CSS variables from the app's theme system so it auto-adapts
 * to light/dark mode without reconfiguration.
 */
export function mikuTheme(options: {
  fontSize: number;
  lineHeight: number;
  fontFamily: 'mono' | 'sans';
}) {
  return EditorView.theme({
    '&': {
      fontSize: `${options.fontSize}px`,
      color: 'var(--text-primary)',
      backgroundColor: 'transparent',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-content': {
      fontFamily:
        options.fontFamily === 'mono'
          ? 'var(--font-mono)'
          : 'var(--font-sans)',
      lineHeight: String(options.lineHeight),
      caretColor: 'var(--accent-primary)',
      padding: '0',
      minHeight: 'calc(100vh - 64px)',
      paddingBottom: '120px',
    },
    '.cm-line': {
      padding: '0',
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--accent-primary)',
      borderLeftWidth: '2px',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'var(--accent-subtle) !important',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'var(--accent-subtle) !important',
    },
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-gutters': {
      display: 'none',
    },
    '.cm-scroller': {
      overflow: 'auto',
      scrollbarWidth: 'thin' as any,
      scrollbarColor: 'var(--border-default) transparent',
    },

    // Placeholder
    '.cm-placeholder': {
      color: 'var(--text-tertiary)',
      opacity: '0.7',
      fontStyle: 'normal',
    },

    // Search
    '.cm-searchMatch': {
      backgroundColor: 'var(--accent-subtle)',
      outline: '1px solid var(--accent-primary)',
    },

    // Panels
    '.cm-panels': {
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--text-primary)',
      borderBottom: '1px solid var(--border-default)',
    },

    // Autocomplete / tooltip
    '.cm-tooltip': {
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
    },
    '.cm-tooltip-autocomplete ul li': {
      padding: '4px 8px',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--text-primary)',
    },

    // === Live Preview markdown styles ===

    // Headings
    '.cm-md-heading1': {
      fontSize: '1.75em',
      fontWeight: '700',
      lineHeight: '1.3',
      color: 'var(--text-primary)',
    },
    '.cm-md-heading2': {
      fontSize: '1.45em',
      fontWeight: '600',
      lineHeight: '1.3',
      color: 'var(--text-primary)',
    },
    '.cm-md-heading3': {
      fontSize: '1.2em',
      fontWeight: '600',
      lineHeight: '1.3',
      color: 'var(--text-primary)',
    },
    '.cm-md-heading4, .cm-md-heading5, .cm-md-heading6': {
      fontSize: '1.05em',
      fontWeight: '600',
      color: 'var(--text-primary)',
    },

    // Heading markers (# symbols) — dim them
    '.cm-md-headingMarker': {
      color: 'var(--text-tertiary)',
      fontWeight: '400',
      fontSize: '0.75em',
    },

    // Bold
    '.cm-md-bold': {
      fontWeight: '700',
    },

    // Italic
    '.cm-md-italic': {
      fontStyle: 'italic',
    },

    // Strikethrough
    '.cm-md-strikethrough': {
      textDecoration: 'line-through',
      color: 'var(--text-tertiary)',
    },

    // Emphasis markers (* _ ~) — dim them
    '.cm-md-emphasisMarker': {
      color: 'var(--text-tertiary)',
      fontSize: '0.85em',
    },

    // Code (inline)
    '.cm-md-inlineCode': {
      fontFamily: 'var(--font-mono)',
      backgroundColor: 'var(--bg-tertiary)',
      borderRadius: '3px',
      padding: '0.1em 0.3em',
      fontSize: '0.9em',
      color: 'var(--md-code-color, var(--text-primary))',
    },

    // Code blocks
    '.cm-md-codeBlock': {
      fontFamily: 'var(--font-mono)',
      backgroundColor: 'var(--bg-tertiary)',
      fontSize: '0.9em',
    },
    '.cm-md-codeFence': {
      color: 'var(--text-tertiary)',
      fontSize: '0.85em',
    },

    // Links
    '.cm-md-link': {
      color: 'var(--accent-primary)',
      textDecoration: 'underline',
      textDecorationColor: 'var(--accent-primary)',
      textUnderlineOffset: '2px',
    },
    '.cm-md-linkMarker': {
      color: 'var(--text-tertiary)',
      fontSize: '0.85em',
    },
    '.cm-md-url': {
      color: 'var(--text-tertiary)',
      fontSize: '0.85em',
    },

    // Blockquotes
    '.cm-md-blockquote': {
      borderLeft: '3px solid var(--border-default)',
      paddingLeft: '12px',
      color: 'var(--text-secondary)',
      fontStyle: 'italic',
    },
    '.cm-md-blockquoteMarker': {
      color: 'var(--text-tertiary)',
    },

    // Lists
    '.cm-md-listMarker': {
      color: 'var(--accent-primary)',
      fontWeight: '600',
    },

    // Horizontal rules
    '.cm-md-hr': {
      borderTop: '1px solid var(--border-default)',
      display: 'block',
      margin: '8px 0',
    },

    // Images (inline widget)
    '.cm-md-image': {
      display: 'block',
      maxWidth: '100%',
      maxHeight: '400px',
      borderRadius: '6px',
      border: '1px solid var(--border-default)',
      margin: '8px 0',
    },
    '.cm-md-imageMarker': {
      color: 'var(--text-tertiary)',
      fontSize: '0.85em',
    },

    // AI Suggestion highlights
    '.cm-suggestion-clarity': {
      backgroundColor: 'var(--highlight-clarity)',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-suggestion-grammar': {
      backgroundColor: 'var(--highlight-grammar)',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-suggestion-style': {
      backgroundColor: 'var(--highlight-style)',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-suggestion-structure': {
      backgroundColor: 'var(--highlight-structure)',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-suggestion-economy': {
      backgroundColor: 'var(--highlight-economy)',
      borderRadius: '2px',
      cursor: 'pointer',
    },
    '.cm-suggestion-active': {
      outline: '2px solid var(--accent-primary)',
    },
  });
}
