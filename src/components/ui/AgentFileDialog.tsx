'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal';

interface AgentFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, workingDirectory: string) => void;
  defaultWorkingDirectory?: string;
}

export default function AgentFileDialog({
  isOpen,
  onClose,
  onSubmit,
  defaultWorkingDirectory = '',
}: AgentFileDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [workingDirectory, setWorkingDirectory] = useState(defaultWorkingDirectory);
  const [error, setError] = useState<string | null>(null);

  // Reset values when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setWorkingDirectory(defaultWorkingDirectory);
      setError(null);
      // Focus input after modal animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      });
    }
  }, [isOpen, defaultWorkingDirectory]);

  const handleBrowseDirectory = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Working Directory',
        defaultPath: workingDirectory || undefined,
      });
      if (selected && typeof selected === 'string') {
        setWorkingDirectory(selected);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to open directory picker:', err);
    }
  }, [workingDirectory]);

  const handleSubmit = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter a session name');
      return;
    }

    if (/[<>:"/\\|?*]/.test(trimmedName)) {
      setError('Name contains invalid characters');
      return;
    }

    if (!workingDirectory.trim()) {
      setError('Please select a working directory');
      return;
    }

    onSubmit(trimmedName, workingDirectory.trim());
  }, [name, workingDirectory, onSubmit]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      maxWidth="480px"
      showCloseButton={false}
    >
      <div onKeyDown={handleKeyDown}>
        <ModalHeader>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                background: 'var(--accent-subtle)',
                borderRadius: '50%',
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
            </span>
            New Agent Session
          </span>
        </ModalHeader>

        <ModalBody>
          {/* Session Name */}
          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Session Name
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-primary)',
                border: `1px solid ${error && !name.trim() ? '#ef4444' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-sm)',
                transition: 'border-color 0.15s ease',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="my-project"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-sans)',
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <span
                style={{
                  padding: '10px 12px',
                  paddingLeft: 0,
                  color: 'var(--text-tertiary)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-mono)',
                  userSelect: 'none',
                }}
              >
                .miku-agent
              </span>
            </div>
          </div>

          {/* Working Directory */}
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Working Directory
            </label>
            <div
              style={{
                display: 'flex',
                gap: '8px',
              }}
            >
              <input
                type="text"
                value={workingDirectory}
                onChange={(e) => {
                  setWorkingDirectory(e.target.value);
                  setError(null);
                }}
                placeholder="/path/to/project"
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: 'var(--bg-primary)',
                  border: `1px solid ${error && !workingDirectory.trim() ? '#ef4444' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-sm)',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-mono)',
                  transition: 'border-color 0.15s ease',
                }}
              />
              <button
                onClick={handleBrowseDirectory}
                type="button"
                style={{
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-subtle)';
                  e.currentTarget.style.color = 'var(--accent-primary)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Claude will operate in this directory
            </p>
          </div>

          {error && (
            <p
              style={{
                margin: '12px 0 0 0',
                fontSize: '12px',
                color: '#ef4444',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {error}
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <button
            onClick={handleCancel}
            type="button"
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'background 0.1s ease, color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            type="button"
            style={{
              padding: '8px 16px',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: 'pointer',
              transition: 'opacity 0.1s ease',
            }}
          >
            Create
          </button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
