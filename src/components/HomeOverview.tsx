'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useWorkspace, type WorkspaceFile } from '@/context/WorkspaceContext';
import { useDocument } from '@/context/DocumentContext';
import { isTauri } from '@/lib/tauri';
import styles from './HomeOverview.module.css';

const subscribe = () => () => {};

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2.5 6V4.5a1 1 0 0 1 1-1H8l2 2h6.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V6Z" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M4 2.5h8l4 4v11H4v-15Z M12 2.5v4h4 M7 10h6 M7 13h4" strokeLinejoin="round" />
    </svg>
  );
}

function filterFiles(files: WorkspaceFile[], query: string): WorkspaceFile[] {
  return files.flatMap(file => {
    if (file.name.toLowerCase().includes(query)) return [file];
    if (!file.isDirectory) return [];
    const children = filterFiles(file.children ?? [], query);
    return children.length ? [{ ...file, children }] : [];
  });
}

function FileList({ files, onOpen, disabled, filtering, depth = 0 }: {
  files: WorkspaceFile[];
  onOpen: (path: string) => Promise<void>;
  disabled: boolean;
  filtering: boolean;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  return (
    <ul className={styles.fileList}>
      {files.map(file => {
        const isExpanded = filtering || expanded.has(file.path);
        return (
          <li key={file.path}>
            <button
              type="button"
              className={styles.fileRow}
              style={{ paddingLeft: `${16 + depth * 20}px` }}
              title={file.path}
              disabled={disabled}
              aria-expanded={file.isDirectory ? isExpanded : undefined}
              onClick={() => {
                if (!file.isDirectory) {
                  void onOpen(file.path);
                  return;
                }
                setExpanded(prev => {
                  const next = new Set(prev);
                  if (next.has(file.path)) next.delete(file.path);
                  else next.add(file.path);
                  return next;
                });
              }}
            >
              <span className={styles.fileIcon}>{file.isDirectory ? <FolderIcon /> : <FileIcon />}</span>
              <span className={styles.fileName}>{file.name}</span>
              {file.isDirectory && <span aria-hidden="true" className={styles.chevron}>{isExpanded ? '⌄' : '›'}</span>}
            </button>
            {file.isDirectory && isExpanded && (
              file.children?.length ? (
                <FileList files={file.children} onOpen={onOpen} disabled={disabled} filtering={filtering} depth={depth + 1} />
              ) : <p className={styles.emptyFolder} style={{ paddingLeft: `${54 + depth * 20}px` }}>No Miku files in this folder</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function HomeOverview() {
  const { workspace, selectWorkspace, openWorkspace, refreshFiles, refreshEnvFiles } = useWorkspace();
  const { openDocument, newDoc, openDocuments, switchToDocument, isOpeningDocument, documentError } = useDocument();
  const inTauri = useSyncExternalStore(subscribe, isTauri, () => false);
  const [filter, setFilter] = useState('');
  const query = filter.trim().toLowerCase();
  const busy = workspace.isLoading || isOpeningDocument;
  const files = useMemo(() => [...workspace.files, ...workspace.envFiles], [workspace.files, workspace.envFiles]);
  const visibleFiles = useMemo(() => filterFiles(files, query), [files, query]);
  const resumableDocuments = openDocuments.filter(doc => doc.path || doc.content || doc.isModified);

  return (
    <section className={styles.home} aria-labelledby="home-heading">
      <header className={styles.header}>
        <div className={styles.brand}>MIKU <span>The Editor That Listens</span></div>
        <h1 id="home-heading">Home</h1>
        <p>Open a folder, find a file, or pick up where you left off.</p>
        <div className={styles.actions}>
          <button className={styles.primaryButton} type="button" onClick={() => void selectWorkspace()} disabled={busy || !inTauri}>
            <FolderIcon /> Open Folder
          </button>
          <button className={styles.button} type="button" onClick={() => void openDocument()} disabled={busy || !inTauri}>
            <FileIcon /> Open File
          </button>
          <button className={styles.button} type="button" onClick={newDoc}>
            <span aria-hidden="true" className={styles.plus}>+</span> New Document
          </button>
        </div>
        {!inTauri && <p className={styles.browserNote}>Folders and local files are available in the Miku desktop app. You can write a new document here.</p>}
      </header>

      {workspace.error && <div role="alert" className={styles.error}>{workspace.error}</div>}
      {documentError && <div role="alert" className={styles.error}>{documentError}</div>}
      {isOpeningDocument && <p className={styles.status} role="status">Opening file…</p>}

      <div className={styles.columns}>
        <aside className={styles.sidebar}>
          <section aria-labelledby="recent-folders-heading">
            <h2 id="recent-folders-heading">Recent folders</h2>
            {workspace.recentWorkspaces.length > 0 ? (
              <ul className={styles.recentList}>
                {workspace.recentWorkspaces.map(folder => (
                  <li key={folder.path}>
                    <button
                      type="button"
                      className={styles.recentFolder}
                      disabled={busy}
                      aria-current={folder.path === workspace.currentWorkspace?.path ? 'true' : undefined}
                      onClick={() => { setFilter(''); void openWorkspace(folder.path); }}
                      title={folder.path}
                    >
                      <FolderIcon />
                      <span><strong>{folder.name}</strong><small>{folder.path}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className={styles.muted}>Folders you open will appear here.</p>}
          </section>

          {resumableDocuments.length > 0 && (
            <section className={styles.openDocuments} aria-labelledby="open-documents-heading">
              <h2 id="open-documents-heading">Open documents</h2>
              <ul className={styles.recentList}>
                {resumableDocuments.map(doc => (
                  <li key={doc.id}>
                    <button type="button" className={styles.recentFolder} onClick={() => switchToDocument(doc.id)} title={doc.path ?? 'Untitled'}>
                      <FileIcon />
                      <span><strong>{doc.path?.split(/[/\\]/).pop() || 'Untitled'}</strong><small>{doc.isModified ? 'Unsaved changes' : 'Continue editing'}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <section className={styles.filesPanel} aria-labelledby="folder-files-heading" aria-busy={workspace.isLoading}>
          <div className={styles.filesHeader}>
            <div className={styles.folderTitle}>
              <h2 id="folder-files-heading">{workspace.currentWorkspace?.name || 'Your files'}</h2>
              <p title={workspace.currentWorkspace?.path}>{workspace.currentWorkspace?.path || 'Choose a folder to get started'}</p>
            </div>
            {workspace.currentWorkspace && (
              <button className={styles.refreshButton} type="button" disabled={busy} onClick={() => void Promise.all([refreshFiles(), refreshEnvFiles()])} aria-label="Refresh files" title="Refresh files">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M13 6A5 5 0 1 0 13 10 M10 6h3V3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
          {workspace.currentWorkspace && (
            <div className={styles.filter}>
              <input aria-label="Filter files" type="search" placeholder="Filter files…" value={filter} onChange={event => setFilter(event.target.value)} />
            </div>
          )}
          {workspace.isLoading ? (
            <div className={styles.emptyState} role="status"><FolderIcon /><p>Loading folder…</p></div>
          ) : !workspace.currentWorkspace ? (
            <div className={styles.emptyState}>
              <FolderIcon />
              <h3>A little room for your ideas</h3>
              <p>Open a folder to browse your documents and boards, all in one place.</p>
            </div>
          ) : visibleFiles.length === 0 ? (
            <div className={styles.emptyState}>
              <FileIcon />
              <h3>{query ? 'No matching files' : 'No Miku files yet'}</h3>
              <p>{query ? 'Try another name or clear your filter.' : 'Markdown, boards, docs, chats, and environment files will appear here.'}</p>
              {query && <button className={styles.button} type="button" onClick={() => setFilter('')}>Clear filter</button>}
            </div>
          ) : (
            <FileList key={workspace.currentWorkspace.path} files={visibleFiles} onOpen={openDocument} disabled={busy} filtering={Boolean(query)} />
          )}
        </section>
      </div>
      <p className={styles.footer}>Your documents stay open when you return Home.</p>
    </section>
  );
}
