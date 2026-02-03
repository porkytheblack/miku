/**
 * GitHub Content Cache Service
 * Manages local caching of fetched GitHub content for offline access
 *
 * Cache location: {appDataDir}/miku/docs-cache/
 * - index.json: Cache index with metadata
 * - {cacheKey}.json: Individual cache entries
 */

import type {
  DocsCacheEntry,
  DocsCacheIndex,
  GitHubFileSource,
} from '@/types';
import { isTauri } from '@/lib/tauri';

// Cache configuration
const CACHE_VERSION = '1.0';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB default
const CACHE_DIR_NAME = 'docs-cache';

// In-memory cache for quick access
let memoryCache: Map<string, DocsCacheEntry> = new Map();
let cacheIndex: DocsCacheIndex | null = null;
let cacheDir: string | null = null;

/**
 * Initialize the cache directory path
 */
async function initCacheDir(): Promise<string> {
  if (cacheDir) return cacheDir;

  if (!isTauri()) {
    // In browser mode, use localStorage as a fallback
    cacheDir = 'browser-cache';
    return cacheDir;
  }

  try {
    const { appDataDir, join } = await import('@tauri-apps/api/path');
    const appData = await appDataDir();
    cacheDir = await join(appData, 'miku', CACHE_DIR_NAME);

    // Ensure the cache directory exists
    const { exists, mkdir } = await import('@tauri-apps/plugin-fs');
    if (!await exists(cacheDir)) {
      await mkdir(cacheDir, { recursive: true });
    }

    return cacheDir;
  } catch (error) {
    console.error('Failed to initialize cache directory:', error);
    cacheDir = 'fallback-cache';
    return cacheDir;
  }
}

/**
 * Load the cache index from disk
 */
async function loadCacheIndex(): Promise<DocsCacheIndex> {
  if (cacheIndex) return cacheIndex;

  const emptyIndex: DocsCacheIndex = {
    version: CACHE_VERSION,
    entries: {},
    totalSize: 0,
  };

  if (!isTauri()) {
    // Browser mode: use localStorage
    try {
      const stored = localStorage.getItem('miku-docs-cache-index');
      if (stored) {
        cacheIndex = JSON.parse(stored);
        return cacheIndex!;
      }
    } catch {
      // Ignore localStorage errors
    }
    cacheIndex = emptyIndex;
    return cacheIndex;
  }

  try {
    const dir = await initCacheDir();
    const { join } = await import('@tauri-apps/api/path');
    const indexPath = await join(dir, 'index.json');

    const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
    if (await exists(indexPath)) {
      const content = await readTextFile(indexPath);
      cacheIndex = JSON.parse(content);

      // Migrate if version mismatch
      if (cacheIndex!.version !== CACHE_VERSION) {
        console.warn('Cache version mismatch, resetting cache');
        cacheIndex = emptyIndex;
      }
    } else {
      cacheIndex = emptyIndex;
    }
  } catch (error) {
    console.error('Failed to load cache index:', error);
    cacheIndex = emptyIndex;
  }

  return cacheIndex!;
}

/**
 * Save the cache index to disk
 */
async function saveCacheIndex(): Promise<void> {
  if (!cacheIndex) return;

  if (!isTauri()) {
    // Browser mode: use localStorage
    try {
      localStorage.setItem('miku-docs-cache-index', JSON.stringify(cacheIndex));
    } catch {
      // Ignore localStorage errors (e.g., quota exceeded)
    }
    return;
  }

  try {
    const dir = await initCacheDir();
    const { join } = await import('@tauri-apps/api/path');
    const indexPath = await join(dir, 'index.json');

    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(indexPath, JSON.stringify(cacheIndex, null, 2));
  } catch (error) {
    console.error('Failed to save cache index:', error);
  }
}

/**
 * Get cached content by key
 * @param cacheKey - The cache key
 * @returns Content if cached, null otherwise
 */
export async function getCachedContent(cacheKey: string): Promise<string | null> {
  // Check memory cache first
  const memEntry = memoryCache.get(cacheKey);
  if (memEntry) {
    // Update access time
    await updateAccessTime(cacheKey);
    return memEntry.content;
  }

  const index = await loadCacheIndex();
  if (!index.entries[cacheKey]) {
    return null;
  }

  if (!isTauri()) {
    // Browser mode: use localStorage
    try {
      const stored = localStorage.getItem(`miku-docs-cache-${cacheKey}`);
      if (stored) {
        const entry: DocsCacheEntry = JSON.parse(stored);
        memoryCache.set(cacheKey, entry);
        await updateAccessTime(cacheKey);
        return entry.content;
      }
    } catch {
      // Ignore localStorage errors
    }
    return null;
  }

  try {
    const dir = await initCacheDir();
    const { join } = await import('@tauri-apps/api/path');
    const entryPath = await join(dir, `${cacheKey}.json`);

    const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
    if (!await exists(entryPath)) {
      // Entry in index but file missing, clean up
      delete index.entries[cacheKey];
      await saveCacheIndex();
      return null;
    }

    const content = await readTextFile(entryPath);
    const entry: DocsCacheEntry = JSON.parse(content);

    // Store in memory cache
    memoryCache.set(cacheKey, entry);

    // Update access time
    await updateAccessTime(cacheKey);

    return entry.content;
  } catch (error) {
    console.error('Failed to read cache entry:', error);
    return null;
  }
}

/**
 * Store content in cache
 * @param entry - Cache entry to store
 */
export async function storeCachedContent(entry: DocsCacheEntry): Promise<void> {
  const index = await loadCacheIndex();

  // Store in memory cache
  memoryCache.set(entry.cacheKey, entry);

  const contentSize = new Blob([entry.content]).size;
  const now = new Date().toISOString();

  // Update index
  const previousSize = index.entries[entry.cacheKey]?.size || 0;
  index.entries[entry.cacheKey] = {
    size: contentSize,
    fetchedAt: entry.fetchedAt,
    accessedAt: now,
  };
  index.totalSize = index.totalSize - previousSize + contentSize;

  // Check if we need to evict
  if (index.totalSize > MAX_CACHE_SIZE) {
    await evictCache(MAX_CACHE_SIZE * 0.8); // Evict down to 80%
  }

  if (!isTauri()) {
    // Browser mode: use localStorage
    try {
      localStorage.setItem(`miku-docs-cache-${entry.cacheKey}`, JSON.stringify(entry));
      await saveCacheIndex();
    } catch {
      // Ignore localStorage errors
    }
    return;
  }

  try {
    const dir = await initCacheDir();
    const { join } = await import('@tauri-apps/api/path');
    const entryPath = await join(dir, `${entry.cacheKey}.json`);

    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(entryPath, JSON.stringify(entry, null, 2));

    await saveCacheIndex();
  } catch (error) {
    console.error('Failed to write cache entry:', error);
  }
}

/**
 * Update the access time for a cache entry
 */
async function updateAccessTime(cacheKey: string): Promise<void> {
  const index = await loadCacheIndex();
  if (index.entries[cacheKey]) {
    index.entries[cacheKey].accessedAt = new Date().toISOString();
    // Debounce index saves - don't save on every access
  }
}

/**
 * Check if content is cached
 * @param cacheKey - The cache key
 * @returns true if cached
 */
export async function isCached(cacheKey: string): Promise<boolean> {
  if (memoryCache.has(cacheKey)) {
    return true;
  }

  const index = await loadCacheIndex();
  return cacheKey in index.entries;
}

/**
 * Get a cached entry with full metadata
 */
export async function getCachedEntry(cacheKey: string): Promise<DocsCacheEntry | null> {
  // Check memory cache first
  const memEntry = memoryCache.get(cacheKey);
  if (memEntry) {
    return memEntry;
  }

  const content = await getCachedContent(cacheKey);
  if (!content) {
    return null;
  }

  return memoryCache.get(cacheKey) || null;
}

/**
 * Clear specific cache entries
 * @param cacheKeys - Keys to clear
 */
export async function clearCacheEntries(cacheKeys: string[]): Promise<void> {
  const index = await loadCacheIndex();

  for (const cacheKey of cacheKeys) {
    // Remove from memory cache
    memoryCache.delete(cacheKey);

    // Remove from index
    if (index.entries[cacheKey]) {
      index.totalSize -= index.entries[cacheKey].size;
      delete index.entries[cacheKey];
    }

    if (!isTauri()) {
      // Browser mode
      try {
        localStorage.removeItem(`miku-docs-cache-${cacheKey}`);
      } catch {
        // Ignore
      }
      continue;
    }

    // Remove file
    try {
      const dir = await initCacheDir();
      const { join } = await import('@tauri-apps/api/path');
      const entryPath = await join(dir, `${cacheKey}.json`);

      const { exists, remove } = await import('@tauri-apps/plugin-fs');
      if (await exists(entryPath)) {
        await remove(entryPath);
      }
    } catch (error) {
      console.error('Failed to remove cache entry:', error);
    }
  }

  await saveCacheIndex();
}

/**
 * Clear entire cache
 */
export async function clearAllCache(): Promise<void> {
  const index = await loadCacheIndex();
  const keys = Object.keys(index.entries);

  await clearCacheEntries(keys);

  // Reset memory state
  memoryCache = new Map();
  cacheIndex = {
    version: CACHE_VERSION,
    entries: {},
    totalSize: 0,
  };

  await saveCacheIndex();
}

/**
 * Evict cache entries using LRU policy
 * @param targetSize - Target cache size in bytes
 */
async function evictCache(targetSize: number): Promise<void> {
  const index = await loadCacheIndex();

  if (index.totalSize <= targetSize) {
    return;
  }

  // Sort entries by access time (oldest first)
  const entries = Object.entries(index.entries)
    .map(([key, meta]) => ({ key, ...meta }))
    .sort((a, b) => new Date(a.accessedAt).getTime() - new Date(b.accessedAt).getTime());

  const keysToRemove: string[] = [];
  let currentSize = index.totalSize;

  for (const entry of entries) {
    if (currentSize <= targetSize) {
      break;
    }
    keysToRemove.push(entry.key);
    currentSize -= entry.size;
  }

  if (keysToRemove.length > 0) {
    console.log(`Evicting ${keysToRemove.length} cache entries to free space`);
    await clearCacheEntries(keysToRemove);
  }
}

/**
 * Get cache statistics
 * @returns Cache size and entry count
 */
export async function getCacheStats(): Promise<{ size: number; entries: number }> {
  const index = await loadCacheIndex();
  return {
    size: index.totalSize,
    entries: Object.keys(index.entries).length,
  };
}

/**
 * Generate a cache key from a file source
 * Uses a simple hash of the full path to ensure uniqueness
 */
export function generateCacheKeyFromSource(source: GitHubFileSource): string {
  const input = `${source.owner}/${source.repo}/${source.branch}/${source.path}`;

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to hex and ensure positive
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');

  // Include some readable parts for debugging
  const safeName = source.path
    .split('/')
    .pop()
    ?.replace(/[^a-zA-Z0-9.-]/g, '-')
    .slice(0, 20) || 'file';

  return `${safeName}-${hashHex}`;
}

/**
 * Flush memory cache (useful for testing or memory pressure)
 */
export function flushMemoryCache(): void {
  memoryCache = new Map();
}

/**
 * Get the cache directory path (for debugging)
 */
export async function getCacheDirectory(): Promise<string> {
  return await initCacheDir();
}
