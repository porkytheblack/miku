# RFC: SimpleDocs - Documentation Management for Miku

## Status
Draft

## Abstract

This RFC proposes SimpleDocs, a new file type for Miku that enables users to store, organize, and view documentation for their projects. SimpleDocs supports three input modalities: pasting markdown content directly, importing from a single GitHub markdown file, and importing an entire GitHub docs folder. The system provides offline-capable cached content with background synchronization for GitHub-sourced documentation.

## 1. Introduction

### 1.1 Problem Statement

Developers frequently need to reference documentation while working on projects. Currently, this requires context-switching between their editor and a web browser, or maintaining local copies of documentation that quickly become stale. Miku users need a way to:

1. Keep relevant documentation accessible alongside their work
2. Store documentation that persists across sessions
3. Access documentation offline after initial fetch
4. View documentation in a rendered markdown format (not raw source)
5. Easily sync documentation with upstream sources when online

### 1.2 Goals

1. **G1**: Support direct paste of markdown content for quick documentation storage
2. **G2**: Support importing single markdown files from GitHub URLs
3. **G3**: Support importing entire documentation folders from GitHub repositories
4. **G4**: Render markdown in a readable format (not as editable source)
5. **G5**: Enable side-by-side viewing with other Miku editors
6. **G6**: Provide offline access to all previously fetched documentation
7. **G7**: Support manual refresh/sync with GitHub sources
8. **G8**: Handle GitHub API rate limits gracefully
9. **G9**: Support private repositories (with user-provided authentication)

### 1.3 Non-Goals

1. **NG1**: Full documentation editing capabilities (this is a reader, not an editor)
2. **NG2**: Real-time collaboration on documentation
3. **NG3**: Integration with documentation platforms beyond GitHub (e.g., GitLab, Bitbucket)
4. **NG4**: Full-text search across all documentation (may be added later)
5. **NG5**: Documentation versioning/history beyond what GitHub provides
6. **NG6**: Automatic background sync (sync is user-initiated)

### 1.4 Success Criteria

1. Users can paste markdown and have it render immediately
2. Users can import a GitHub file URL in under 5 seconds (network permitting)
3. Users can import a GitHub folder with up to 50 files in under 30 seconds
4. Previously fetched documentation loads instantly from cache
5. Cache persists across application restarts
6. Side-by-side view works smoothly without layout thrashing

## 2. Background

### 2.1 Current State

Miku currently supports three file types:
- **markdown** (`.md`): Editable markdown documents with AI suggestions
- **miku-env** (`.miku-env`): Environment variable management
- **kanban** (`.kanban`): Kanban board visualization

Each file type follows a consistent pattern:
1. A file extension triggers a specific editor via `EditorSwitcher.tsx`
2. A parser/serializer module handles the file format
3. A context provider manages state and operations
4. An editor component renders the UI

### 2.2 Terminology

| Term | Definition |
|------|------------|
| **SimpleDocs file** | A `.docs` file containing documentation metadata and content |
| **Entry** | A single documentation item within a SimpleDocs file |
| **Pasted entry** | An entry created by pasting markdown directly |
| **GitHub file entry** | An entry imported from a single GitHub markdown file |
| **GitHub folder entry** | A collection of entries imported from a GitHub docs folder |
| **Cache** | Local storage of fetched GitHub content for offline access |
| **Manifest** | The JSON structure stored in the `.docs` file |
| **Raw API** | GitHub's raw content API (`raw.githubusercontent.com`) |
| **Contents API** | GitHub's REST API for listing repository contents |

### 2.3 Prior Art

| Solution | Approach | Limitations |
|----------|----------|-------------|
| **Dash** | Local docset downloads | Requires pre-built docsets, heavy |
| **DevDocs** | Web-based aggregator | No offline without PWA, no custom docs |
| **Zeal** | Open-source Dash alternative | Same docset limitations |
| **Notion** | Web clipper + embeds | Requires account, not local-first |
| **Obsidian** | Local markdown vault | No GitHub sync, requires manual copy |

SimpleDocs differentiates by:
- Being local-first with optional GitHub sync
- Supporting any GitHub markdown, not just pre-defined docsets
- Integrating directly into the Miku editing environment
- Using a simple, human-readable file format

## 3. Algorithm Analysis

### 3.1 Candidate Approaches

#### 3.1.1 Inline Content Storage

Store all documentation content directly in the `.docs` file.

- **Description**: Fetched content is immediately serialized into the file itself
- **Time Complexity**: O(1) read, O(n) write where n = total content size
- **Space Complexity**: O(n) where n = total content size
- **Advantages**:
  - Simple implementation
  - Single file contains everything
  - Works offline trivially
- **Disadvantages**:
  - Large files become unwieldy
  - Duplicate storage (file + memory)
  - Slow saves with large content
- **Best Suited For**: Small documentation sets (<100KB total)

#### 3.1.2 External Cache with Reference Storage

Store metadata/references in `.docs` file, actual content in a separate cache directory.

- **Description**: File contains URLs and metadata; content stored in app's cache directory
- **Time Complexity**: O(1) manifest read, O(n) content read where n = entries accessed
- **Space Complexity**: O(m) manifest + O(n) cache where m = entries, n = total content
- **Advantages**:
  - Manifest file stays small and fast
  - Content can be lazy-loaded
  - Cache can be shared across multiple `.docs` files
  - Enables cache eviction policies
- **Disadvantages**:
  - More complex implementation
  - Cache can become orphaned if `.docs` file deleted
  - Requires cache management logic
- **Best Suited For**: Any size documentation, especially large imports

#### 3.1.3 Hybrid Approach

Store small/pasted content inline, large/fetched content in external cache.

- **Description**: Content below threshold stored inline; larger content cached externally
- **Time Complexity**: O(1) for inline, O(1) cache lookup for external
- **Space Complexity**: O(m + k) manifest where k = inline content, O(n-k) cache
- **Advantages**:
  - Optimal for mixed usage patterns
  - Pasted content always available without cache lookup
  - Large imports don't bloat manifest
- **Disadvantages**:
  - Most complex implementation
  - Two code paths for content retrieval
  - Threshold selection is arbitrary
- **Best Suited For**: Projects that mix pasted and imported content

### 3.2 Comparative Analysis

| Criterion | Inline | External Cache | Hybrid |
|-----------|--------|----------------|--------|
| Implementation complexity | Low | Medium | High |
| Small docs performance | Excellent | Good | Excellent |
| Large docs performance | Poor | Excellent | Excellent |
| Offline reliability | Excellent | Excellent | Excellent |
| File portability | Excellent | Poor | Medium |
| Cache management | None | Required | Required |
| Memory efficiency | Poor | Excellent | Good |

### 3.3 Recommendation

**Selected: 3.1.2 External Cache with Reference Storage**

Justification:
1. **Scalability**: Users may import large documentation folders with hundreds of files
2. **Performance**: Small manifest files enable fast initial load
3. **Flexibility**: Cache can be managed independently (pruning, preloading)
4. **User experience**: Lazy loading enables progressive display
5. **Simplicity over hybrid**: While hybrid optimizes edge cases, the added complexity doesn't justify the marginal benefit

The external cache approach handles all use cases well, with the only trade-off being file portability (solved by documenting a re-fetch workflow).

## 4. Detailed Design

### 4.1 Architecture Overview

```
+-------------------+     +-------------------+     +-------------------+
|   .docs File      |     |   DocsEditor      |     |   Cache Layer     |
|   (Manifest)      |<--->|   Component       |<--->|   (App Data Dir)  |
+-------------------+     +-------------------+     +-------------------+
         |                        |                        |
         |                        v                        |
         |                +-------------------+            |
         |                |   Markdown        |            |
         |                |   Renderer        |            |
         |                +-------------------+            |
         |                                                 |
         v                                                 v
+-------------------+                          +-------------------+
|   DocsParser      |                          |   GitHubFetcher   |
|   (Parse/Serialize)|                         |   (API Client)    |
+-------------------+                          +-------------------+
```

### 4.2 Data Structures

#### 4.2.1 DocsDocument (Manifest)

```typescript
/**
 * Root document structure stored in .docs files
 * This is the manifest that references cached content
 */
interface DocsDocument {
  version: string;              // Format version, "1.0"
  metadata: DocsMetadata;
  entries: DocsEntry[];
}

interface DocsMetadata {
  name?: string;                // Display name for the docs collection
  description?: string;         // Optional description
  createdAt: string;            // ISO 8601 timestamp
  updatedAt: string;            // ISO 8601 timestamp
}
```

#### 4.2.2 DocsEntry

```typescript
/**
 * Base entry type with discriminated union for source types
 */
type DocsEntry = PastedEntry | GitHubFileEntry | GitHubFolderEntry;

interface BaseEntry {
  id: string;                   // Unique ID: "entry-{counter}-{timestamp}-{random}"
  title: string;                // Display title
  createdAt: string;            // ISO 8601 timestamp
  updatedAt: string;            // ISO 8601 timestamp
}

/**
 * Entry created by pasting markdown directly
 * Content is stored inline since it's user-provided and likely small
 */
interface PastedEntry extends BaseEntry {
  type: 'pasted';
  content: string;              // Raw markdown content (stored inline)
}

/**
 * Entry imported from a single GitHub file
 */
interface GitHubFileEntry extends BaseEntry {
  type: 'github-file';
  source: GitHubFileSource;
  cacheKey: string;             // Key to retrieve content from cache
  lastFetched: string;          // ISO 8601 timestamp of last successful fetch
  lastCommitSha?: string;       // SHA of the commit when last fetched
}

/**
 * Entry imported from a GitHub folder
 * Contains multiple files organized hierarchically
 */
interface GitHubFolderEntry extends BaseEntry {
  type: 'github-folder';
  source: GitHubFolderSource;
  files: GitHubFolderFile[];    // Flat list of files in the folder
  lastFetched: string;          // ISO 8601 timestamp
  lastCommitSha?: string;       // SHA of the commit when last fetched
}

interface GitHubFolderFile {
  path: string;                 // Relative path within folder (e.g., "getting-started/intro.md")
  title: string;                // Extracted from first heading or filename
  cacheKey: string;             // Key to retrieve content from cache
  sha: string;                  // File SHA for change detection
}
```

#### 4.2.3 GitHub Source References

```typescript
/**
 * Reference to a single GitHub file
 * Parsed from URLs like: https://github.com/owner/repo/blob/branch/path/to/file.md
 */
interface GitHubFileSource {
  owner: string;
  repo: string;
  branch: string;               // Could be branch name, tag, or commit SHA
  path: string;                 // Full path within repo
}

/**
 * Reference to a GitHub folder
 * Parsed from URLs like: https://github.com/owner/repo/tree/branch/docs
 */
interface GitHubFolderSource {
  owner: string;
  repo: string;
  branch: string;
  path: string;                 // Folder path within repo
}
```

#### 4.2.4 Cache Structure

```typescript
/**
 * Cache entry stored in app data directory
 * Location: {appDataDir}/miku/docs-cache/{cacheKey}.json
 */
interface CacheEntry {
  cacheKey: string;
  content: string;              // Raw markdown content
  fetchedAt: string;            // ISO 8601 timestamp
  source: GitHubFileSource;     // Original source for re-fetch
  etag?: string;                // HTTP ETag for conditional requests
  sha?: string;                 // Git blob SHA
}

/**
 * Cache index for quick lookups
 * Location: {appDataDir}/miku/docs-cache/index.json
 */
interface CacheIndex {
  version: string;
  entries: {
    [cacheKey: string]: {
      size: number;             // Content size in bytes
      fetchedAt: string;
      accessedAt: string;       // Last access time for LRU eviction
    };
  };
  totalSize: number;            // Total cache size in bytes
}
```

#### 4.2.5 Type Definitions Summary

```typescript
// File types extension
type FileType = 'markdown' | 'miku-env' | 'kanban' | 'docs';

// GitHub URL types
type GitHubUrlType = 'file' | 'folder' | 'invalid';

// Sync status for UI feedback
type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

// Entry sync result
interface SyncResult {
  entryId: string;
  status: 'unchanged' | 'updated' | 'error';
  error?: string;
}
```

### 4.3 Algorithm Specification

#### 4.3.1 GitHub URL Parsing

```
PROCEDURE parseGitHubUrl(url: string) -> GitHubUrlParseResult | null
  REQUIRE: url is a non-empty string
  ENSURE: Returns parsed structure or null if not a valid GitHub URL

  1. Normalize URL by removing trailing slashes and query parameters
  2. Match against GitHub URL patterns:
     - File pattern: /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/
     - Folder pattern: /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/
     - Raw pattern: /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/

  3. If file pattern matches:
     - Extract owner, repo, branch, path
     - Validate path ends with .md or .markdown (case-insensitive)
     - Return { type: 'file', source: { owner, repo, branch, path } }

  4. If folder pattern matches:
     - Extract owner, repo, branch, path
     - Return { type: 'folder', source: { owner, repo, branch, path } }

  5. If raw pattern matches:
     - Convert to standard file source
     - Return { type: 'file', source: { owner, repo, branch, path } }

  6. Return null (invalid URL)
```

#### 4.3.2 Single File Fetch

```
PROCEDURE fetchGitHubFile(source: GitHubFileSource, authToken?: string) -> FetchResult
  REQUIRE: source has valid owner, repo, branch, path
  ENSURE: Returns content or error

  1. Generate cache key: sha256(source.owner + source.repo + source.path + source.branch)

  2. Check cache for existing entry with matching cacheKey:
     IF cache hit AND cache not stale (< 1 hour old) AND offline:
       - Return cached content immediately

  3. Construct raw content URL:
     - url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`

  4. Prepare headers:
     - Accept: text/plain
     - If authToken provided: Authorization: token ${authToken}
     - If cached ETag exists: If-None-Match: ${etag}

  5. Execute HTTP GET request with 30-second timeout

  6. Handle response:
     - 304 Not Modified: Return cached content, update accessedAt
     - 200 OK:
       a. Extract content from response body
       b. Store in cache with new ETag and timestamp
       c. Return content
     - 404 Not Found: Return error "File not found"
     - 403 Forbidden:
       - Check for rate limit headers
       - If rate limited: Return error with reset time
       - Else: Return error "Access denied - private repo may require auth"
     - Other: Return error with status code

  7. On network error:
     - If cache exists: Return cached content with warning
     - Else: Return error "Network unavailable"
```

#### 4.3.3 Folder Import

```
PROCEDURE fetchGitHubFolder(source: GitHubFolderSource, authToken?: string) -> FolderFetchResult
  REQUIRE: source has valid owner, repo, branch, path
  ENSURE: Returns list of files or error

  1. Construct API URL for folder listing:
     - url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`

  2. Prepare headers:
     - Accept: application/vnd.github.v3+json
     - If authToken: Authorization: token ${authToken}

  3. Execute HTTP GET request with 30-second timeout

  4. Handle response:
     - 200 OK: Parse JSON response
     - 404: Return error "Folder not found"
     - 403: Handle rate limiting (see file fetch)
     - Other: Return error

  5. Filter response to markdown files:
     - Keep items where type === 'file' AND name matches /\.(md|markdown)$/i
     - Also keep items where type === 'dir' for recursive fetch

  6. For each markdown file (max 50 files, configurable):
     a. Extract: name, path, sha, download_url
     b. Generate cacheKey from path
     c. Fetch content using fetchGitHubFile
     d. Extract title from first heading or use filename
     e. Store in cache

  7. For each subdirectory (max depth 3):
     a. Recursively call fetchGitHubFolder
     b. Merge results with path prefixes

  8. Return list of GitHubFolderFile entries with their cache keys
```

#### 4.3.4 Cache Management

```
PROCEDURE getCachedContent(cacheKey: string) -> string | null
  REQUIRE: cacheKey is a valid cache key string
  ENSURE: Returns content if cached, null otherwise

  1. Load cache index from disk
  2. Look up cacheKey in index
  3. If not found: Return null
  4. Construct file path: {cacheDir}/{cacheKey}.json
  5. Read and parse cache file
  6. Update accessedAt in index
  7. Return content

PROCEDURE storeCachedContent(entry: CacheEntry) -> void
  REQUIRE: entry has cacheKey and content
  ENSURE: Content is stored and index updated

  1. Load cache index
  2. Serialize entry to JSON
  3. Write to {cacheDir}/{cacheKey}.json
  4. Update index with:
     - size: content byte length
     - fetchedAt: current timestamp
     - accessedAt: current timestamp
  5. Recalculate totalSize
  6. If totalSize > MAX_CACHE_SIZE (100MB default):
     - Trigger cache eviction (LRU)
  7. Save index

PROCEDURE evictCache(targetSize: number) -> void
  REQUIRE: targetSize < current totalSize
  ENSURE: Cache size reduced to below targetSize

  1. Load cache index
  2. Sort entries by accessedAt ascending (oldest first)
  3. While totalSize > targetSize:
     a. Remove oldest entry from index
     b. Delete corresponding cache file
     c. Recalculate totalSize
  4. Save index
```

#### 4.3.5 Sync/Refresh

```
PROCEDURE syncEntry(entry: GitHubFileEntry | GitHubFolderEntry, authToken?: string) -> SyncResult
  REQUIRE: entry is a GitHub-sourced entry
  ENSURE: Entry content is refreshed from source

  1. If entry.type === 'github-file':
     a. Fetch file with existing SHA for comparison
     b. If 304 Not Modified: Return { status: 'unchanged' }
     c. If new content: Update cache, return { status: 'updated' }
     d. If error: Return { status: 'error', error: message }

  2. If entry.type === 'github-folder':
     a. Fetch folder listing
     b. Compare file list with entry.files:
        - New files: Fetch and add
        - Removed files: Mark for cleanup
        - Changed SHA: Refetch content
     c. Update entry.files and entry.lastFetched
     d. Return aggregate status

PROCEDURE syncAllEntries(document: DocsDocument, authToken?: string) -> SyncResult[]
  REQUIRE: document has entries array
  ENSURE: All GitHub entries are synced

  1. Filter entries to GitHub sources only
  2. For each entry (with concurrency limit of 3):
     a. Call syncEntry
     b. Collect results
  3. Update document.metadata.updatedAt
  4. Return all results
```

### 4.4 Interface Definition

#### 4.4.1 DocsParser API

```typescript
// Location: src/lib/docsParser.ts

/**
 * Parse a .docs file content into a DocsDocument
 * @param content - Raw file content (JSON string)
 * @returns Parsed and validated DocsDocument
 * @throws never - returns empty document on invalid input
 */
function parseDocsFile(content: string): DocsDocument;

/**
 * Serialize a DocsDocument to .docs file format
 * @param document - The document to serialize
 * @returns Formatted JSON string
 */
function serializeDocsDocument(document: DocsDocument): string;

/**
 * Create a new empty docs document
 * @returns Document with no entries
 */
function createEmptyDocument(): DocsDocument;

/**
 * Create a new pasted entry
 * @param title - Entry title
 * @param content - Markdown content
 * @returns PastedEntry with generated ID
 */
function createPastedEntry(title: string, content: string): PastedEntry;

/**
 * Generate a unique entry ID
 * @returns ID in format "entry-{counter}-{timestamp}-{random}"
 */
function generateEntryId(): string;
```

#### 4.4.2 GitHub Fetcher API

```typescript
// Location: src/lib/github/fetcher.ts

/**
 * Parse a GitHub URL into source components
 * @param url - GitHub URL (file or folder)
 * @returns Parse result or null if invalid
 */
function parseGitHubUrl(url: string): GitHubUrlParseResult | null;

/**
 * Fetch content from a GitHub file
 * @param source - Parsed file source
 * @param options - Fetch options including auth token
 * @returns Fetch result with content or error
 */
async function fetchGitHubFile(
  source: GitHubFileSource,
  options?: FetchOptions
): Promise<FetchResult>;

/**
 * Fetch all markdown files from a GitHub folder
 * @param source - Parsed folder source
 * @param options - Fetch options including auth token and limits
 * @returns Folder fetch result with file list or error
 */
async function fetchGitHubFolder(
  source: GitHubFolderSource,
  options?: FolderFetchOptions
): Promise<FolderFetchResult>;

interface FetchOptions {
  authToken?: string;
  timeout?: number;            // Default: 30000ms
  useCache?: boolean;          // Default: true
}

interface FolderFetchOptions extends FetchOptions {
  maxFiles?: number;           // Default: 50
  maxDepth?: number;           // Default: 3
  onProgress?: (fetched: number, total: number) => void;
}

interface FetchResult {
  success: boolean;
  content?: string;
  error?: string;
  rateLimitReset?: Date;       // If rate limited
  fromCache?: boolean;
}

interface FolderFetchResult {
  success: boolean;
  files?: GitHubFolderFile[];
  error?: string;
  rateLimitReset?: Date;
}
```

#### 4.4.3 Cache Service API

```typescript
// Location: src/lib/github/cache.ts

/**
 * Get cached content by key
 * @param cacheKey - The cache key
 * @returns Content if cached, null otherwise
 */
async function getCachedContent(cacheKey: string): Promise<string | null>;

/**
 * Store content in cache
 * @param entry - Cache entry to store
 */
async function storeCachedContent(entry: CacheEntry): Promise<void>;

/**
 * Check if content is cached
 * @param cacheKey - The cache key
 * @returns true if cached
 */
async function isCached(cacheKey: string): Promise<boolean>;

/**
 * Clear specific cache entries
 * @param cacheKeys - Keys to clear
 */
async function clearCacheEntries(cacheKeys: string[]): Promise<void>;

/**
 * Clear entire cache
 */
async function clearAllCache(): Promise<void>;

/**
 * Get cache statistics
 * @returns Cache size and entry count
 */
async function getCacheStats(): Promise<{ size: number; entries: number }>;
```

#### 4.4.4 DocsEditor Context API

```typescript
// Location: src/context/DocsEditorContext.tsx

interface DocsEditorContextType {
  // State
  state: DocsEditorState;

  // Document operations
  loadContent: (content: string) => void;
  getContent: () => string;

  // Entry operations
  addPastedEntry: (title: string, content: string) => void;
  addGitHubFileEntry: (url: string) => Promise<void>;
  addGitHubFolderEntry: (url: string) => Promise<void>;
  removeEntry: (id: string) => void;
  updateEntryTitle: (id: string, title: string) => void;
  reorderEntry: (id: string, newIndex: number) => void;

  // Content access
  getEntryContent: (id: string) => Promise<string | null>;

  // Sync operations
  syncEntry: (id: string) => Promise<SyncResult>;
  syncAllEntries: () => Promise<SyncResult[]>;

  // UI state
  setActiveEntry: (id: string | null) => void;
  setExpandedEntry: (id: string, expanded: boolean) => void;

  // Authentication
  setGitHubToken: (token: string | null) => void;
}

interface DocsEditorState {
  document: DocsDocument;
  activeEntryId: string | null;
  expandedEntries: Set<string>;
  syncStatus: Map<string, SyncStatus>;
  githubToken: string | null;
  isModified: boolean;
  hasLoaded: boolean;
}
```

### 4.5 Error Handling

| Error Condition | Detection | Recovery |
|-----------------|-----------|----------|
| Invalid GitHub URL | Regex match fails | Show user error, don't create entry |
| Network unavailable | fetch() rejects with TypeError | Return cached content if available, else error |
| GitHub 404 | Response status 404 | Show "File/folder not found" error |
| GitHub 403 (rate limit) | Response status 403 + rate limit headers | Show reset time, suggest auth token |
| GitHub 403 (private repo) | Response status 403, no rate limit | Prompt for auth token |
| Cache read failure | File read throws | Log error, treat as cache miss |
| Cache write failure | File write throws | Log error, continue without caching |
| Invalid JSON in .docs file | JSON.parse throws | Return empty document, log warning |
| Entry content too large | Content > 5MB | Reject with size error |
| Too many files in folder | File count > maxFiles | Truncate with warning |

### 4.6 Edge Cases

#### Empty Inputs
- Empty pasted content: Reject with validation error
- Empty GitHub URL: Show input validation error
- Empty .docs file: Return empty document with default metadata

#### Single Element Inputs
- Single file in folder: Import as folder with one file (preserve structure)
- Single character title: Accept but warn user

#### Maximum Size Inputs
- Very large markdown file (>5MB): Reject with error suggesting split
- Many files in folder (>100): Warn user, import first 50, suggest selective import

#### Malformed Inputs
- Malformed JSON in .docs file: Log error, return empty document
- Invalid GitHub URL format: Return null from parser, show user error
- Non-markdown file in GitHub URL: Reject with "Only markdown files supported"

#### Concurrent Access
- Multiple sync operations: Queue and deduplicate by entry ID
- Cache write during read: Use atomic file operations (write to temp, rename)
- Document modification during sync: Lock entry during sync, merge changes after

#### Resource Exhaustion
- Cache full: Trigger LRU eviction before storing new content
- Memory pressure: Stream large files rather than loading entirely
- Rate limit exhausted: Stop fetching, show reset time, allow cache access

## 5. Implementation Guide

### 5.1 Prerequisites

**Dependencies to add:**
- None required (existing `@uiw/react-markdown-preview` handles rendering)

**Files to create:**
```
src/lib/docsParser.ts              # Parse/serialize .docs files
src/lib/github/fetcher.ts          # GitHub API client
src/lib/github/cache.ts            # Cache management
src/lib/github/urlParser.ts        # GitHub URL parsing
src/context/DocsEditorContext.tsx  # State management
src/components/DocsEditor/         # Editor components
  index.tsx                        # Main editor component
  DocsToolbar.tsx                  # Toolbar with add/sync actions
  DocsSidebar.tsx                  # Entry list sidebar
  DocsViewer.tsx                   # Markdown rendering area
  DocsEntryItem.tsx                # Single entry in sidebar
  DocsEmptyState.tsx               # Empty state UI
  AddEntryDialog.tsx               # Dialog for adding entries
```

**Files to modify:**
```
src/types/index.ts                 # Add docs types
src/lib/fileTypes.ts               # Add .docs detection
src/components/EditorSwitcher.tsx  # Add DocsEditor case
```

### 5.2 Implementation Order

1. **Phase 1: Core Types and Parser** (1-2 days)
   - Add types to `src/types/index.ts`
   - Implement `docsParser.ts` with parse/serialize
   - Add `.docs` detection to `fileTypes.ts`
   - Unit tests for parser

2. **Phase 2: Basic Editor Shell** (1-2 days)
   - Create `DocsEditorContext.tsx` with state management
   - Create basic `DocsEditor/index.tsx`
   - Wire up `EditorSwitcher.tsx`
   - Test: Can open/save empty .docs files

3. **Phase 3: Pasted Content** (1 day)
   - Implement `AddEntryDialog.tsx` for paste
   - Implement `DocsViewer.tsx` with markdown rendering
   - Implement `DocsSidebar.tsx` for entry list
   - Test: Can paste markdown and view it

4. **Phase 4: GitHub URL Parsing** (1 day)
   - Implement `urlParser.ts`
   - Unit tests for various URL formats
   - Integration with `AddEntryDialog`

5. **Phase 5: GitHub Fetching** (2-3 days)
   - Implement `fetcher.ts` for file fetch
   - Implement folder listing and recursive fetch
   - Handle errors and rate limits
   - Test: Can import single file and folder

6. **Phase 6: Caching** (2 days)
   - Implement `cache.ts` with Tauri file API
   - Add cache index management
   - Implement LRU eviction
   - Test: Content persists across restarts

7. **Phase 7: Sync** (1-2 days)
   - Implement sync per-entry
   - Implement sync all
   - UI feedback for sync status
   - Test: Can refresh GitHub content

8. **Phase 8: Polish** (1-2 days)
   - Side-by-side layout integration
   - Loading states and skeletons
   - Error messages and recovery UI
   - Keyboard navigation

### 5.3 Testing Strategy

**Unit Tests:**
- `docsParser.test.ts`: Parse/serialize round-trip, malformed input handling
- `urlParser.test.ts`: All GitHub URL variants, edge cases
- `cache.test.ts`: Store/retrieve, eviction logic

**Integration Tests:**
- GitHub fetch with mocked responses
- Cache persistence across "sessions" (mock Tauri APIs)
- Full workflow: add entry -> save -> reload -> verify

**Manual Testing Checklist:**
- [ ] Paste markdown, view renders correctly
- [ ] Import GitHub file by URL
- [ ] Import GitHub folder (public repo)
- [ ] Content persists after app restart
- [ ] Sync updates changed content
- [ ] Sync shows "unchanged" for identical content
- [ ] Works offline with cached content
- [ ] Rate limit error shows helpful message
- [ ] Private repo prompts for token
- [ ] Large folder import shows progress

### 5.4 Common Pitfalls

1. **GitHub API vs Raw URLs**
   - Raw URLs (`raw.githubusercontent.com`) don't require auth for public repos
   - API URLs (`api.github.com`) have stricter rate limits
   - Use raw URLs for content, API for folder listing only

2. **Branch Names with Slashes**
   - Branch `feature/foo` creates ambiguous URL paths
   - Use GitHub API to resolve refs when ambiguous
   - Store resolved commit SHA for reliable re-fetch

3. **Cache Key Collisions**
   - Same file path in different branches/repos needs unique key
   - Include owner, repo, and branch in hash input
   - Use SHA-256 truncated to 32 chars for filesystem safety

4. **CORS in Browser Development**
   - GitHub raw URLs have permissive CORS
   - GitHub API requires proper headers
   - Tauri's HTTP client bypasses CORS entirely

5. **Large File Memory Pressure**
   - Don't load all entry content into memory at once
   - Lazy-load content when entry is selected
   - Consider streaming for files > 1MB

## 6. Performance Characteristics

### 6.1 Complexity Analysis

| Operation | Time | Space | Notes |
|-----------|------|-------|-------|
| Parse .docs file | O(n) | O(n) | n = file size |
| Serialize .docs file | O(m) | O(m) | m = number of entries |
| Cache lookup | O(1) | O(1) | Hash table index |
| Cache store | O(c) | O(c) | c = content size |
| GitHub file fetch | O(1) network | O(f) | f = file size |
| GitHub folder fetch | O(k) network | O(k*f) | k = files, f = avg size |
| Cache eviction | O(e log e) | O(e) | e = entries to evaluate |

### 6.2 Benchmarking Methodology

Measure on mid-tier hardware (MacBook Air M1, 8GB RAM):

1. **Cold start**: Time from app launch to docs file fully rendered
2. **File import**: Time from URL paste to content displayed
3. **Folder import**: Time for 20-file folder with progress
4. **Cache hit**: Time from entry click to content displayed (cached)
5. **Sync operation**: Time for single entry refresh

### 6.3 Expected Performance

| Metric | Target | Acceptable |
|--------|--------|------------|
| Cold start (cached content) | < 500ms | < 1000ms |
| Single file import | < 2s | < 5s |
| 20-file folder import | < 10s | < 20s |
| Cache hit content display | < 100ms | < 200ms |
| Sync single entry | < 2s | < 5s |

### 6.4 Optimization Opportunities

1. **Parallel fetching**: Fetch folder files in parallel (3-5 concurrent)
2. **Incremental loading**: Show sidebar while content loads
3. **Virtual scrolling**: For folders with many files
4. **Service worker**: Pre-cache content in background (future)
5. **Delta sync**: Only fetch changed files based on SHA (implemented in sync)

## 7. Security Considerations

1. **GitHub Token Storage**
   - Store in OS keychain via Tauri's secure storage
   - Never persist in .docs file or regular config
   - Clear from memory when not needed

2. **URL Validation**
   - Strictly validate GitHub URLs before fetching
   - Reject URLs with suspicious patterns
   - Don't follow redirects outside github.com domain

3. **Content Sanitization**
   - Markdown renderer must sanitize HTML
   - Disable dangerous features (raw HTML, scripts)
   - `@uiw/react-markdown-preview` handles this by default

4. **Cache Integrity**
   - Cache files are local-only, not shared
   - No executable content in cache
   - Clear cache doesn't require auth

5. **Private Repository Access**
   - Warn users that token grants read access
   - Recommend fine-grained tokens with minimal scope
   - Document required permissions: `repo:read` for private, none for public

## 8. Operational Considerations

### 8.1 Monitoring

Track these metrics (via optional telemetry, user-controlled):
- .docs files opened (count)
- Entries by type distribution
- Cache hit ratio
- Sync operations (success/failure)
- GitHub API errors by type

### 8.2 Alerting

User-facing alerts:
- Rate limit approaching: Show warning at 80% of hourly limit
- Rate limit exceeded: Show reset time and suggest token
- Offline mode: Indicate cached content may be stale
- Sync failure: Show specific error and retry option

### 8.3 Debugging

Debug information available:
- Cache statistics in settings panel
- Entry metadata visible in "info" popover
- Console logging for fetch/cache operations (dev mode)
- Export .docs file is human-readable JSON

## 9. Migration Plan

Not applicable - this is a new feature with no existing data to migrate.

## 10. Open Questions

1. **Side-by-side implementation**: Should docs viewer split the editor area, or open in a separate panel/window?
   - **Proposed**: Use existing editor area split similar to IDE file splits
   - **Alternative**: Dedicated docs panel that overlays or docks

2. **Authentication persistence**: How long should GitHub tokens be stored?
   - **Proposed**: Until user explicitly clears or token expires
   - **Alternative**: Session-only, require re-entry on app restart

3. **Folder structure display**: How to show nested folders in sidebar?
   - **Proposed**: Flat list with indentation (like file browser)
   - **Alternative**: Collapsible tree structure

4. **Maximum cache size**: What default makes sense?
   - **Proposed**: 100MB, configurable in settings
   - **Alternative**: Unlimited, manual clear only

5. **Non-markdown files in folders**: Should we support other file types?
   - **Proposed**: No, markdown only for V1
   - **Alternative**: Support plain text files as well

## 11. References

1. [GitHub REST API - Contents](https://docs.github.com/en/rest/repos/contents)
2. [GitHub Rate Limits](https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api)
3. [Tauri File System Plugin](https://tauri.app/plugin/file-system/)
4. [react-markdown-preview](https://uiwjs.github.io/react-markdown-preview/)
5. [Miku Kanban RFC](./rfc-kanban.md) (internal reference for pattern)

## Appendices

### A. Worked Examples

#### A.1 Pasting Markdown Content

**User action**: User pastes the following markdown:
```markdown
# Getting Started

Welcome to my project documentation.

## Installation

Run `npm install mypackage` to install.
```

**System behavior**:
1. User clicks "Add Entry" -> "Paste Markdown"
2. Dialog opens with title input and content textarea
3. User pastes content, enters title "Getting Started Guide"
4. On submit:
   - `createPastedEntry("Getting Started Guide", content)` called
   - Entry added to document: `{ type: 'pasted', id: 'entry-1-1699...', title: '...', content: '...' }`
   - Document serialized and marked modified
5. Entry appears in sidebar, selected automatically
6. Right panel shows rendered markdown

#### A.2 Importing GitHub File

**User action**: User pastes URL `https://github.com/facebook/react/blob/main/README.md`

**System behavior**:
1. User clicks "Add Entry" -> "Import from GitHub"
2. Dialog opens with URL input
3. User pastes URL
4. On submit:
   - `parseGitHubUrl(url)` returns `{ type: 'file', source: { owner: 'facebook', repo: 'react', branch: 'main', path: 'README.md' } }`
   - `fetchGitHubFile(source)` called
   - Request: `GET https://raw.githubusercontent.com/facebook/react/main/README.md`
   - Response: 200 OK with markdown content
   - Cache key generated: `sha256("facebook/react/README.md/main").slice(0,32)`
   - Content stored in cache: `~/.miku/docs-cache/a3b4c5d6....json`
   - Entry created: `{ type: 'github-file', source, cacheKey, lastFetched: '...', title: 'React' }`
5. Entry appears in sidebar with GitHub icon
6. Content rendered in viewer

#### A.3 Folder Import with Progress

**User action**: User pastes URL `https://github.com/vitejs/vite/tree/main/docs`

**System behavior**:
1. Parse URL -> folder source
2. API request: `GET https://api.github.com/repos/vitejs/vite/contents/docs?ref=main`
3. Response contains 15 items (mix of files and directories)
4. Filter to markdown files: 8 files found
5. Progress: "Fetching 1/8..."
6. For each file:
   - Fetch content from raw URL
   - Store in cache
   - Extract title from first `#` heading
7. Progress: "Fetching 8/8... Complete"
8. Entry created with 8 files in `files` array
9. Sidebar shows collapsible entry with 8 sub-items

### B. Proof of Correctness

#### B.1 Cache Consistency

**Claim**: Cache content always matches the content that would be returned by re-fetching from GitHub at the same SHA.

**Proof sketch**:
1. Content is stored with its source SHA (Git blob hash)
2. GitHub's SHA is computed from the file content
3. If SHA matches, content is identical (cryptographic guarantee)
4. Sync operation compares SHAs before declaring "unchanged"
5. Therefore, cached content with matching SHA is always correct

#### B.2 Offline Availability

**Claim**: Any previously successfully fetched content is available offline.

**Proof sketch**:
1. After successful fetch, content is stored in cache before returning
2. Cache is persisted to disk immediately
3. On cache hit, content is returned without network request
4. Network failures fall back to cache lookup
5. Therefore, cached content survives network unavailability

### C. Alternative Approaches Considered

#### C.1 WebDAV-style Direct File Access

**Approach**: Mount GitHub as a virtual file system using WebDAV or FUSE.

**Why rejected**:
- Requires additional system dependencies
- Complex permission model
- Offline support difficult
- Overkill for documentation reading use case

#### C.2 Git Clone Integration

**Approach**: Clone repositories locally and read from local Git repo.

**Why rejected**:
- Requires Git to be installed
- Disk space intensive
- Complex merge/conflict handling
- Slow for large repos when only docs needed

#### C.3 Browser Extension for Context

**Approach**: Browser extension captures documentation from GitHub while browsing.

**Why rejected**:
- Requires separate installation
- Context switching still required
- Doesn't integrate with editor workflow
- Privacy concerns with extension permissions

#### C.4 Documentation as Code Comments

**Approach**: Parse documentation from code comments in the workspace.

**Why rejected**:
- Only works for projects with extensive doc comments
- Doesn't help with external documentation
- Different problem space (this is for reference docs, not inline docs)
