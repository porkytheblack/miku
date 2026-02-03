'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDocument } from '@/context/DocumentContext';
import { isTauri, saveFile } from '@/lib/tauri';

/**
 * Auto-save debounce delay in milliseconds.
 * 500ms provides a good balance between responsiveness and avoiding excessive writes.
 */
const AUTO_SAVE_DEBOUNCE_MS = 500;

/**
 * AutoSaveManager component
 *
 * Handles automatic saving of documents when content changes.
 * Uses a debounced "fire and forget" approach - saves happen automatically
 * without any user intervention needed.
 *
 * Features:
 * - Debounced saves (500ms) to avoid excessive disk writes
 * - Only saves when content actually changes
 * - Only saves documents that have a file path (not new unsaved docs)
 * - Updates document state after successful save (clears modified flag)
 * - Works across all editor types (BlockEditor, KanbanEditor, DocsEditor, EnvEditor)
 *
 * This component should be rendered once at a high level in the app tree,
 * typically alongside the DocumentProvider.
 */
export default function AutoSaveManager() {
  const { openDocuments, markDocumentSaved } = useDocument();

  // Track debounce timers per document
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Track last saved content per document to avoid redundant saves
  const lastSavedContentRef = useRef<Map<string, string>>(new Map());
  // Track documents currently being saved
  const savingDocsRef = useRef<Set<string>>(new Set());

  const performSave = useCallback(async (docId: string, content: string, path: string) => {
    // Skip if already saving this document
    if (savingDocsRef.current.has(docId)) {
      return;
    }

    // Skip if content hasn't changed since last save
    if (lastSavedContentRef.current.get(docId) === content) {
      return;
    }

    // Only save in Tauri environment
    if (!isTauri()) {
      return;
    }

    savingDocsRef.current.add(docId);

    try {
      await saveFile(path, content);
      lastSavedContentRef.current.set(docId, content);
      // Clear the modified indicator after successful save
      markDocumentSaved(docId);
    } catch (error) {
      console.error('[AutoSave] Failed to save document:', error);
    } finally {
      savingDocsRef.current.delete(docId);
    }
  }, [markDocumentSaved]);

  // Watch for content changes in all open documents and handle auto-save
  useEffect(() => {
    // First, initialize any new documents (set their baseline)
    for (const doc of openDocuments) {
      if (doc.path && !lastSavedContentRef.current.has(doc.id)) {
        // Set the initial content as "last saved" so we don't immediately
        // try to save the file when it's first opened
        lastSavedContentRef.current.set(doc.id, doc.content);
      }
    }

    // Cleanup: remove entries for closed documents
    const openDocIds = new Set(openDocuments.map(d => d.id));
    for (const docId of lastSavedContentRef.current.keys()) {
      if (!openDocIds.has(docId)) {
        lastSavedContentRef.current.delete(docId);
        // Also clear any pending timers
        const timer = debounceTimersRef.current.get(docId);
        if (timer) {
          clearTimeout(timer);
          debounceTimersRef.current.delete(docId);
        }
      }
    }

    // Now check for content changes
    for (const doc of openDocuments) {
      // Skip documents without a file path (new/unsaved documents)
      if (!doc.path) {
        continue;
      }

      // Skip if content matches last saved
      if (lastSavedContentRef.current.get(doc.id) === doc.content) {
        continue;
      }

      // Clear existing debounce timer for this document
      const existingTimer = debounceTimersRef.current.get(doc.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set up new debounced save
      const timer = setTimeout(() => {
        performSave(doc.id, doc.content, doc.path!);
        debounceTimersRef.current.delete(doc.id);
      }, AUTO_SAVE_DEBOUNCE_MS);

      debounceTimersRef.current.set(doc.id, timer);
    }
  }, [openDocuments, performSave]);

  // Cleanup all timers on unmount
  useEffect(() => {
    const timers = debounceTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  // This component doesn't render anything - it just manages auto-save
  return null;
}
