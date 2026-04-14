'use client';

/**
 * Renders thumbnail previews for images embedded in the markdown content,
 * aligned vertically with the `![alt](src)` syntax in the textarea.
 *
 * The layer is positioned over the editor, but thumbnails are floated into
 * the right gutter so they don't obscure text. The layer scrolls in sync
 * with the textarea.
 */

import { useEffect, useMemo, useState } from 'react';
import { isTauri } from '@/lib/tauri';

interface ParsedImage {
  /** Unique key for React (combines position + src). */
  key: string;
  /** Zero-based line index the image syntax starts on. */
  line: number;
  /** Alt text. */
  alt: string;
  /** Raw src as written in the markdown. */
  src: string;
}

interface ImagePreviewLayerProps {
  content: string;
  documentPath: string | null;
  scrollTop: number;
  lineHeightPx: number;
}

function parseImages(content: string): ParsedImage[] {
  const out: ParsedImage[] = [];
  if (!content) return out;

  // Pre-compute line start offsets to find line index for a position.
  const lineStarts: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10 /* \n */) {
      lineStarts.push(i + 1);
    }
  }

  // Match markdown image syntax. Created per call so we don't share
  // `lastIndex` across concurrent renders. Intentionally simple.
  const re = /!\[([^\]\n]*)\]\(<([^>\n]+)>\)|!\[([^\]\n]*)\]\(([^)\s\n]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const alt = (match[1] ?? match[3] ?? '').trim();
    const src = (match[2] ?? match[4] ?? '').trim();
    if (!src) continue;

    const start = match.index;
    // Binary search for the line index.
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1;
      if (lineStarts[mid] <= start) lo = mid;
      else hi = mid - 1;
    }

    out.push({
      key: `${start}:${src}`,
      line: lo,
      alt,
      src,
    });
  }
  return out;
}

function isAbsoluteUrl(src: string): boolean {
  return /^(https?:|data:|blob:|file:)/i.test(src);
}

function isWindowsAbsolute(src: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(src);
}

/**
 * Resolve a markdown image src to a URL the browser can load.
 *
 * - Absolute URLs (http, data, blob, file) pass through.
 * - Relative paths are joined with the document's directory.
 * - Absolute filesystem paths are converted via Tauri's `convertFileSrc`.
 */
function useResolvedSrc(src: string, documentPath: string | null): string | null {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (!src) {
        setResolved(null);
        return;
      }

      if (isAbsoluteUrl(src)) {
        setResolved(src);
        return;
      }

      // Determine absolute filesystem path.
      let absolute: string | null = null;
      if (src.startsWith('/') || isWindowsAbsolute(src)) {
        absolute = src;
      } else if (documentPath) {
        // Join with document directory.
        const sep = documentPath.includes('\\') && !documentPath.includes('/') ? '\\' : '/';
        const dirEnd = Math.max(documentPath.lastIndexOf('/'), documentPath.lastIndexOf('\\'));
        const dir = dirEnd === -1 ? '' : documentPath.slice(0, dirEnd);
        // Normalize any "./" prefix
        const rel = src.replace(/^\.\//, '');
        absolute = dir ? `${dir}${sep}${rel}` : rel;
      }

      if (!absolute) {
        setResolved(null);
        return;
      }

      if (isTauri()) {
        try {
          const { convertFileSrc } = await import('@tauri-apps/api/core');
          if (!cancelled) setResolved(convertFileSrc(absolute));
        } catch {
          if (!cancelled) setResolved(null);
        }
      } else {
        if (!cancelled) setResolved(absolute);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [src, documentPath]);

  return resolved;
}

function Thumbnail({
  image,
  top,
  documentPath,
}: {
  image: ParsedImage;
  top: number;
  documentPath: string | null;
}) {
  const resolved = useResolvedSrc(image.src, documentPath);
  const [errored, setErrored] = useState(false);

  if (!resolved || errored) {
    return null;
  }

  return (
    <div
      className="image-preview-thumb"
      style={{
        position: 'absolute',
        top: `${top}px`,
        right: '0',
        maxWidth: '200px',
        maxHeight: '140px',
      }}
    >
      <img
        src={resolved}
        alt={image.alt}
        onError={() => setErrored(true)}
        style={{
          display: 'block',
          maxWidth: '200px',
          maxHeight: '140px',
          borderRadius: '6px',
          border: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.08))',
          background: 'var(--bg-secondary)',
        }}
      />
    </div>
  );
}

export default function ImagePreviewLayer({
  content,
  documentPath,
  scrollTop,
  lineHeightPx,
}: ImagePreviewLayerProps) {
  const images = useMemo(() => parseImages(content), [content]);

  if (images.length === 0 || lineHeightPx <= 0) return null;

  return (
    <div
      aria-hidden
      className="image-preview-layer"
      style={{
        position: 'absolute',
        top: -scrollTop,
        left: 0,
        right: 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      {images.map((img) => (
        <Thumbnail
          key={img.key}
          image={img}
          top={img.line * lineHeightPx}
          documentPath={documentPath}
        />
      ))}
    </div>
  );
}
