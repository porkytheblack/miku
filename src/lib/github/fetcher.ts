/**
 * GitHub Content Fetcher
 * Fetches markdown content from GitHub with caching and error handling
 */

import type {
  GitHubFileSource,
  GitHubFolderSource,
  GitHubFolderFile,
  DocsFetchOptions,
  DocsFolderFetchOptions,
  DocsFetchResult,
  DocsFolderFetchResult,
  DocsCacheEntry,
} from '@/types';
import {
  getCachedContent,
  getCachedEntry,
  storeCachedContent,
  generateCacheKeyFromSource,
} from './cache';
import { getRawContentUrl, getContentsApiUrl, getTitleFromPath } from './urlParser';
import { extractTitleFromMarkdown } from '../docsParser';

// Default configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_MAX_FILES = 50;
const DEFAULT_MAX_DEPTH = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Check if we're likely offline
 */
function isOffline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return !navigator.onLine;
  }
  return false;
}

/**
 * Parse rate limit info from response headers
 */
function parseRateLimitInfo(headers: Headers): { remaining: number; reset: Date } | null {
  const remaining = headers.get('X-RateLimit-Remaining');
  const reset = headers.get('X-RateLimit-Reset');

  if (remaining !== null && reset !== null) {
    return {
      remaining: parseInt(remaining, 10),
      reset: new Date(parseInt(reset, 10) * 1000),
    };
  }
  return null;
}

/**
 * Create a timeout signal for fetch requests
 */
function createTimeoutSignal(timeout: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeout);
  return controller.signal;
}

/**
 * Fetch content from a GitHub file
 *
 * @param source - Parsed file source
 * @param options - Fetch options including auth token
 * @returns Fetch result with content or error
 */
export async function fetchGitHubFile(
  source: GitHubFileSource,
  options: DocsFetchOptions = {}
): Promise<DocsFetchResult> {
  const {
    authToken,
    timeout = DEFAULT_TIMEOUT,
    useCache = true,
  } = options;

  const cacheKey = generateCacheKeyFromSource(source);

  // Check cache first (unless explicitly disabled)
  if (useCache) {
    const cachedEntry = await getCachedEntry(cacheKey);

    // If we're offline, return cached content if available
    if (isOffline()) {
      if (cachedEntry) {
        return {
          success: true,
          content: cachedEntry.content,
          fromCache: true,
          sha: cachedEntry.sha,
          etag: cachedEntry.etag,
        };
      }
      return {
        success: false,
        error: 'Network unavailable and no cached content',
      };
    }

    // If we have cached content with etag, use conditional request
    if (cachedEntry?.etag) {
      try {
        const result = await fetchWithConditionalRequest(source, cachedEntry, authToken, timeout);
        return result;
      } catch (error) {
        // On network error, return cached content
        console.warn('Fetch failed, using cached content:', error);
        return {
          success: true,
          content: cachedEntry.content,
          fromCache: true,
          sha: cachedEntry.sha,
          etag: cachedEntry.etag,
        };
      }
    }
  }

  // No cache or cache disabled, do a fresh fetch
  try {
    const result = await fetchFresh(source, authToken, timeout);
    return result;
  } catch (error) {
    // Try to return cached content on error
    if (useCache) {
      const cachedContent = await getCachedContent(cacheKey);
      if (cachedContent) {
        return {
          success: true,
          content: cachedContent,
          fromCache: true,
        };
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to fetch: ${message}`,
    };
  }
}

/**
 * Fetch with conditional request using ETag
 */
async function fetchWithConditionalRequest(
  source: GitHubFileSource,
  cachedEntry: DocsCacheEntry,
  authToken?: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<DocsFetchResult> {
  const url = getRawContentUrl(source);

  const headers: Record<string, string> = {
    'Accept': 'text/plain',
    'If-None-Match': cachedEntry.etag!,
  };

  if (authToken) {
    headers['Authorization'] = `token ${authToken}`;
  }

  const response = await fetch(url, {
    headers,
    signal: createTimeoutSignal(timeout),
  });

  // 304 Not Modified - content unchanged
  if (response.status === 304) {
    return {
      success: true,
      content: cachedEntry.content,
      fromCache: true,
      sha: cachedEntry.sha,
      etag: cachedEntry.etag,
    };
  }

  // Handle other responses
  return handleFetchResponse(response, source);
}

/**
 * Fetch fresh content without conditional request
 */
async function fetchFresh(
  source: GitHubFileSource,
  authToken?: string,
  timeout: number = DEFAULT_TIMEOUT
): Promise<DocsFetchResult> {
  const url = getRawContentUrl(source);

  const headers: Record<string, string> = {
    'Accept': 'text/plain',
  };

  if (authToken) {
    headers['Authorization'] = `token ${authToken}`;
  }

  const response = await fetch(url, {
    headers,
    signal: createTimeoutSignal(timeout),
  });

  return handleFetchResponse(response, source);
}

/**
 * Handle fetch response and store in cache
 */
async function handleFetchResponse(
  response: Response,
  source: GitHubFileSource
): Promise<DocsFetchResult> {
  const rateLimitInfo = parseRateLimitInfo(response.headers);

  // Success
  if (response.ok) {
    // Check content length
    const contentLength = response.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large (${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB). Maximum size is 5MB.`,
      };
    }

    const content = await response.text();
    const etag = response.headers.get('ETag') || undefined;

    // Store in cache
    const cacheKey = generateCacheKeyFromSource(source);
    const cacheEntry: DocsCacheEntry = {
      cacheKey,
      content,
      fetchedAt: new Date().toISOString(),
      source,
      etag,
    };
    await storeCachedContent(cacheEntry);

    return {
      success: true,
      content,
      etag,
    };
  }

  // Handle errors
  if (response.status === 404) {
    return {
      success: false,
      error: 'File not found. The file may have been moved or deleted.',
    };
  }

  if (response.status === 403) {
    if (rateLimitInfo && rateLimitInfo.remaining === 0) {
      return {
        success: false,
        error: `Rate limit exceeded. Resets at ${rateLimitInfo.reset.toLocaleTimeString()}.`,
        rateLimitReset: rateLimitInfo.reset,
      };
    }
    return {
      success: false,
      error: 'Access denied. This may be a private repository. Try adding a GitHub token.',
    };
  }

  if (response.status === 401) {
    return {
      success: false,
      error: 'Authentication failed. Check your GitHub token.',
    };
  }

  return {
    success: false,
    error: `GitHub returned status ${response.status}`,
  };
}

/**
 * GitHub API response for contents listing
 */
interface GitHubContentsItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  download_url: string | null;
}

/**
 * Fetch all markdown files from a GitHub folder
 *
 * @param source - Parsed folder source
 * @param options - Fetch options including auth token and limits
 * @returns Folder fetch result with file list or error
 */
export async function fetchGitHubFolder(
  source: GitHubFolderSource,
  options: DocsFolderFetchOptions = {}
): Promise<DocsFolderFetchResult> {
  const {
    authToken,
    timeout = DEFAULT_TIMEOUT,
    maxFiles = DEFAULT_MAX_FILES,
    maxDepth = DEFAULT_MAX_DEPTH,
    onProgress,
  } = options;

  // Check if offline
  if (isOffline()) {
    return {
      success: false,
      error: 'Network unavailable. Cannot fetch folder listing.',
    };
  }

  try {
    const files: GitHubFolderFile[] = [];
    let totalFetched = 0;

    // Recursive function to fetch folder contents
    async function fetchFolderContents(
      folderSource: GitHubFolderSource,
      depth: number = 0,
      pathPrefix: string = ''
    ): Promise<void> {
      if (depth > maxDepth) {
        console.warn(`Max depth (${maxDepth}) reached, skipping deeper folders`);
        return;
      }

      if (files.length >= maxFiles) {
        console.warn(`Max files (${maxFiles}) reached, stopping`);
        return;
      }

      const url = getContentsApiUrl(folderSource);

      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
      };

      if (authToken) {
        headers['Authorization'] = `token ${authToken}`;
      }

      const response = await fetch(url, {
        headers,
        signal: createTimeoutSignal(timeout),
      });

      if (!response.ok) {
        const rateLimitInfo = parseRateLimitInfo(response.headers);

        if (response.status === 404) {
          throw new Error('Folder not found. It may have been moved or deleted.');
        }

        if (response.status === 403) {
          if (rateLimitInfo && rateLimitInfo.remaining === 0) {
            throw new Error(`Rate limit exceeded. Resets at ${rateLimitInfo.reset.toLocaleTimeString()}.`);
          }
          throw new Error('Access denied. This may be a private repository.');
        }

        throw new Error(`GitHub returned status ${response.status}`);
      }

      const items: GitHubContentsItem[] = await response.json();

      // Process items
      for (const item of items) {
        if (files.length >= maxFiles) break;

        if (item.type === 'file' && /\.(md|markdown)$/i.test(item.name)) {
          // Markdown file - fetch content
          const fileSource: GitHubFileSource = {
            owner: folderSource.owner,
            repo: folderSource.repo,
            branch: folderSource.branch,
            path: item.path,
          };

          const cacheKey = generateCacheKeyFromSource(fileSource);

          // Fetch content
          const fetchResult = await fetchGitHubFile(fileSource, {
            authToken,
            timeout,
            useCache: true,
          });

          if (fetchResult.success && fetchResult.content) {
            const relativePath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;
            const title = extractTitleFromMarkdown(fetchResult.content, getTitleFromPath(item.path));

            files.push({
              path: relativePath,
              title,
              cacheKey,
              sha: item.sha,
            });

            totalFetched++;
            onProgress?.(totalFetched, maxFiles);
          }
        } else if (item.type === 'dir' && depth < maxDepth) {
          // Directory - recurse
          const subfolderSource: GitHubFolderSource = {
            owner: folderSource.owner,
            repo: folderSource.repo,
            branch: folderSource.branch,
            path: item.path,
          };

          const newPrefix = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;
          await fetchFolderContents(subfolderSource, depth + 1, newPrefix);
        }
      }
    }

    // Start fetching
    await fetchFolderContents(source);

    if (files.length === 0) {
      return {
        success: false,
        error: 'No markdown files found in this folder.',
      };
    }

    return {
      success: true,
      files,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Sync a single file entry - check for updates
 */
export async function syncGitHubFile(
  source: GitHubFileSource,
  authToken?: string
): Promise<DocsFetchResult> {
  // Force a fresh fetch with conditional request
  return fetchGitHubFile(source, {
    authToken,
    useCache: true,
  });
}

/**
 * Check GitHub API rate limit status
 */
export async function checkRateLimit(
  authToken?: string
): Promise<{ remaining: number; limit: number; reset: Date } | null> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (authToken) {
      headers['Authorization'] = `token ${authToken}`;
    }

    const response = await fetch('https://api.github.com/rate_limit', { headers });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      remaining: data.rate.remaining,
      limit: data.rate.limit,
      reset: new Date(data.rate.reset * 1000),
    };
  } catch {
    return null;
  }
}

/**
 * Validate a GitHub token by making a test API call
 */
export async function validateGitHubToken(token: string): Promise<{
  valid: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        username: data.login,
      };
    }

    if (response.status === 401) {
      return {
        valid: false,
        error: 'Invalid token',
      };
    }

    return {
      valid: false,
      error: `GitHub returned status ${response.status}`,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
