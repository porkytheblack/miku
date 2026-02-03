'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastContainer, ToastData, ToastVariant } from '@/components/ui/Toast';

interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastData[];
  toast: (options: ToastOptions | string) => string;
  success: (message: string) => string;
  error: (message: string) => string;
  warning: (message: string) => string;
  info: (message: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DEFAULT_DURATION = 5000;

let toastIdCounter = 0;

function generateToastId(): string {
  return `toast-${++toastIdCounter}-${Date.now()}`;
}

interface ToastProviderProps {
  children: ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxToasts?: number;
}

export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback(
    (options: ToastOptions | string): string => {
      const id = generateToastId();
      const normalizedOptions: ToastOptions =
        typeof options === 'string' ? { message: options } : options;

      const newToast: ToastData = {
        id,
        message: normalizedOptions.message,
        variant: normalizedOptions.variant || 'default',
        duration: normalizedOptions.duration ?? DEFAULT_DURATION,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Remove oldest toasts if exceeding max
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      return id;
    },
    [maxToasts]
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback(
    (message: string) => addToast({ message, variant: 'success' }),
    [addToast]
  );

  const error = useCallback(
    (message: string) => addToast({ message, variant: 'error' }),
    [addToast]
  );

  const warning = useCallback(
    (message: string) => addToast({ message, variant: 'warning' }),
    [addToast]
  );

  const info = useCallback(
    (message: string) => addToast({ message, variant: 'info' }),
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{
        toasts,
        toast: addToast,
        success,
        error,
        warning,
        info,
        dismiss,
        dismissAll,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} position={position} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
