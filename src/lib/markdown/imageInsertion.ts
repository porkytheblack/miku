/**
 * Helpers for inserting images into the markdown editor.
 *
 * Supports two entry points:
 *   - Pasted clipboard images (ClipboardEvent.clipboardData)
 *   - Dropped files or URLs (DragEvent.dataTransfer)
 *
 * Images are saved to disk via the Tauri `save_image_asset` command when
 * running inside Tauri. In a plain browser fallback, a blob URL is used
 * so the editor still works during `next dev`.
 */

import { isTauri, saveImageAsset } from '@/lib/tauri';

/** Extensions we accept as images. */
const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico', 'heic', 'heif',
]);

export interface InsertableImage {
  /** Markdown alt text. */
  alt: string;
  /** URL or file path to embed in the markdown. */
  src: string;
}

/**
 * Derive a reasonable file extension from a File or URL.
 */
function extensionFromFile(file: File): string {
  const type = file.type || '';
  const match = type.match(/^image\/([a-z0-9.+-]+)/i);
  if (match) {
    // "svg+xml" -> "svg", "jpeg" -> "jpeg"
    return match[1].split('+')[0];
  }
  const name = file.name || '';
  const dot = name.lastIndexOf('.');
  if (dot !== -1 && dot < name.length - 1) {
    return name.slice(dot + 1);
  }
  return 'png';
}

function altFromFile(file: File): string {
  const name = file.name || '';
  if (!name) return 'image';
  const dot = name.lastIndexOf('.');
  const base = dot === -1 ? name : name.slice(0, dot);
  return base.replace(/[\[\]()]/g, '').trim() || 'image';
}

export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  const name = (file.name || '').toLowerCase();
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return IMAGE_EXTENSIONS.has(name.slice(dot + 1));
}

/**
 * Save a File to disk and return the markdown src.
 *
 * In Tauri: writes the bytes to an `assets/` folder next to the current
 * document (or app data dir) and returns a relative path.
 *
 * In a plain browser: creates a blob URL (ephemeral, fine for dev).
 */
export async function persistImageFile(
  file: File,
  documentPath: string | null,
): Promise<InsertableImage> {
  const alt = altFromFile(file);

  if (isTauri()) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const ext = extensionFromFile(file);
    const saved = await saveImageAsset(documentPath, bytes, ext);
    return { alt, src: saved.markdown_path };
  }

  const blobUrl = URL.createObjectURL(file);
  return { alt, src: blobUrl };
}

/**
 * Extract image files from a ClipboardEvent, if any.
 */
export function getImageFilesFromClipboard(
  clipboardData: DataTransfer | null,
): File[] {
  if (!clipboardData) return [];
  const files: File[] = [];

  // Prefer `items` which carry a richer mime type.
  if (clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
  }

  // Fallback to `files` list.
  if (files.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (isImageFile(file)) files.push(file);
    }
  }

  return files;
}

/**
 * Extract image files from a DragEvent.
 */
export function getImageFilesFromDrop(
  dataTransfer: DataTransfer | null,
): File[] {
  if (!dataTransfer) return [];
  const files: File[] = [];
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (isImageFile(file)) files.push(file);
    }
  }
  return files;
}

/**
 * Look for image URLs (e.g. dragged from a browser) inside a DataTransfer.
 * Returns an empty array if none found.
 */
export function getImageUrlsFromDataTransfer(
  dataTransfer: DataTransfer | null,
): string[] {
  if (!dataTransfer) return [];
  const urls: string[] = [];

  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    for (const raw of uriList.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      urls.push(line);
    }
  }

  if (urls.length === 0) {
    const plain = dataTransfer.getData('text/plain');
    if (plain && /^https?:\/\//i.test(plain.trim())) {
      urls.push(plain.trim());
    }
  }

  // Filter to URLs that look like images (by extension).
  return urls.filter((url) => {
    try {
      const { pathname } = new URL(url);
      const dot = pathname.lastIndexOf('.');
      if (dot === -1) return false;
      const ext = pathname.slice(dot + 1).toLowerCase();
      return IMAGE_EXTENSIONS.has(ext);
    } catch {
      return false;
    }
  });
}

/**
 * Build a markdown image snippet.
 */
export function buildMarkdownForImage(image: InsertableImage): string {
  const alt = image.alt.replace(/[\[\]]/g, '');
  // Encode the src path if it contains characters that would break markdown parsing.
  const src = image.src.includes(' ') ? `<${image.src}>` : image.src;
  return `![${alt}](${src})`;
}
