'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { EnvEditorProvider, useEnvEditor } from '@/context/EnvEditorContext';
import { useDocument } from '@/context/DocumentContext';
import { useToast } from '@/context/ToastContext';
import { formatVariableForCopy, formatVariablesForCopy, exportVariables } from '@/lib/envParser';
import type { EnvVariable, EnvExportFormat } from '@/types';
import SecurityBanner from './SecurityBanner';
import EnvToolbar from './EnvToolbar';
import EnvTable from './EnvTable';
import EnvEmptyState from './EnvEmptyState';

interface EnvEditorInnerProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Inner component that uses the EnvEditor context
 */
function EnvEditorInner({ initialContent, onContentChange }: EnvEditorInnerProps) {
  const {
    state,
    filteredVariables,
    loadContent,
    addVariable,
    updateVariable,
    deleteVariables,
    deleteSelected,
    moveVariable,
    duplicateVariable,
    toggleSelected,
    selectAll,
    clearSelection,
    setEditing,
    setSearch,
    toggleShowSecrets,
    getContent,
    importFromClipboard,
  } = useEnvEditor();

  const { success } = useToast();
  const { registerContentGetter, setOriginalContent } = useDocument();

  // Track the serialized form of the initial content (after parsing and re-serializing)
  // This ensures we compare apples-to-apples since raw file content may serialize differently
  const baselineContentRef = useRef<string | null>(null);
  // Track whether initialization is complete (baseline captured and originalContent set)
  // Using state ensures we get a re-render when ready to start tracking changes
  const [isInitialized, setIsInitialized] = useState(false);

  // Register content getter so DocumentContext can retrieve current content on document switch
  // This is critical for preserving content when switching between env files
  useEffect(() => {
    registerContentGetter(getContent);
    // No cleanup needed - the next editor will register its own getter
  }, [registerContentGetter, getContent]);

  // Load initial content - only on mount
  useEffect(() => {
    if (initialContent !== undefined) {
      loadContent(initialContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - initialContent comes from the key prop remount

  // Capture baseline content AFTER the loaded state has been rendered
  // We use state.hasLoaded (set by LOAD_CONTENT action) to know when parsing is complete
  // The baseline is only captured once, when hasLoaded first becomes true
  // Also update DocumentContext's originalContent to match the serialized baseline
  useEffect(() => {
    if (state.hasLoaded && baselineContentRef.current === null) {
      // State has been updated from loadContent, capture the serialized baseline
      const baseline = getContent();
      baselineContentRef.current = baseline;
      // Update DocumentContext's originalContent to the serialized form
      // This ensures setContent comparisons work correctly for undo detection
      setOriginalContent(baseline);
      // Mark as initialized after a microtask to ensure DocumentContext has processed the update
      // Using setTimeout(0) ensures we're in a new event loop tick after React processes the state update
      setTimeout(() => setIsInitialized(true), 0);
    }
  }, [state.hasLoaded, getContent, setOriginalContent]);

  // Notify parent of content changes whenever variables change
  // After full initialization, notify parent so DocumentContext can track modifications
  // DocumentContext compares against originalContent (which we set to the serialized baseline)
  useEffect(() => {
    if (!onContentChange) return;

    // Skip until fully initialized (baseline set AND originalContent updated)
    if (!isInitialized) return;

    // Skip if baseline not set (safety check)
    if (baselineContentRef.current === null) return;

    const currentContent = getContent();

    // Notify parent of content changes
    // DocumentContext's setContent will compare against originalContent to set isModified correctly
    // This handles both:
    // 1. User edits (content differs from baseline -> isModified = true)
    // 2. User undos back to original (content equals baseline -> isModified = false)
    onContentChange(currentContent);
  }, [state.document.variables, getContent, onContentChange, isInitialized]);

  // Copy single variable
  const handleCopyVariable = useCallback((variable: EnvVariable) => {
    const text = formatVariableForCopy(variable);
    navigator.clipboard.writeText(text);
    success('Variable copied to clipboard');
  }, [success]);

  // Copy selected variables
  const handleCopySelected = useCallback(() => {
    const selected = state.document.variables.filter(v => state.selectedIds.has(v.id));
    const text = formatVariablesForCopy(selected);
    navigator.clipboard.writeText(text);
    success(`${selected.length} variable${selected.length !== 1 ? 's' : ''} copied`);
  }, [state.document.variables, state.selectedIds, success]);

  // Copy all variables
  const handleCopyAll = useCallback(() => {
    const text = formatVariablesForCopy(state.document.variables);
    navigator.clipboard.writeText(text);
    success(`${state.document.variables.length} variable${state.document.variables.length !== 1 ? 's' : ''} copied`);
  }, [state.document.variables, success]);

  // Export to file
  const handleExport = useCallback((format: EnvExportFormat) => {
    const text = exportVariables(state.document.variables, format);

    // Determine file extension and MIME type
    const fileConfig: Record<EnvExportFormat, { ext: string; mime: string }> = {
      env: { ext: '.env', mime: 'text/plain' },
      json: { ext: '.json', mime: 'application/json' },
      yaml: { ext: '.yaml', mime: 'text/yaml' },
    };

    const { ext, mime } = fileConfig[format];
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `environment${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    success(`Exported as ${format.toUpperCase()}`);
  }, [state.document.variables, success]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Cmd/Ctrl + A: Select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }

      // Delete/Backspace: Delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedIds.size > 0) {
        e.preventDefault();
        deleteSelected();
      }

      // Escape: Clear selection
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSelection();
        setEditing(null);
      }

      // Cmd/Ctrl + C: Copy selected
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && state.selectedIds.size > 0) {
        e.preventDefault();
        handleCopySelected();
      }

      // Cmd/Ctrl + V: Paste/import
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault();
        importFromClipboard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, deleteSelected, clearSelection, setEditing, state.selectedIds.size, handleCopySelected, importFromClipboard]);

  // Handle delete for single variable
  const handleDeleteVariable = useCallback((id: string) => {
    deleteVariables([id]);
  }, [deleteVariables]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
      }}
    >
      <SecurityBanner />

      <EnvToolbar
        variableCount={state.document.variables.length}
        selectedCount={state.selectedIds.size}
        searchQuery={state.searchQuery}
        showSecrets={state.showSecrets}
        onSearch={setSearch}
        onAddVariable={addVariable}
        onDeleteSelected={deleteSelected}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onToggleSecrets={toggleShowSecrets}
        onCopyAll={handleCopyAll}
        onCopySelected={handleCopySelected}
        onImportFromClipboard={importFromClipboard}
        onExport={handleExport}
      />

      {filteredVariables.length === 0 ? (
        state.searchQuery ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
          >
            No variables match &quot;{state.searchQuery}&quot;
          </div>
        ) : (
          <EnvEmptyState
            onAddVariable={addVariable}
            onImportFromClipboard={importFromClipboard}
          />
        )
      ) : (
        <EnvTable
          variables={filteredVariables}
          selectedIds={state.selectedIds}
          editingId={state.editingId}
          showSecrets={state.showSecrets}
          onToggleSelect={toggleSelected}
          onSetEditing={setEditing}
          onUpdateVariable={updateVariable}
          onDeleteVariable={handleDeleteVariable}
          onDuplicateVariable={duplicateVariable}
          onMoveVariable={moveVariable}
          onCopyVariable={handleCopyVariable}
        />
      )}
    </div>
  );
}

interface EnvEditorProps {
  initialContent?: string;
  onContentChange?: (content: string) => void;
}

/**
 * Environment variable editor component
 * Provides a tabular interface for editing .miku-env files
 * This editor does NOT integrate with AI - it's purely for secure secret management
 */
export default function EnvEditor({ initialContent, onContentChange }: EnvEditorProps) {
  return (
    <EnvEditorProvider>
      <EnvEditorInner
        initialContent={initialContent}
        onContentChange={onContentChange}
      />
    </EnvEditorProvider>
  );
}
