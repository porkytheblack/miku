'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import markdown preview to avoid SSR issues
const MarkdownPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then(mod => mod.default),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--text-tertiary)',
        }}
      >
        Loading preview...
      </div>
    ),
  }
);

interface DocsViewerProps {
  content: string | null;
  isLoading: boolean;
  error?: string | null;
  title?: string;
}

/**
 * Markdown viewer component for documentation content
 */
export default function DocsViewer({ content, isLoading, error, title }: DocsViewerProps) {
  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <div>Loading content...</div>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-8)',
        }}
      >
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-red)"
            strokeWidth={1.5}
            style={{ margin: '0 auto 16px' }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 500,
              color: 'var(--text-primary)',
              marginBottom: '8px',
            }}
          >
            Failed to load content
          </h3>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        Select a document to view
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--bg-primary)',
      }}
    >
      {title && (
        <div
          style={{
            padding: 'var(--spacing-4) var(--spacing-6)',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-secondary)',
          }}
        >
          <h1
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>
      )}
      <div
        className="docs-viewer-content"
        style={{
          padding: 'var(--spacing-6)',
          maxWidth: '800px',
          margin: '0 auto',
        }}
      >
        <MarkdownPreview
          source={content}
          style={{
            background: 'transparent',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-base)',
            lineHeight: 1.7,
          }}
        />
      </div>

      <style>{`
        .docs-viewer-content .wmde-markdown {
          background: transparent !important;
        }
        .docs-viewer-content .wmde-markdown h1,
        .docs-viewer-content .wmde-markdown h2,
        .docs-viewer-content .wmde-markdown h3,
        .docs-viewer-content .wmde-markdown h4,
        .docs-viewer-content .wmde-markdown h5,
        .docs-viewer-content .wmde-markdown h6 {
          color: var(--text-primary);
          border-bottom-color: var(--border-default);
        }
        .docs-viewer-content .wmde-markdown p,
        .docs-viewer-content .wmde-markdown li {
          color: var(--text-secondary);
        }
        .docs-viewer-content .wmde-markdown a {
          color: var(--accent-primary);
        }
        .docs-viewer-content .wmde-markdown code {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
        .docs-viewer-content .wmde-markdown pre {
          background: var(--bg-secondary) !important;
        }
        .docs-viewer-content .wmde-markdown blockquote {
          border-left-color: var(--border-default);
          color: var(--text-tertiary);
        }
        .docs-viewer-content .wmde-markdown table th,
        .docs-viewer-content .wmde-markdown table td {
          border-color: var(--border-default);
        }
        .docs-viewer-content .wmde-markdown hr {
          background-color: var(--border-default);
        }
      `}</style>
    </div>
  );
}
