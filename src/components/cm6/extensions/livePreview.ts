/**
 * Live Preview extension for CodeMirror 6.
 *
 * Renders inline markdown formatting so the editor behaves like Obsidian's
 * "Live Preview" mode:
 *   - Headings get styled with larger font sizes
 *   - Bold, italic, strikethrough render in place
 *   - Images render as inline `<img>` widgets
 *   - Code blocks get monospace/background styling
 *   - Links show styled text
 *   - Syntax markers (# * ` [ etc.) are dimmed
 *
 * When the cursor is ON a formatted range, the raw markdown is revealed
 * so the user can edit it; when the cursor moves away, the formatted view
 * is restored. This is the key UX that makes it "Obsidian-like".
 */

import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { EditorState, Range, RangeSet } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

// ─── Image widget ────────────────────────────────────────────────────────────

class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
    readonly documentPath: string | null,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return this.src === other.src && this.alt === other.alt;
  }

  toDOM() {
    const wrapper = document.createElement('div');
    wrapper.style.padding = '4px 0';

    const img = document.createElement('img');
    img.className = 'cm-md-image';
    img.alt = this.alt;
    img.loading = 'lazy';

    const src = this.resolvedSrc();
    img.src = src;

    img.onerror = () => {
      wrapper.style.display = 'none';
    };

    wrapper.appendChild(img);
    return wrapper;
  }

  private resolvedSrc(): string {
    const s = this.src;
    if (/^(https?:|data:|blob:|file:)/i.test(s)) return s;

    if (this.documentPath && !s.startsWith('/')) {
      const sep = this.documentPath.includes('\\') ? '\\' : '/';
      const dirEnd = Math.max(
        this.documentPath.lastIndexOf('/'),
        this.documentPath.lastIndexOf('\\'),
      );
      const dir = dirEnd === -1 ? '' : this.documentPath.slice(0, dirEnd);
      const rel = s.replace(/^\.\//, '');
      const absolute = dir ? `${dir}${sep}${rel}` : rel;

      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
          const { convertFileSrc } = require('@tauri-apps/api/core');
          return convertFileSrc(absolute);
        } catch {
          return absolute;
        }
      }
      return absolute;
    }

    if (s.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(s)) {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
          const { convertFileSrc } = require('@tauri-apps/api/core');
          return convertFileSrc(s);
        } catch {
          return s;
        }
      }
    }

    return s;
  }

  ignoreEvent() {
    return false;
  }
}

// ─── Horizontal rule widget ──────────────────────────────────────────────────

class HrWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const hr = document.createElement('hr');
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid var(--border-default)';
    hr.style.margin = '12px 0';
    return hr;
  }
  ignoreEvent() {
    return false;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cursorTouchesRange(
  state: EditorState,
  from: number,
  to: number,
): boolean {
  const sel = state.selection;
  for (const range of sel.ranges) {
    const lineFrom = state.doc.lineAt(from).from;
    const lineTo = state.doc.lineAt(to).to;
    if (range.from <= lineTo && range.to >= lineFrom) return true;
  }
  return false;
}

// ─── Build decorations ──────────────────────────────────────────────────────

function buildDecorations(
  view: EditorView,
  documentPath: string | null,
): DecorationSet {
  const { state } = view;
  const decos: Range<Decoration>[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      const { type, from, to } = node;
      const name = type.name;

      // Don't decorate ranges the cursor is on (reveal raw markdown)
      const cursorOn = cursorTouchesRange(state, from, to);

      // ── ATX Headings ──
      if (name === 'ATXHeading1' || name === 'ATXHeading2' || name === 'ATXHeading3' ||
          name === 'ATXHeading4' || name === 'ATXHeading5' || name === 'ATXHeading6') {
        const level = name.replace('ATXHeading', '');
        if (!cursorOn) {
          // Style the whole heading line
          decos.push(
            Decoration.line({ class: `cm-md-heading${level}` }).range(
              state.doc.lineAt(from).from,
            ),
          );
          // Dim the # markers
          const headMark = node.node.getChild('HeaderMark');
          if (headMark) {
            decos.push(
              Decoration.mark({ class: 'cm-md-headingMarker' }).range(
                headMark.from,
                headMark.to + 1, // include trailing space
              ),
            );
          }
        } else {
          // Cursor is on heading — still style it but show markers normally
          decos.push(
            Decoration.line({ class: `cm-md-heading${level}` }).range(
              state.doc.lineAt(from).from,
            ),
          );
        }
        return true; // descend into children
      }

      // ── Bold (StrongEmphasis) ──
      if (name === 'StrongEmphasis') {
        decos.push(
          Decoration.mark({ class: 'cm-md-bold' }).range(from, to),
        );
        if (!cursorOn) {
          // Dim the ** markers
          for (const child of ['EmphasisMark']) {
            let c = node.node.firstChild;
            while (c) {
              if (c.type.name === child) {
                decos.push(
                  Decoration.mark({ class: 'cm-md-emphasisMarker' }).range(
                    c.from,
                    c.to,
                  ),
                );
              }
              c = c.nextSibling;
            }
          }
        }
        return false;
      }

      // ── Italic (Emphasis) ──
      if (name === 'Emphasis') {
        decos.push(
          Decoration.mark({ class: 'cm-md-italic' }).range(from, to),
        );
        if (!cursorOn) {
          let c = node.node.firstChild;
          while (c) {
            if (c.type.name === 'EmphasisMark') {
              decos.push(
                Decoration.mark({ class: 'cm-md-emphasisMarker' }).range(
                  c.from,
                  c.to,
                ),
              );
            }
            c = c.nextSibling;
          }
        }
        return false;
      }

      // ── Strikethrough ──
      if (name === 'Strikethrough') {
        decos.push(
          Decoration.mark({ class: 'cm-md-strikethrough' }).range(from, to),
        );
        if (!cursorOn) {
          let c = node.node.firstChild;
          while (c) {
            if (c.type.name === 'StrikethroughMark') {
              decos.push(
                Decoration.mark({ class: 'cm-md-emphasisMarker' }).range(
                  c.from,
                  c.to,
                ),
              );
            }
            c = c.nextSibling;
          }
        }
        return false;
      }

      // ── Inline code ──
      if (name === 'InlineCode') {
        decos.push(
          Decoration.mark({ class: 'cm-md-inlineCode' }).range(from, to),
        );
        if (!cursorOn) {
          let c = node.node.firstChild;
          while (c) {
            if (c.type.name === 'CodeMark') {
              decos.push(
                Decoration.mark({ class: 'cm-md-emphasisMarker' }).range(
                  c.from,
                  c.to,
                ),
              );
            }
            c = c.nextSibling;
          }
        }
        return false;
      }

      // ── Fenced code blocks ──
      if (name === 'FencedCode') {
        // Style the entire block
        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(to);
        for (let l = startLine.number; l <= endLine.number; l++) {
          const line = state.doc.line(l);
          decos.push(
            Decoration.line({ class: 'cm-md-codeBlock' }).range(line.from),
          );
        }
        // Dim fence markers
        if (!cursorOn) {
          const codeInfo = node.node.getChild('CodeInfo');
          const codeMark1 = node.node.firstChild;
          const codeMark2 = node.node.lastChild;
          if (codeMark1?.type.name === 'CodeMark') {
            const endPos = codeInfo ? codeInfo.to : codeMark1.to;
            decos.push(
              Decoration.mark({ class: 'cm-md-codeFence' }).range(
                codeMark1.from,
                endPos,
              ),
            );
          }
          if (codeMark2?.type.name === 'CodeMark' && codeMark2 !== codeMark1) {
            decos.push(
              Decoration.mark({ class: 'cm-md-codeFence' }).range(
                codeMark2.from,
                codeMark2.to,
              ),
            );
          }
        }
        return false;
      }

      // ── Links ──
      if (name === 'Link') {
        const linkTextNode = node.node.getChild('LinkLabel') || findChild(node.node, (c) => c.type.name !== 'LinkMark' && c.type.name !== 'URL');
        if (linkTextNode && !cursorOn) {
          decos.push(
            Decoration.mark({ class: 'cm-md-link' }).range(
              linkTextNode.from,
              linkTextNode.to,
            ),
          );
          // Dim the [ ] ( ) and URL
          let c = node.node.firstChild;
          while (c) {
            if (c.type.name === 'LinkMark' || c.type.name === 'URL') {
              decos.push(
                Decoration.mark({ class: 'cm-md-linkMarker' }).range(c.from, c.to),
              );
            }
            c = c.nextSibling;
          }
        }
        return false;
      }

      // ── Images ──
      if (name === 'Image') {
        if (!cursorOn) {
          const urlNode = node.node.getChild('URL');
          const altNode = node.node.getChild('LinkLabel');
          const src = urlNode ? state.doc.sliceString(urlNode.from, urlNode.to) : '';
          const alt = altNode ? state.doc.sliceString(altNode.from, altNode.to) : 'image';

          if (src) {
            // Dim the markdown syntax
            decos.push(
              Decoration.mark({ class: 'cm-md-imageMarker' }).range(from, to),
            );
            // Add image widget after the line
            const lineEnd = state.doc.lineAt(to).to;
            decos.push(
              Decoration.widget({
                widget: new ImageWidget(src, alt, documentPath),
                block: true,
              }).range(lineEnd),
            );
          }
        }
        return false;
      }

      // ── Blockquotes ──
      if (name === 'Blockquote') {
        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(to);
        for (let l = startLine.number; l <= endLine.number; l++) {
          decos.push(
            Decoration.line({ class: 'cm-md-blockquote' }).range(
              state.doc.line(l).from,
            ),
          );
        }
        // Dim the > markers
        if (!cursorOn) {
          let c = node.node.firstChild;
          while (c) {
            if (c.type.name === 'QuoteMark') {
              decos.push(
                Decoration.mark({ class: 'cm-md-blockquoteMarker' }).range(
                  c.from,
                  c.to,
                ),
              );
            }
            c = c.nextSibling;
          }
        }
        return true;
      }

      // ── List markers ──
      if (name === 'ListMark') {
        decos.push(
          Decoration.mark({ class: 'cm-md-listMarker' }).range(from, to),
        );
        return false;
      }

      // ── Horizontal rules ──
      if (name === 'HorizontalRule') {
        if (!cursorOn) {
          decos.push(
            Decoration.replace({
              widget: new HrWidget(),
              block: true,
            }).range(from, to),
          );
        }
        return false;
      }

      return true;
    },
  });

  // Sort decorations by position (required by CM6).
  decos.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide);

  try {
    return RangeSet.of(decos);
  } catch {
    return Decoration.none;
  }
}

function findChild(
  node: { firstChild: any },
  predicate: (child: any) => boolean,
) {
  let c = node.firstChild;
  while (c) {
    if (predicate(c)) return c;
    c = c.nextSibling;
  }
  return null;
}

// ─── ViewPlugin ──────────────────────────────────────────────────────────────

export function livePreview(documentPath: string | null) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      docPath: string | null;

      constructor(view: EditorView) {
        this.docPath = documentPath;
        this.decorations = buildDecorations(view, this.docPath);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged
        ) {
          this.decorations = buildDecorations(update.view, this.docPath);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );
}
