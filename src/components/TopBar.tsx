'use client';

import { useDocument } from '@/context/DocumentContext';

export default function TopBar() {
  const { openDocuments, activeDocumentId, switchToDocument, closeDocument, newDoc } = useDocument();

  // Get display name for a document
  const getDocumentName = (doc: { path: string | null; isModified: boolean }) => {
    if (doc.path) {
      const fileName = doc.path.split('/').pop() || 'Untitled';
      return doc.isModified ? `${fileName} *` : fileName;
    }
    return doc.isModified ? 'Untitled *' : 'Untitled';
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '36px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
        paddingLeft: '8px',
        paddingRight: '8px',
        gap: '2px',
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Document tabs */}
      {openDocuments.map((doc) => (
        <div
          key={doc.id}
          onClick={() => switchToDocument(doc.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: doc.id === activeDocumentId ? 'var(--bg-tertiary)' : 'transparent',
            color: doc.id === activeDocumentId ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: doc.id === activeDocumentId ? 500 : 400,
            whiteSpace: 'nowrap',
            transition: 'background 0.15s ease',
          }}
        >
          {/* Document icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, opacity: 0.7 }}
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>

          {/* Document name */}
          <span>{getDocumentName(doc)}</span>

          {/* Close button */}
          {openDocuments.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeDocument(doc.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                borderRadius: '2px',
                color: 'var(--text-tertiary)',
                marginLeft: '2px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-primary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 1l8 8M9 1L1 9" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {/* New tab button */}
      <button
        onClick={newDoc}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          padding: 0,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-tertiary)',
          marginLeft: '4px',
        }}
        title="New document (Cmd+N)"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M7 1v12M1 7h12" />
        </svg>
      </button>
    </div>
  );
}
