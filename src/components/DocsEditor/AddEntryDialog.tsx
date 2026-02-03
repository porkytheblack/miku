'use client';

import { useState } from 'react';

type EntryType = 'paste' | 'github-file' | 'github-folder';

interface AddEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPasted: (title: string, content: string) => void;
  onAddGitHubFile: (url: string) => Promise<{ success: boolean; error?: string }>;
  onAddGitHubFolder: (url: string, onProgress?: (fetched: number, total: number) => void) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Dialog for adding new documentation entries
 * Supports pasting markdown or importing from GitHub
 */
export default function AddEntryDialog({
  isOpen,
  onClose,
  onAddPasted,
  onAddGitHubFile,
  onAddGitHubFolder,
}: AddEntryDialogProps) {
  const [entryType, setEntryType] = useState<EntryType>('paste');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ fetched: number; total: number } | null>(null);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setUrl('');
    setError(null);
    setProgress(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (entryType === 'paste') {
        if (!content.trim()) {
          setError('Please enter some content');
          setIsLoading(false);
          return;
        }
        onAddPasted(title || 'Untitled', content);
        handleClose();
      } else if (entryType === 'github-file') {
        if (!url.trim()) {
          setError('Please enter a GitHub URL');
          setIsLoading(false);
          return;
        }
        const result = await onAddGitHubFile(url);
        if (result.success) {
          handleClose();
        } else {
          setError(result.error || 'Failed to import file');
        }
      } else if (entryType === 'github-folder') {
        if (!url.trim()) {
          setError('Please enter a GitHub URL');
          setIsLoading(false);
          return;
        }
        const result = await onAddGitHubFolder(url, (fetched, total) => {
          setProgress({ fetched, total });
        });
        if (result.success) {
          handleClose();
        } else {
          setError(result.error || 'Failed to import folder');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: '500px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--spacing-4)',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Add Documentation
          </h2>
          <button
            onClick={handleClose}
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: 'var(--spacing-4)',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Type selector */}
          <div style={{ marginBottom: 'var(--spacing-4)' }}>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 'var(--spacing-2)',
              }}
            >
              Source
            </label>
            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
              {[
                { value: 'paste' as EntryType, label: 'Paste Markdown' },
                { value: 'github-file' as EntryType, label: 'GitHub File' },
                { value: 'github-folder' as EntryType, label: 'GitHub Folder' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setEntryType(option.value)}
                  style={{
                    flex: 1,
                    padding: 'var(--spacing-2) var(--spacing-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: entryType === option.value ? 'var(--accent-primary)' : 'var(--border-default)',
                    background: entryType === option.value ? 'var(--accent-primary-alpha)' : 'var(--bg-secondary)',
                    color: entryType === option.value ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--duration-fast) var(--easing-default)',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paste markdown form */}
          {entryType === 'paste' && (
            <>
              <div style={{ marginBottom: 'var(--spacing-3)' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--spacing-1)',
                  }}
                >
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Document title"
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-2) var(--spacing-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    marginBottom: 'var(--spacing-1)',
                  }}
                >
                  Content
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste your markdown content here..."
                  rows={10}
                  style={{
                    width: '100%',
                    padding: 'var(--spacing-2) var(--spacing-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            </>
          )}

          {/* GitHub URL form */}
          {(entryType === 'github-file' || entryType === 'github-folder') && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  marginBottom: 'var(--spacing-1)',
                }}
              >
                GitHub URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  entryType === 'github-file'
                    ? 'https://github.com/owner/repo/blob/main/README.md'
                    : 'https://github.com/owner/repo/tree/main/docs'
                }
                style={{
                  width: '100%',
                  padding: 'var(--spacing-2) var(--spacing-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  outline: 'none',
                }}
              />
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-tertiary)',
                  marginTop: 'var(--spacing-2)',
                }}
              >
                {entryType === 'github-file'
                  ? 'Paste a link to a markdown file on GitHub'
                  : 'Paste a link to a folder containing markdown files'}
              </p>
            </div>
          )}

          {/* Progress indicator */}
          {progress && (
            <div
              style={{
                marginTop: 'var(--spacing-3)',
                padding: 'var(--spacing-2) var(--spacing-3)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              Fetching files... {progress.fetched}/{progress.total}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              style={{
                marginTop: 'var(--spacing-3)',
                padding: 'var(--spacing-2) var(--spacing-3)',
                background: 'var(--color-red-alpha)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-red)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 'var(--spacing-4)',
            borderTop: '1px solid var(--border-default)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--spacing-2)',
          }}
        >
          <button
            onClick={handleClose}
            disabled={isLoading}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            style={{
              padding: 'var(--spacing-2) var(--spacing-4)',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: isLoading ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
              color: isLoading ? 'var(--text-tertiary)' : 'white',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
