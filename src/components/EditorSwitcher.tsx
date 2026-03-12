'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDocument } from '@/context/DocumentContext';
import { useMiku } from '@/context/MikuContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useRemote } from '@/context/RemoteContext';
import { detectFileType } from '@/lib/fileTypes';
import BlockEditor from './BlockEditor';
import EnvEditor from './EnvEditor';
import KanbanEditor from './KanbanEditor';
import DocsEditor from './DocsEditor';
import MikuConfigEditor from './MikuConfigEditor';
import AgentChatEditor from './AgentChatEditor';
import RemoteStatusBoard from './RemoteStatusBoard';

/**
 * EditorSwitcher component
 * Detects the file type of the active document and renders the appropriate editor.
 *
 * Agent chat editors are kept mounted (but hidden) when switching tabs so that
 * the AcpClient connection and chat history stay alive in the background.
 * All other editor types use key-based remounting for state isolation.
 */
export default function EditorSwitcher() {
  const { openDocuments, activeDocumentId, setContent, setContentForDocument, openDocument } = useDocument();
  const { setActiveDocumentId } = useMiku();
  const { workspace } = useWorkspace();
  const { remote, clearPendingAgentChat } = useRemote();

  // Show the remote status board when workspace is remote and no document is open
  const isRemoteWorkspace = !!workspace.currentWorkspace?.remote;
  const hasNoDocuments = openDocuments.length === 0;

  // Auto-open agent chat file when the remote context signals one is ready
  const pendingChatRef = useRef<string | null>(null);
  useEffect(() => {
    const path = remote.pendingAgentChatPath;
    if (path && path !== pendingChatRef.current) {
      pendingChatRef.current = path;
      openDocument(path).then(() => {
        clearPendingAgentChat();
      }).catch(console.error);
    }
  }, [remote.pendingAgentChatPath, openDocument, clearPendingAgentChat]);

  // Get the active document
  const activeDocument = openDocuments.find(d => d.id === activeDocumentId);

  // Sync MikuContext with DocumentContext's active document
  useEffect(() => {
    setActiveDocumentId(activeDocumentId);
  }, [activeDocumentId, setActiveDocumentId]);

  // Detect file type synchronously using useMemo to avoid race conditions
  const fileType = useMemo(() => {
    if (activeDocument) {
      return detectFileType(activeDocument.path, activeDocument.content);
    }
    return 'markdown';
  }, [activeDocument]);

  // Handle content change from the active non-agent-chat editor
  const handleContentChange = useCallback((content: string) => {
    setContent(content);
  }, [setContent]);

  // Generate a unique key for the editor based on document ID and type
  const editorKey = `${activeDocumentId}-${fileType}`;

  // Collect all open agent-chat documents (kept mounted for background persistence)
  const agentChatDocs = useMemo(() =>
    openDocuments.filter(d => {
      const ft = detectFileType(d.path, d.content);
      return ft === 'agent-chat';
    }),
    [openDocuments]
  );

  // Render the active non-agent-chat editor
  const renderActiveEditor = () => {
    if (fileType === 'agent-chat') return null; // Handled by persistent layer

    if (fileType === 'miku-env') {
      return (
        <EnvEditor
          key={editorKey}
          initialContent={activeDocument?.content}
          onContentChange={handleContentChange}
        />
      );
    }

    if (fileType === 'kanban') {
      return (
        <KanbanEditor
          key={editorKey}
          initialContent={activeDocument?.content}
          onContentChange={handleContentChange}
        />
      );
    }

    if (fileType === 'docs') {
      return (
        <DocsEditor
          key={editorKey}
          initialContent={activeDocument?.content}
          onContentChange={handleContentChange}
        />
      );
    }

    if (fileType === 'miku-config') {
      return (
        <MikuConfigEditor
          key={editorKey}
          initialContent={activeDocument?.content}
          onContentChange={handleContentChange}
        />
      );
    }

    // Default to BlockEditor for markdown files
    return <BlockEditor key={editorKey} />;
  };

  // When in a remote workspace with no documents open, show the status dashboard
  if (isRemoteWorkspace && hasNoDocuments) {
    return <RemoteStatusBoard />;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Persistent agent chat editors - stay mounted, hidden when inactive */}
      {agentChatDocs.map(doc => (
        <PersistentAgentChat
          key={doc.id}
          docId={doc.id}
          isActive={doc.id === activeDocumentId}
          initialContent={doc.content}
          setContentForDocument={setContentForDocument}
        />
      ))}

      {/* Active non-agent-chat editor */}
      {fileType !== 'agent-chat' && renderActiveEditor()}
    </div>
  );
}

/**
 * Wrapper that provides a stable, document-scoped onContentChange callback
 * so background agent chats write to the correct document.
 */
function PersistentAgentChat({
  docId,
  isActive,
  initialContent,
  setContentForDocument,
}: {
  docId: string;
  isActive: boolean;
  initialContent: string;
  setContentForDocument: (docId: string, content: string) => void;
}) {
  const handleContentChange = useCallback((content: string) => {
    setContentForDocument(docId, content);
  }, [docId, setContentForDocument]);

  return (
    <div
      style={{
        position: isActive ? 'relative' : 'absolute',
        top: 0, left: 0, width: '100%', height: '100%',
        visibility: isActive ? 'visible' : 'hidden',
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 1 : 0,
      }}
    >
      <AgentChatEditor
        initialContent={initialContent}
        onContentChange={handleContentChange}
      />
    </div>
  );
}
