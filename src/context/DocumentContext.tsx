'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { isTauri, safeTauriCall, openFile, saveFile, addRecentFile, getRecentFiles } from '@/lib/tauri';

interface OpenDocument {
  id: string;
  path: string | null;
  content: string;
  originalContent: string; // Content when file was opened or last saved
  isModified: boolean;
}

interface DocumentState {
  path: string | null;
  content: string;
  isModified: boolean;
  recentFiles: string[];
}

interface DocumentContextType {
  document: DocumentState;
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
  setContent: (content: string) => void;
  setOriginalContent: (content: string) => void;
  openDocument: (path?: string) => Promise<void>;
  saveDocument: (path?: string) => Promise<void>;
  newDoc: () => void;
  loadRecentFiles: () => Promise<void>;
  switchToDocument: (id: string, currentContent?: string) => void;
  closeDocument: (id: string, currentContent?: string) => void;
  registerContentGetter: (getter: () => string) => void;
  getEditorContent: () => string;
  /** Mark a document as saved (updates originalContent to match current content) */
  markDocumentSaved: (docId: string) => void;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

// Generate unique ID for documents
let docIdCounter = 0;
function generateDocId(): string {
  return `doc-${++docIdCounter}-${Date.now()}`;
}

// Extract a suggested filename from document content
function getSuggestedFilename(content: string): string {
  if (!content.trim()) return 'untitled.md';

  // Try to find a markdown heading (# Title)
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return slugify(headingMatch[1]) + '.md';
  }

  // Fall back to the first non-empty line
  const firstLine = content.split('\n').find(line => line.trim().length > 0);
  if (firstLine) {
    // Truncate to reasonable length and slugify
    const truncated = firstLine.trim().slice(0, 50);
    return slugify(truncated) + '.md';
  }

  return 'untitled.md';
}

// Convert a string to a safe filename
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[#*`\[\]()]/g, '') // Remove markdown characters
    .replace(/[^\w\s-]/g, '') // Remove non-word characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .slice(0, 50) // Limit length
    || 'untitled';
}

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([
    { id: generateDocId(), path: null, content: '', originalContent: '', isModified: false }
  ]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(openDocuments[0]?.id || null);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);

  // Ref to hold the content getter function from BlockEditor
  const contentGetterRef = useRef<(() => string) | null>(null);

  const registerContentGetter = useCallback((getter: () => string) => {
    contentGetterRef.current = getter;
  }, []);

  const getEditorContent = useCallback((): string => {
    if (contentGetterRef.current) {
      return contentGetterRef.current();
    }
    // Fallback to context content if no getter registered
    const activeDoc = openDocuments.find(d => d.id === activeDocumentId);
    return activeDoc?.content || '';
  }, [openDocuments, activeDocumentId]);

  // Get the active document
  const activeDocument = openDocuments.find(d => d.id === activeDocumentId);

  // Legacy document state for backward compatibility
  const document: DocumentState = {
    path: activeDocument?.path || null,
    content: activeDocument?.content || '',
    isModified: activeDocument?.isModified || false,
    recentFiles,
  };

  const setContent = useCallback((content: string) => {
    if (!activeDocumentId) return;
    setOpenDocuments(prev => prev.map(doc =>
      doc.id === activeDocumentId
        ? {
            ...doc,
            content,
            // Only mark as modified if content differs from original
            // This properly handles undo back to original state
            isModified: content !== doc.originalContent
          }
        : doc
    ));
  }, [activeDocumentId]);

  // Update the original content baseline for the active document
  // This is used by editors (like EnvEditor) that transform content during load,
  // so the "original" baseline matches the serialized form rather than raw file content
  const setOriginalContent = useCallback((content: string) => {
    if (!activeDocumentId) return;
    setOpenDocuments(prev => prev.map(doc =>
      doc.id === activeDocumentId
        ? { ...doc, originalContent: content }
        : doc
    ));
  }, [activeDocumentId]);

  // Mark a document as saved (for auto-save)
  // This updates originalContent to match current content, clearing the modified flag
  const markDocumentSaved = useCallback((docId: string) => {
    setOpenDocuments(prev => prev.map(doc =>
      doc.id === docId
        ? { ...doc, originalContent: doc.content, isModified: false }
        : doc
    ));
  }, []);

  const loadRecentFiles = useCallback(async () => {
    const files = await safeTauriCall(getRecentFiles, []);
    setRecentFiles(files);
  }, []);

  const openDocument = useCallback(async (path?: string) => {
    if (!isTauri()) {
      // In browser mode, we can't open files from disk
      console.log('File opening not available in browser mode');
      return;
    }

    try {
      let filePath = path;

      if (!filePath) {
        // Use Tauri's dialog to pick a file
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          multiple: false,
          filters: [{
            name: 'Markdown',
            extensions: ['md', 'markdown', 'mdown'],
          }],
        });

        if (!selected) return;
        filePath = selected as string;
      }

      // Check if the file is already open
      const existingDoc = openDocuments.find(d => d.path === filePath);
      if (existingDoc) {
        setActiveDocumentId(existingDoc.id);
        return;
      }

      const doc = await openFile(filePath);
      await addRecentFile(filePath);

      // Create a new document tab
      const newDoc: OpenDocument = {
        id: generateDocId(),
        path: doc.path,
        content: doc.content,
        originalContent: doc.content,
        isModified: false,
      };

      setOpenDocuments(prev => [...prev, newDoc]);
      setActiveDocumentId(newDoc.id);

      await loadRecentFiles();
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }, [openDocuments, loadRecentFiles]);

  const saveDocument = useCallback(async (path?: string) => {
    if (!activeDocument) return;

    // Get a suggested filename based on document content
    const suggestedFilename = activeDocument.path?.split('/').pop() || getSuggestedFilename(activeDocument.content);

    if (!isTauri()) {
      // In browser mode, download the file
      const blob = new Blob([activeDocument.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = suggestedFilename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      let filePath = path || activeDocument.path;

      if (!filePath) {
        // Use Tauri's dialog to pick a save location
        const { save } = await import('@tauri-apps/plugin-dialog');
        const selected = await save({
          filters: [{
            name: 'Markdown',
            extensions: ['md', 'markdown'],
          }],
          defaultPath: suggestedFilename,
        });

        if (!selected) return;
        filePath = selected;
      }

      await saveFile(filePath, activeDocument.content);
      await addRecentFile(filePath);

      setOpenDocuments(prev => prev.map(doc =>
        doc.id === activeDocumentId
          ? { ...doc, path: filePath, originalContent: doc.content, isModified: false }
          : doc
      ));

      await loadRecentFiles();
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [activeDocument, activeDocumentId, loadRecentFiles]);

  const newDoc = useCallback(() => {
    // Save current document's content before switching to new document
    const contentToSave = contentGetterRef.current ? contentGetterRef.current() : undefined;

    const newDocument: OpenDocument = {
      id: generateDocId(),
      path: null,
      content: '',
      originalContent: '',
      isModified: false,
    };

    setOpenDocuments(prev => {
      // First, update the current document's content if we have any
      let updated = prev;
      if (activeDocumentId && contentToSave !== undefined) {
        updated = prev.map(d =>
          d.id === activeDocumentId
            ? { ...d, content: contentToSave, isModified: contentToSave !== d.originalContent }
            : d
        );
      }
      // Then add the new document
      return [...updated, newDocument];
    });

    setActiveDocumentId(newDocument.id);
  }, [activeDocumentId]);

  const switchToDocument = useCallback((id: string, currentContent?: string) => {
    const doc = openDocuments.find(d => d.id === id);
    if (!doc) return;

    // If no content provided, try to get it from the content getter
    const contentToSave = currentContent ?? (contentGetterRef.current ? contentGetterRef.current() : undefined);

    // Save current content to the old document before switching
    if (activeDocumentId && contentToSave !== undefined) {
      setOpenDocuments(prev => prev.map(d =>
        d.id === activeDocumentId
          ? { ...d, content: contentToSave, isModified: contentToSave !== d.originalContent }
          : d
      ));
    }

    setActiveDocumentId(id);
  }, [openDocuments, activeDocumentId]);

  const closeDocument = useCallback((id: string, currentContent?: string) => {
    // If no content provided, try to get it from the content getter
    const contentToSave = currentContent ?? (contentGetterRef.current ? contentGetterRef.current() : undefined);

    // If closing a non-active document and we have current content, save it first
    if (activeDocumentId && activeDocumentId !== id && contentToSave !== undefined) {
      setOpenDocuments(prev => prev.map(d =>
        d.id === activeDocumentId
          ? { ...d, content: contentToSave, isModified: contentToSave !== d.originalContent }
          : d
      ));
    }

    setOpenDocuments(prev => {
      const newDocs = prev.filter(d => d.id !== id);

      // If we closed the active document, switch to another one
      if (id === activeDocumentId && newDocs.length > 0) {
        setActiveDocumentId(newDocs[newDocs.length - 1].id);
      } else if (newDocs.length === 0) {
        // If no documents left, create a new empty one
        const emptyDoc: OpenDocument = {
          id: generateDocId(),
          path: null,
          content: '',
          originalContent: '',
          isModified: false,
        };
        setActiveDocumentId(emptyDoc.id);
        return [emptyDoc];
      }

      return newDocs;
    });
  }, [activeDocumentId]);

  return (
    <DocumentContext.Provider
      value={{
        document,
        openDocuments,
        activeDocumentId,
        setContent,
        setOriginalContent,
        openDocument,
        saveDocument,
        newDoc,
        loadRecentFiles,
        switchToDocument,
        closeDocument,
        registerContentGetter,
        getEditorContent,
        markDocumentSaved,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocument() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used within a DocumentProvider');
  }
  return context;
}
