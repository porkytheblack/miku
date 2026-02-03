'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal';

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  submitLabel?: string;
  cancelLabel?: string;
  suffix?: string;
  validate?: (value: string) => string | null; // Returns error message or null if valid
  isLoading?: boolean;
}

export default function InputDialog({
  isOpen,
  onClose,
  onSubmit,
  title = 'Input',
  label,
  placeholder = '',
  defaultValue = '',
  submitLabel = 'Create',
  cancelLabel = 'Cancel',
  suffix,
  validate,
  isLoading = false,
}: InputDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  // Reset value when dialog opens
  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setError(null);
      // Focus input after modal animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
      });
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = useCallback(() => {
    if (isLoading) return;

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setError('Please enter a value');
      return;
    }

    if (validate) {
      const validationError = validate(trimmedValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    onSubmit(trimmedValue);
  }, [value, validate, onSubmit, isLoading]);

  const handleCancel = useCallback(() => {
    if (!isLoading) {
      onClose();
    }
  }, [onClose, isLoading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, isLoading]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setError(null);
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      maxWidth="400px"
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
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            {title}
          </span>
        </ModalHeader>

        <ModalBody>
          {label && (
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
              {label}
            </label>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-primary)',
              border: `1px solid ${error ? '#ef4444' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              transition: 'border-color 0.15s ease',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              disabled={isLoading}
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
            {suffix && (
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
                {suffix}
              </span>
            )}
          </div>
          {error && (
            <p
              style={{
                margin: '8px 0 0 0',
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
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1,
              transition: 'background 0.1s ease, color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'opacity 0.1s ease',
            }}
          >
            {isLoading && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  animation: 'spin 1s linear infinite',
                }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            {submitLabel}
          </button>
        </ModalFooter>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Modal>
  );
}
