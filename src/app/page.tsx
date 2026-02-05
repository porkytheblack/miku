'use client';

import { useState, useCallback, useEffect } from 'react';
import EditorSwitcher from "@/components/EditorSwitcher";
import FloatingBar from "@/components/FloatingBar";
import WorkspaceSelector from "@/components/WorkspaceSelector";
import FileBrowser from "@/components/FileBrowser";
import TopBar from "@/components/TopBar";
import SoundNotifier from "@/components/SoundNotifier";
import CommandPalette from "@/components/CommandPalette";
import GlobalSearch from "@/components/GlobalSearch";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import InputDialog from "@/components/ui/InputDialog";
import UpdateNotification from "@/components/ui/UpdateNotification";
import SettingsPanel from "@/components/SettingsPanel";
import AutoSaveManager from "@/components/AutoSaveManager";
import ExternalLinkHandler from "@/components/ExternalLinkHandler";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useDocument } from "@/context/DocumentContext";

interface PendingConfirm {
  message: string;
  onConfirm: () => void;
}

export default function Home() {
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [isEnvFileDialogOpen, setIsEnvFileDialogOpen] = useState(false);
  const [isKanbanFileDialogOpen, setIsKanbanFileDialogOpen] = useState(false);
  const [isDocsFileDialogOpen, setIsDocsFileDialogOpen] = useState(false);

  const { workspace, createFile } = useWorkspace();
  const { openDocument, openDocuments, switchToDocument } = useDocument();

  // Toggle file browser with Cmd+B
  const handleToggleFileBrowser = useCallback(() => {
    setIsFileBrowserOpen(prev => !prev);
  }, []);

  // Toggle command palette with Cmd+K
  const handleToggleCommandPalette = useCallback(() => {
    setIsCommandPaletteOpen(prev => !prev);
  }, []);

  // Handle settings toggle (triggered from command palette)
  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  // Handle help toggle (triggered from command palette)
  const handleToggleHelp = useCallback(() => {
    setIsHelpOpen(true);
  }, []);

  // Handle confirm dialog request from file browser
  const handleRequestConfirm = useCallback((message: string, onConfirm: () => void) => {
    setPendingConfirm({ message, onConfirm });
  }, []);

  // Handle confirm dialog close
  const handleCloseConfirm = useCallback(() => {
    setPendingConfirm(null);
  }, []);

  // Handle confirm dialog confirm
  const handleConfirm = useCallback(() => {
    if (pendingConfirm) {
      pendingConfirm.onConfirm();
      setPendingConfirm(null);
    }
  }, [pendingConfirm]);

  // Handle env file name request from command palette
  const handleRequestEnvFileName = useCallback(() => {
    setIsEnvFileDialogOpen(true);
  }, []);

  // Handle env file creation
  const handleCreateEnvFile = useCallback(async (name: string) => {
    if (workspace.currentWorkspace) {
      // Ensure the filename ends with .miku-env
      const fileName = name.endsWith('.miku-env') ? name : `${name}.miku-env`;
      const filePath = await createFile(fileName, workspace.currentWorkspace.path);
      if (filePath) {
        await openDocument(filePath);
      }
    }
    setIsEnvFileDialogOpen(false);
  }, [workspace.currentWorkspace, createFile, openDocument]);

  // Handle kanban file name request from command palette
  const handleRequestKanbanFileName = useCallback(() => {
    setIsKanbanFileDialogOpen(true);
  }, []);

  // Handle kanban file creation
  const handleCreateKanbanFile = useCallback(async (name: string) => {
    if (workspace.currentWorkspace) {
      // Ensure the filename ends with .kanban
      const fileName = name.endsWith('.kanban') ? name : `${name}.kanban`;
      const filePath = await createFile(fileName, workspace.currentWorkspace.path);
      if (filePath) {
        await openDocument(filePath);
      }
    }
    setIsKanbanFileDialogOpen(false);
  }, [workspace.currentWorkspace, createFile, openDocument]);

  // Handle docs file name request from command palette
  const handleRequestDocsFileName = useCallback(() => {
    setIsDocsFileDialogOpen(true);
  }, []);

  // Handle docs file creation
  const handleCreateDocsFile = useCallback(async (name: string) => {
    if (workspace.currentWorkspace) {
      // Ensure the filename ends with .docs
      const fileName = name.endsWith('.docs') ? name : `${name}.docs`;
      const filePath = await createFile(fileName, workspace.currentWorkspace.path);
      if (filePath) {
        await openDocument(filePath);
      }
    }
    setIsDocsFileDialogOpen(false);
  }, [workspace.currentWorkspace, createFile, openDocument]);

  // Register global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }

      // Cmd+P: Global search
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setIsGlobalSearchOpen(prev => !prev);
      }

      // Cmd+\: Toggle file browser (backslash like Atom)
      // No Shift required, doesn't conflict with browser shortcuts
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setIsFileBrowserOpen(prev => !prev);
      }

      // Cmd+1 through Cmd+9: Switch to tab by position
      // This is a common pattern in browsers and code editors
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        const tabIndex = parseInt(e.key, 10) - 1; // Convert to 0-based index
        if (tabIndex < openDocuments.length) {
          e.preventDefault();
          switchToDocument(openDocuments[tabIndex].id);
        }
      }

      // Cmd+,: Toggle settings (standard Mac shortcut for preferences)
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openDocuments, switchToDocument]);

  return (
    <main className="relative h-screen flex flex-col overflow-hidden">
      <ExternalLinkHandler />
      <AutoSaveManager />
      <SoundNotifier />
      <UpdateNotification />
      <WorkspaceSelector />
      <TopBar
        onToggleFileBrowser={handleToggleFileBrowser}
        onToggleCommandPalette={handleToggleCommandPalette}
        onToggleSettings={handleToggleSettings}
      />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <FileBrowser
          isOpen={isFileBrowserOpen}
          onClose={() => setIsFileBrowserOpen(false)}
          onRequestConfirm={handleRequestConfirm}
        />
        <div className="flex-1 overflow-auto min-h-0">
          <EditorSwitcher />
        </div>
      </div>
      <FloatingBar
        onToggleFileBrowser={handleToggleFileBrowser}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onToggleFileBrowser={handleToggleFileBrowser}
        onToggleSettings={handleToggleSettings}
        onToggleHelp={handleToggleHelp}
        onRequestEnvFileName={handleRequestEnvFileName}
        onRequestKanbanFileName={handleRequestKanbanFileName}
        onRequestDocsFileName={handleRequestDocsFileName}
        onToggleGlobalSearch={() => {
          setIsCommandPaletteOpen(false);
          setIsGlobalSearchOpen(true);
        }}
      />

      {/* Global Search */}
      <GlobalSearch
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
      />

      {/* Settings Panel */}
      {isSettingsOpen && (
        <SettingsPanel onClose={() => setIsSettingsOpen(false)} />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={pendingConfirm !== null}
        onClose={handleCloseConfirm}
        onConfirm={handleConfirm}
        title="Delete File"
        message={pendingConfirm?.message || ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* New Env File Dialog */}
      <InputDialog
        isOpen={isEnvFileDialogOpen}
        onClose={() => setIsEnvFileDialogOpen(false)}
        onSubmit={handleCreateEnvFile}
        title="New Environment File"
        label="Enter a name for the environment file"
        placeholder="production"
        defaultValue=""
        suffix=".miku-env"
        submitLabel="Create"
        cancelLabel="Cancel"
        validate={(value) => {
          // Check for invalid characters in filename
          if (/[<>:"/\\|?*]/.test(value)) {
            return 'Filename contains invalid characters';
          }
          return null;
        }}
      />

      {/* New Kanban File Dialog */}
      <InputDialog
        isOpen={isKanbanFileDialogOpen}
        onClose={() => setIsKanbanFileDialogOpen(false)}
        onSubmit={handleCreateKanbanFile}
        title="New Kanban Board"
        label="Enter a name for the kanban board"
        placeholder="project-tasks"
        defaultValue=""
        suffix=".kanban"
        submitLabel="Create"
        cancelLabel="Cancel"
        validate={(value) => {
          if (/[<>:"/\\|?*]/.test(value)) {
            return 'Filename contains invalid characters';
          }
          return null;
        }}
      />

      {/* New Docs File Dialog */}
      <InputDialog
        isOpen={isDocsFileDialogOpen}
        onClose={() => setIsDocsFileDialogOpen(false)}
        onSubmit={handleCreateDocsFile}
        title="New Documentation Collection"
        label="Enter a name for the documentation collection"
        placeholder="project-docs"
        defaultValue=""
        suffix=".docs"
        submitLabel="Create"
        cancelLabel="Cancel"
        validate={(value) => {
          if (/[<>:"/\\|?*]/.test(value)) {
            return 'Filename contains invalid characters';
          }
          return null;
        }}
      />
    </main>
  );
}
