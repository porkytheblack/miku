'use client';

import { useEffect, useRef, useCallback } from 'react';
import { isTauri, saveFile } from '@/lib/tauri';

interface AutoSaveOptions {
  /** Content to save */
  content: string;
  /** File path to save to (null for unsaved documents) */
  filePath: string | null;
  /** Debounce delay in milliseconds (default: 500ms) */
  debounceMs?: number;
  /** Callback when save completes successfully */
  onSaveSuccess?: () => void;
  /** Callback when save fails */
  onSaveError?: (error: Error) => void;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Auto-save hook that automatically saves content to disk when it changes.
 *
 * Features:
 * - Debounced saves to avoid excessive disk writes
 * - Only saves when content actually changes
 * - Only saves when there's a valid file path
 * - Fire and forget - no complex sync logic
 * - Works with Tauri's saveFile command
 *
 * @param options Auto-save configuration options
 */
export function useAutoSave({
  content,
  filePath,
  debounceMs = 500,
  onSaveSuccess,
  onSaveError,
  enabled = true,
}: AutoSaveOptions) {
  // Track the last saved content to avoid unnecessary saves
  const lastSavedContentRef = useRef<string | null>(null);
  // Track the debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Track if a save is currently in progress
  const isSavingRef = useRef(false);
  // Track pending content to save (in case content changes while saving)
  const pendingContentRef = useRef<string | null>(null);

  const performSave = useCallback(async (contentToSave: string, path: string) => {
    // Skip if already saving - queue this content for later
    if (isSavingRef.current) {
      pendingContentRef.current = contentToSave;
      return;
    }

    // Skip if content hasn't changed since last save
    if (lastSavedContentRef.current === contentToSave) {
      return;
    }

    // Only save in Tauri environment
    if (!isTauri()) {
      return;
    }

    isSavingRef.current = true;

    try {
      await saveFile(path, contentToSave);
      lastSavedContentRef.current = contentToSave;
      onSaveSuccess?.();
    } catch (error) {
      console.error('[AutoSave] Failed to save:', error);
      onSaveError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      isSavingRef.current = false;

      // Check if there's pending content to save
      if (pendingContentRef.current !== null && pendingContentRef.current !== contentToSave) {
        const pending = pendingContentRef.current;
        pendingContentRef.current = null;
        // Schedule another save for the pending content
        performSave(pending, path);
      }
    }
  }, [onSaveSuccess, onSaveError]);

  // Main effect to trigger debounced saves
  useEffect(() => {
    // Skip if auto-save is disabled
    if (!enabled) {
      return;
    }

    // Skip if no file path (unsaved document)
    if (!filePath) {
      return;
    }

    // Skip if content matches last saved (optimization)
    if (content === lastSavedContentRef.current) {
      return;
    }

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set up new debounced save
    debounceTimerRef.current = setTimeout(() => {
      performSave(content, filePath);
    }, debounceMs);

    // Cleanup timer on unmount or when dependencies change
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, filePath, debounceMs, enabled, performSave]);

  // Reset last saved content when file path changes (switching files)
  useEffect(() => {
    lastSavedContentRef.current = null;
    pendingContentRef.current = null;
  }, [filePath]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Return a function to force an immediate save if needed
  const saveNow = useCallback(() => {
    if (filePath && content !== lastSavedContentRef.current) {
      // Clear any pending debounced save
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      performSave(content, filePath);
    }
  }, [content, filePath, performSave]);

  return { saveNow };
}
