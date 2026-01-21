'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { isTauri, safeTauriCall, openFile, saveFile, addRecentFile, getRecentFiles } from '@/lib/tauri';

interface DocumentState {
  path: string | null;
  content: string;
  isModified: boolean;
  recentFiles: string[];
}

interface DocumentContextType {
  document: DocumentState;
  setContent: (content: string) => void;
  openDocument: (path?: string) => Promise<void>;
  saveDocument: (path?: string) => Promise<void>;
  newDoc: () => void;
  loadRecentFiles: () => Promise<void>;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [document, setDocument] = useState<DocumentState>({
    path: null,
    content: '',
    isModified: false,
    recentFiles: [],
  });

  const setContent = useCallback((content: string) => {
    setDocument(prev => ({
      ...prev,
      content,
      isModified: true,
    }));
  }, []);

  const loadRecentFiles = useCallback(async () => {
    const files = await safeTauriCall(getRecentFiles, []);
    setDocument(prev => ({ ...prev, recentFiles: files }));
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

      const doc = await openFile(filePath);
      await addRecentFile(filePath);

      setDocument(prev => ({
        ...prev,
        path: doc.path,
        content: doc.content,
        isModified: false,
      }));

      await loadRecentFiles();
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }, [loadRecentFiles]);

  const saveDocument = useCallback(async (path?: string) => {
    if (!isTauri()) {
      // In browser mode, download the file
      const blob = new Blob([document.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.path?.split('/').pop() || 'untitled.md';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    try {
      let filePath = path || document.path;

      if (!filePath) {
        // Use Tauri's dialog to pick a save location
        const { save } = await import('@tauri-apps/plugin-dialog');
        const selected = await save({
          filters: [{
            name: 'Markdown',
            extensions: ['md', 'markdown'],
          }],
          defaultPath: 'untitled.md',
        });

        if (!selected) return;
        filePath = selected;
      }

      await saveFile(filePath, document.content);
      await addRecentFile(filePath);

      setDocument(prev => ({
        ...prev,
        path: filePath,
        isModified: false,
      }));

      await loadRecentFiles();
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }, [document.content, document.path, loadRecentFiles]);

  const newDoc = useCallback(() => {
    setDocument(prev => ({
      ...prev,
      path: null,
      content: '',
      isModified: false,
    }));
  }, []);

  return (
    <DocumentContext.Provider
      value={{
        document,
        setContent,
        openDocument,
        saveDocument,
        newDoc,
        loadRecentFiles,
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
