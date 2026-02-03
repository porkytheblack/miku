'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { DocsEditorProvider, useDocsEditor } from '@/context/DocsEditorContext';
import { useDocument } from '@/context/DocumentContext';
import DocsToolbar from './DocsToolbar';
import DocsSidebar from './DocsSidebar';
import DocsViewer from './DocsViewer';
import DocsEmptyState from './DocsEmptyState';
import AddEntryDialog from './AddEntryDialog';

interface DocsEditorInnerProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Inner component that uses the DocsEditor context
 */
function DocsEditorInner({ initialContent, onContentChange }: DocsEditorInnerProps) {
  const {
    state,
    loadContent,
    getContent,
    addPastedEntry,
    addGitHubFileEntry,
    addGitHubFolderEntry,
    removeEntry,
    syncEntry,
    syncAllEntries,
    setActiveEntry,
    toggleEntryExpanded,
    getEntryContent,
    getEntryById,
  } = useDocsEditor();

  const { registerContentGetter, setOriginalContent } = useDocument();

  // Track the serialized form of the initial content
  const baselineContentRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Content viewer state
  const [viewerContent, setViewerContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Check if any entry is currently syncing
  const isSyncing = Array.from(state.syncStatus.values()).some(s => s === 'syncing');

  // Register content getter so DocumentContext can retrieve current content
  useEffect(() => {
    registerContentGetter(getContent);
  }, [registerContentGetter, getContent]);

  // Load initial content - only on mount
  useEffect(() => {
    if (initialContent !== undefined) {
      loadContent(initialContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track if we've already captured baseline to avoid re-running
  const hasInitializedRef = useRef(false);

  // Capture baseline content after the loaded state has been rendered
  // Only capture once when hasLoaded becomes true for the first time
  useEffect(() => {
    if (state.hasLoaded && !hasInitializedRef.current && baselineContentRef.current === null) {
      hasInitializedRef.current = true;
      const baseline = getContent();
      baselineContentRef.current = baseline;
      setOriginalContent(baseline);
      setTimeout(() => setIsInitialized(true), 0);
    }
  }, [state.hasLoaded, getContent, setOriginalContent]);

  // Notify parent of content changes
  // Only trigger when entries actually change (not the whole document object)
  useEffect(() => {
    if (!onContentChange) return;
    if (!isInitialized) return;
    if (baselineContentRef.current === null) return;

    const currentContent = getContent();
    onContentChange(currentContent);
  }, [state.document.entries, getContent, onContentChange, isInitialized]);

  // Load content when active entry changes
  useEffect(() => {
    const loadActiveContent = async () => {
      if (!state.activeEntryId) {
        setViewerContent(null);
        return;
      }

      setIsLoadingContent(true);
      setContentError(null);

      try {
        const content = await getEntryContent(state.activeEntryId, state.activeFileIndex ?? undefined);
        setViewerContent(content);
      } catch (error) {
        setContentError(error instanceof Error ? error.message : 'Failed to load content');
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadActiveContent();
  }, [state.activeEntryId, state.activeFileIndex, getEntryContent]);

  // Get active entry title
  const getActiveTitle = (): string | undefined => {
    if (!state.activeEntryId) return undefined;

    const entry = getEntryById(state.activeEntryId);
    if (!entry) return undefined;

    if (entry.type === 'github-folder' && state.activeFileIndex !== null) {
      const file = entry.files[state.activeFileIndex];
      return file?.title;
    }

    return entry.title;
  };

  // Handle sync all
  const handleSyncAll = useCallback(async () => {
    await syncAllEntries();
  }, [syncAllEntries]);

  // Show empty state if no entries
  const isEmpty = state.document.entries.length === 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
      }}
    >
      <DocsToolbar
        name={state.document.metadata.name}
        entryCount={state.document.entries.length}
        isSyncing={isSyncing}
        onAddEntry={() => setIsAddDialogOpen(true)}
        onSyncAll={handleSyncAll}
      />

      {isEmpty ? (
        <DocsEmptyState onAddEntry={() => setIsAddDialogOpen(true)} />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <DocsSidebar
            entries={state.document.entries}
            activeEntryId={state.activeEntryId}
            activeFileIndex={state.activeFileIndex}
            expandedEntries={state.expandedEntries}
            syncStatus={state.syncStatus}
            onSelectEntry={setActiveEntry}
            onToggleExpanded={toggleEntryExpanded}
            onDeleteEntry={removeEntry}
            onSyncEntry={syncEntry}
          />

          <DocsViewer
            content={viewerContent}
            isLoading={isLoadingContent}
            error={contentError}
            title={getActiveTitle()}
          />
        </div>
      )}

      <AddEntryDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAddPasted={addPastedEntry}
        onAddGitHubFile={addGitHubFileEntry}
        onAddGitHubFolder={addGitHubFolderEntry}
      />
    </div>
  );
}

interface DocsEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Documentation viewer/manager component
 * Provides a UI for viewing and managing documentation in .docs files
 */
export default function DocsEditor({ initialContent, onContentChange }: DocsEditorProps) {
  return (
    <DocsEditorProvider>
      <DocsEditorInner
        initialContent={initialContent}
        onContentChange={onContentChange}
      />
    </DocsEditorProvider>
  );
}
