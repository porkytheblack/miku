'use client';

import { useMemo, useCallback } from 'react';
import { useWorkspace, WorkspaceFile } from '@/context/WorkspaceContext';
import { useEnvEditor } from '@/context/EnvEditorContext';
import { useKanbanEditor } from '@/context/KanbanEditorContext';
import { useDocsEditor } from '@/context/DocsEditorContext';
import type { SearchResult, SearchResultCategory, SearchFilter } from '@/types';

// ============================================
// Fuzzy Matching
// ============================================

interface FuzzyMatchResult {
  match: boolean;
  score: number;
}

/**
 * Fuzzy match implementation that scores based on:
 * - Exact match (highest)
 * - Starts with query
 * - Contains query
 * - Character sequence match
 */
function fuzzyMatch(query: string, text: string): FuzzyMatchResult {
  if (!query) return { match: true, score: 0 };
  if (!text) return { match: false, score: 0 };

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Exact match - highest score
  if (textLower === queryLower) {
    return { match: true, score: 100 };
  }

  // Starts with query - high score
  if (textLower.startsWith(queryLower)) {
    return { match: true, score: 90 };
  }

  // Contains query as substring - medium-high score
  if (textLower.includes(queryLower)) {
    // Bonus for word boundary matches
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(queryLower)}`, 'i');
    if (wordBoundaryRegex.test(text)) {
      return { match: true, score: 75 };
    }
    return { match: true, score: 60 };
  }

  // Fuzzy character sequence match
  let queryIndex = 0;
  let consecutiveMatches = 0;
  let maxConsecutive = 0;
  let prevMatchIndex = -2;
  let firstMatchIndex = -1;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      if (firstMatchIndex === -1) firstMatchIndex = i;
      if (i === prevMatchIndex + 1) {
        consecutiveMatches++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);
      } else {
        consecutiveMatches = 1;
      }
      prevMatchIndex = i;
      queryIndex++;
    }
  }

  if (queryIndex === queryLower.length) {
    // Base score + bonus for consecutive matches + bonus for early match
    const baseScore = 20;
    const consecutiveBonus = maxConsecutive * 8;
    const positionBonus = Math.max(0, 20 - firstMatchIndex);
    return { match: true, score: baseScore + consecutiveBonus + positionBonus };
  }

  return { match: false, score: 0 };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// Search Index Building
// ============================================

interface UseGlobalSearchOptions {
  query: string;
  filter: SearchFilter;
  maxResults?: number;
}

interface UseGlobalSearchReturn {
  results: SearchResult[];
  isSearching: boolean;
  hasWorkspace: boolean;
}

/**
 * Hook that provides global search across all primitives
 */
export function useGlobalSearch({
  query,
  filter,
  maxResults = 50,
}: UseGlobalSearchOptions): UseGlobalSearchReturn {
  const { workspace, hasWorkspace } = useWorkspace();
  const envEditor = useEnvEditorSafe();
  const kanbanEditor = useKanbanEditorSafe();
  const docsEditor = useDocsEditorSafe();

  // Build search index and filter results
  const results = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const allResults: SearchResult[] = [];

    // Search workspace files
    if (filter === 'all' || filter === 'file') {
      const fileResults = searchWorkspaceFiles(workspace.files, trimmedQuery);
      const envFileResults = searchWorkspaceFiles(workspace.envFiles, trimmedQuery);
      allResults.push(...fileResults, ...envFileResults);
    }

    // Search environment variables (only if env editor has loaded content)
    if ((filter === 'all' || filter === 'env-variable') && envEditor?.state.hasLoaded) {
      const envResults = searchEnvVariables(envEditor.state.document.variables, trimmedQuery);
      allResults.push(...envResults);
    }

    // Search kanban items (only if kanban editor has loaded content)
    if (kanbanEditor?.state.hasLoaded) {
      if (filter === 'all' || filter === 'kanban-card') {
        const cardResults = searchKanbanCards(kanbanEditor.state.document.columns, trimmedQuery);
        allResults.push(...cardResults);
      }
      if (filter === 'all' || filter === 'kanban-task') {
        const taskResults = searchKanbanTasks(kanbanEditor.state.document.columns, trimmedQuery);
        allResults.push(...taskResults);
      }
    }

    // Search docs entries (only if docs editor has loaded content)
    if ((filter === 'all' || filter === 'docs-entry') && docsEditor?.state.hasLoaded) {
      const docsResults = searchDocsEntries(docsEditor.state.document.entries, trimmedQuery);
      allResults.push(...docsResults);
    }

    // Sort by score (descending) and limit results
    return allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }, [query, filter, maxResults, workspace.files, workspace.envFiles, envEditor, kanbanEditor, docsEditor]);

  return {
    results,
    isSearching: query.trim().length > 0,
    hasWorkspace,
  };
}

// ============================================
// Safe Context Access
// ============================================

// These hooks safely access contexts that may not be available
function useEnvEditorSafe() {
  try {
    return useEnvEditor();
  } catch {
    return null;
  }
}

function useKanbanEditorSafe() {
  try {
    return useKanbanEditor();
  } catch {
    return null;
  }
}

function useDocsEditorSafe() {
  try {
    return useDocsEditor();
  } catch {
    return null;
  }
}

// ============================================
// Search Functions by Primitive Type
// ============================================

function searchWorkspaceFiles(files: WorkspaceFile[], query: string): SearchResult[] {
  const results: SearchResult[] = [];

  function searchRecursive(fileList: WorkspaceFile[]) {
    for (const file of fileList) {
      // Match against filename
      const nameMatch = fuzzyMatch(query, file.name);
      // Also match against full path
      const pathMatch = fuzzyMatch(query, file.path);

      const bestScore = Math.max(nameMatch.score, pathMatch.score);

      if (nameMatch.match || pathMatch.match) {
        results.push({
          id: `file-${file.path}`,
          category: 'file',
          title: file.name,
          subtitle: getFileSubtitle(file),
          icon: 'file',
          score: bestScore,
          filePath: file.path,
        });
      }

      // Recurse into directories
      if (file.isDirectory && file.children) {
        searchRecursive(file.children);
      }
    }
  }

  searchRecursive(files);
  return results;
}

function getFileSubtitle(file: WorkspaceFile): string {
  if (file.isDirectory) return 'Folder';
  if (file.name.endsWith('.miku-env') || file.name.endsWith('.mikuenv')) return 'Environment File';
  if (file.name.endsWith('.kanban') || file.name.endsWith('.miku-kanban')) return 'Kanban Board';
  if (file.name.endsWith('.docs') || file.name.endsWith('.miku-docs')) return 'Documentation';
  if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) return 'Markdown';
  return 'File';
}

function searchEnvVariables(
  variables: Array<{ id: string; key: string; value: string; comment?: string; group?: string }>,
  query: string
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const variable of variables) {
    // Match against key (primary)
    const keyMatch = fuzzyMatch(query, variable.key);
    // Match against value
    const valueMatch = fuzzyMatch(query, variable.value);
    // Match against comment
    const commentMatch = variable.comment ? fuzzyMatch(query, variable.comment) : { match: false, score: 0 };

    const bestScore = Math.max(keyMatch.score, valueMatch.score * 0.8, commentMatch.score * 0.6);

    if (keyMatch.match || valueMatch.match || commentMatch.match) {
      results.push({
        id: `env-${variable.id}`,
        category: 'env-variable',
        title: variable.key,
        subtitle: variable.group || 'Environment Variable',
        icon: 'env-variable',
        score: bestScore,
        itemId: variable.id,
      });
    }
  }

  return results;
}

function searchKanbanCards(
  columns: Array<{ id: string; title: string; cards: Array<{ id: string; title: string; description?: string }> }>,
  query: string
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const column of columns) {
    for (const card of column.cards) {
      // Match against card title
      const titleMatch = fuzzyMatch(query, card.title);
      // Match against description
      const descMatch = card.description ? fuzzyMatch(query, card.description) : { match: false, score: 0 };

      const bestScore = Math.max(titleMatch.score, descMatch.score * 0.8);

      if (titleMatch.match || descMatch.match) {
        results.push({
          id: `card-${card.id}`,
          category: 'kanban-card',
          title: card.title,
          subtitle: `Column: ${column.title}`,
          icon: 'kanban-card',
          score: bestScore,
          itemId: card.id,
          parentId: column.id,
        });
      }
    }
  }

  return results;
}

function searchKanbanTasks(
  columns: Array<{
    id: string;
    title: string;
    cards: Array<{
      id: string;
      title: string;
      tasks: Array<{ id: string; text: string }>;
    }>;
  }>,
  query: string
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const column of columns) {
    for (const card of column.cards) {
      for (const task of card.tasks) {
        const textMatch = fuzzyMatch(query, task.text);

        if (textMatch.match) {
          results.push({
            id: `task-${task.id}`,
            category: 'kanban-task',
            title: task.text,
            subtitle: `Card: ${card.title}`,
            icon: 'kanban-task',
            score: textMatch.score,
            itemId: task.id,
            parentId: card.id,
          });
        }
      }
    }
  }

  return results;
}

function searchDocsEntries(
  entries: Array<{
    id: string;
    title: string;
    type: 'pasted' | 'github-file' | 'github-folder';
    files?: Array<{ path: string; title: string }>;
  }>,
  query: string
): SearchResult[] {
  const results: SearchResult[] = [];

  for (const entry of entries) {
    // Match against entry title
    const titleMatch = fuzzyMatch(query, entry.title);

    if (titleMatch.match) {
      results.push({
        id: `docs-${entry.id}`,
        category: 'docs-entry',
        title: entry.title,
        subtitle: getDocsEntrySubtitle(entry.type),
        icon: 'docs-entry',
        score: titleMatch.score,
        itemId: entry.id,
      });
    }

    // For folder entries, also search individual files
    if (entry.type === 'github-folder' && entry.files) {
      for (let i = 0; i < entry.files.length; i++) {
        const file = entry.files[i];
        const fileMatch = fuzzyMatch(query, file.title);
        const pathMatch = fuzzyMatch(query, file.path);

        const bestScore = Math.max(fileMatch.score, pathMatch.score * 0.8);

        if (fileMatch.match || pathMatch.match) {
          results.push({
            id: `docs-file-${entry.id}-${i}`,
            category: 'docs-entry',
            title: file.title,
            subtitle: `${entry.title} / ${file.path}`,
            icon: 'docs-entry',
            score: bestScore,
            itemId: entry.id,
            fileIndex: i,
          });
        }
      }
    }
  }

  return results;
}

function getDocsEntrySubtitle(type: 'pasted' | 'github-file' | 'github-folder'): string {
  switch (type) {
    case 'pasted':
      return 'Pasted Content';
    case 'github-file':
      return 'GitHub File';
    case 'github-folder':
      return 'GitHub Folder';
    default:
      return 'Documentation';
  }
}

// ============================================
// Utility Exports
// ============================================

export { fuzzyMatch };
export type { FuzzyMatchResult };
