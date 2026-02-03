'use client';

import { useEffect, useState, useCallback } from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const variantStyles: Record<
  ToastVariant,
  {
    background: string;
    borderColor: string;
    iconColor: string;
    icon: React.ReactNode;
  }
> = {
  default: {
    background: 'var(--bg-secondary)',
    borderColor: 'var(--border-default)',
    iconColor: 'var(--text-secondary)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
  success: {
    background: 'var(--bg-secondary)',
    borderColor: '#22c55e',
    iconColor: '#22c55e',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  error: {
    background: 'var(--bg-secondary)',
    borderColor: '#ef4444',
    iconColor: '#ef4444',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  warning: {
    background: 'var(--bg-secondary)',
    borderColor: '#f59e0b',
    iconColor: '#f59e0b',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    background: 'var(--bg-secondary)',
    borderColor: '#3b82f6',
    iconColor: '#3b82f6',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
};

function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Set up auto-dismiss
    if (toast.duration > 0) {
      const timeout = setTimeout(() => {
        handleDismiss();
      }, toast.duration);

      return () => clearTimeout(timeout);
    }
  }, [toast.duration]);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 150);
  }, [onDismiss, toast.id]);

  const style = variantStyles[toast.variant];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 16px',
        background: style.background,
        border: `1px solid ${style.borderColor}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: '280px',
        maxWidth: '400px',
        opacity: isVisible && !isExiting ? 1 : 0,
        transform: isVisible && !isExiting ? 'translateX(0)' : 'translateX(100%)',
        transition: 'opacity 0.15s ease, transform 0.15s ease',
        pointerEvents: 'auto',
      }}
      role="alert"
    >
      {/* Icon */}
      <span
        style={{
          color: style.iconColor,
          flexShrink: 0,
          marginTop: '2px',
        }}
      >
        {style.icon}
      </span>

      {/* Message */}
      <p
        style={{
          flex: 1,
          margin: 0,
          fontSize: '14px',
          lineHeight: '1.5',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          wordBreak: 'break-word',
        }}
      >
        {toast.message}
      </p>

      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        style={{
          padding: '2px',
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--text-tertiary)',
          flexShrink: 0,
          transition: 'color 0.1s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)';
        }}
        aria-label="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 1l10 10M11 1L1 11" />
        </svg>
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export function ToastContainer({
  toasts,
  onDismiss,
  position = 'bottom-right',
}: ToastContainerProps) {
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-right': { top: '16px', right: '16px' },
    'top-left': { top: '16px', left: '16px' },
    'bottom-right': { bottom: '16px', right: '16px' },
    'bottom-left': { bottom: '16px', left: '16px' },
  };

  const isBottom = position.startsWith('bottom');

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 300,
        display: 'flex',
        flexDirection: isBottom ? 'column-reverse' : 'column',
        gap: '8px',
        pointerEvents: 'none',
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        ...positionStyles[position],
      }}
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default Toast;
