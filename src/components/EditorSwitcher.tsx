'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useDocument } from '@/context/DocumentContext';
import { useMiku } from '@/context/MikuContext';
import { detectFileType } from '@/lib/fileTypes';
import BlockEditor from './BlockEditor';
import EnvEditor from './EnvEditor';

/**
 * EditorSwitcher component
 * Detects the file type of the active document and renders the appropriate editor
 * - .miku-env files -> EnvEditor (no AI, secure)
 * - .md files -> BlockEditor (with AI suggestions)
 *
 * IMPORTANT: Uses key prop to force React to completely remount the editor
 * when switching documents. This ensures complete state isolation between files.
 */
export default function EditorSwitcher() {
  const { openDocuments, activeDocumentId, setContent } = useDocument();
  const { setActiveDocumentId } = useMiku();

  // Get the active document
  const activeDocument = openDocuments.find(d => d.id === activeDocumentId);

  // Sync MikuContext with DocumentContext's active document
  useEffect(() => {
    setActiveDocumentId(activeDocumentId);
  }, [activeDocumentId, setActiveDocumentId]);

  // Detect file type synchronously using useMemo to avoid race conditions
  // when switching documents. This ensures the correct editor renders immediately.
  const fileType = useMemo(() => {
    if (activeDocument) {
      return detectFileType(activeDocument.path, activeDocument.content);
    }
    return 'markdown';
  }, [activeDocument]);

  // Handle content change from EnvEditor
  const handleEnvContentChange = useCallback((content: string) => {
    setContent(content);
  }, [setContent]);

  // Generate a unique key for the editor based on document ID and type
  // This forces React to completely remount the editor when switching documents
  const editorKey = `${activeDocumentId}-${fileType}`;

  // Render appropriate editor based on file type
  if (fileType === 'miku-env') {
    return (
      <EnvEditor
        key={editorKey}
        initialContent={activeDocument?.content}
        onContentChange={handleEnvContentChange}
      />
    );
  }

  // Default to BlockEditor for markdown files
  // Using key prop ensures complete state isolation when switching documents
  return <BlockEditor key={editorKey} />;
}
