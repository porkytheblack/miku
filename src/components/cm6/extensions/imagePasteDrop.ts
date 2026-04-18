/**
 * Image paste & drop extension for CodeMirror 6.
 *
 * Intercepts paste and drop events that contain image files, saves
 * them to disk via Tauri, and inserts markdown image references.
 */

import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import {
  buildMarkdownForImage,
  getImageFilesFromClipboard,
  getImageFilesFromDrop,
  getImageUrlsFromDataTransfer,
  persistImageFile,
} from '@/lib/markdown/imageInsertion';

async function insertImageFiles(
  view: EditorView,
  files: File[],
  documentPath: string | null,
) {
  const snippets: string[] = [];
  for (const file of files) {
    try {
      const image = await persistImageFile(file, documentPath);
      snippets.push(buildMarkdownForImage(image));
    } catch (err) {
      console.error('Failed to save pasted/dropped image', err);
    }
  }
  if (snippets.length === 0) return;

  const text = `\n\n${snippets.join('\n\n')}\n\n`;
  const pos = view.state.selection.main.head;
  view.dispatch({
    changes: { from: pos, insert: text },
    selection: EditorSelection.cursor(pos + text.length),
  });
  view.focus();
}

export function imagePasteDropExtension(documentPath: string | null) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = getImageFilesFromClipboard(event.clipboardData);
      if (files.length === 0) return false;
      event.preventDefault();
      void insertImageFiles(view, files, documentPath);
      return true;
    },

    drop(event, view) {
      const dt = event.dataTransfer;
      if (!dt) return false;

      const hasFiles = Array.from(dt.types || []).includes('Files');
      const hasUri = Array.from(dt.types || []).includes('text/uri-list');

      if (hasFiles || hasUri) {
        event.preventDefault();
      }

      const files = getImageFilesFromDrop(dt);
      const urls =
        files.length === 0 ? getImageUrlsFromDataTransfer(dt) : [];
      if (files.length === 0 && urls.length === 0) return false;

      if (files.length > 0) {
        void insertImageFiles(view, files, documentPath);
      } else {
        const snippets = urls.map((url) =>
          buildMarkdownForImage({ alt: 'image', src: url }),
        );
        const pos =
          view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          }) ?? view.state.selection.main.head;
        const text = `\n\n${snippets.join('\n\n')}\n\n`;
        view.dispatch({
          changes: { from: pos, insert: text },
          selection: EditorSelection.cursor(pos + text.length),
        });
      }
      return true;
    },

    dragover(event) {
      const dt = event.dataTransfer;
      if (!dt) return false;
      const hasFiles = Array.from(dt.types || []).includes('Files');
      const hasUri = Array.from(dt.types || []).includes('text/uri-list');
      if (!hasFiles && !hasUri) return false;
      event.preventDefault();
      dt.dropEffect = 'copy';
      return false;
    },
  });
}
