/**
 * GitHub URL Parser
 * Parses GitHub URLs into structured source objects for file and folder imports
 */

import type {
  GitHubFileSource,
  GitHubFolderSource,
  GitHubUrlParseResult,
} from '@/types';

/**
 * Regular expressions for matching GitHub URL patterns
 */

// Matches: https://raw.githubusercontent.com/owner/repo/branch/path/to/file.md
const RAW_PATTERN = /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+\.(?:md|markdown))$/i;

/**
 * Normalize a GitHub URL by removing trailing slashes and query parameters
 */
function normalizeUrl(url: string): string {
  return url
    .trim()
    .replace(/\/$/, '')         // Remove trailing slash
    .replace(/\?.*$/, '')       // Remove query parameters
    .replace(/#.*$/, '');       // Remove fragment
}

/**
 * Check if a path is likely a markdown file
 */
function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path);
}

/**
 * Intelligently split a combined branch/path string
 * Handles branches with slashes like "feature/my-feature"
 *
 * Strategy: For file URLs, the path must end in .md or .markdown.
 * We work backwards to find where the file path starts.
 */
function splitBranchAndFilePath(combined: string): { branch: string; path: string } | null {
  // The file path must end in .md or .markdown
  // Find the rightmost component that ends in a markdown extension

  const parts = combined.split('/');

  // Find the first part (from left) that when combined with subsequent parts
  // forms a valid markdown file path
  for (let i = 0; i < parts.length; i++) {
    const pathParts = parts.slice(i);
    const path = pathParts.join('/');

    if (isMarkdownPath(path)) {
      const branch = parts.slice(0, i).join('/');
      if (branch) {
        return { branch, path };
      }
    }
  }

  return null;
}

/**
 * Intelligently split a combined branch/path string for folder URLs
 *
 * Strategy: For folder URLs, we assume the branch is a single component
 * unless it starts with known branch prefixes or we detect it's a path
 */
function splitBranchAndFolderPath(combined: string): { branch: string; path: string } | null {
  const parts = combined.split('/');

  if (parts.length < 2) {
    return null;
  }

  // Common branch name patterns
  const branchPrefixes = ['main', 'master', 'develop', 'dev', 'feature', 'fix', 'release', 'hotfix'];

  // Check if first part looks like a known branch pattern
  const firstPart = parts[0].toLowerCase();

  // If first part is a common branch name, use it as the branch
  if (branchPrefixes.includes(firstPart)) {
    return {
      branch: parts[0],
      path: parts.slice(1).join('/'),
    };
  }

  // If first part starts with a version-like pattern (v1, v2.0, etc.)
  if (/^v\d/.test(firstPart)) {
    return {
      branch: parts[0],
      path: parts.slice(1).join('/'),
    };
  }

  // If it looks like a feature branch with prefix/name pattern
  if (firstPart === 'feature' || firstPart === 'fix' || firstPart === 'release') {
    // Assume branch is first two components
    if (parts.length > 2) {
      return {
        branch: parts.slice(0, 2).join('/'),
        path: parts.slice(2).join('/'),
      };
    }
  }

  // Default: first part is branch, rest is path
  return {
    branch: parts[0],
    path: parts.slice(1).join('/'),
  };
}

/**
 * Parse a GitHub URL into a structured source object
 *
 * Supported URL formats:
 * - File: https://github.com/owner/repo/blob/branch/path/to/file.md
 * - Folder: https://github.com/owner/repo/tree/branch/path/to/folder
 * - Raw: https://raw.githubusercontent.com/owner/repo/branch/path/to/file.md
 *
 * @param url - GitHub URL to parse
 * @returns Parse result or null if not a valid GitHub URL
 */
export function parseGitHubUrl(url: string): GitHubUrlParseResult | null {
  const normalized = normalizeUrl(url);

  // Try raw URL pattern first (simpler parsing)
  const rawMatch = normalized.match(RAW_PATTERN);
  if (rawMatch) {
    const [, owner, repo, branch, path] = rawMatch;

    // Validate markdown extension
    if (!isMarkdownPath(path)) {
      return null;
    }

    return {
      type: 'file',
      source: { owner, repo, branch, path },
    };
  }

  // Try standard file URL pattern
  const fileMatch = normalized.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i);
  if (fileMatch) {
    const [, owner, repo, rest] = fileMatch;

    const split = splitBranchAndFilePath(rest);
    if (!split) {
      return null;
    }

    return {
      type: 'file',
      source: {
        owner,
        repo,
        branch: split.branch,
        path: split.path,
      },
    };
  }

  // Try folder URL pattern
  const folderMatch = normalized.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/(.+)$/i);
  if (folderMatch) {
    const [, owner, repo, rest] = folderMatch;

    const split = splitBranchAndFolderPath(rest);
    if (!split) {
      return null;
    }

    return {
      type: 'folder',
      source: {
        owner,
        repo,
        branch: split.branch,
        path: split.path,
      },
    };
  }

  return null;
}

/**
 * Validate that a parsed source looks reasonable
 */
export function validateSource(source: GitHubFileSource | GitHubFolderSource): boolean {
  return (
    source.owner.length > 0 &&
    source.repo.length > 0 &&
    source.branch.length > 0 &&
    source.path.length > 0 &&
    // Basic validation - no special characters in owner/repo
    /^[\w.-]+$/.test(source.owner) &&
    /^[\w.-]+$/.test(source.repo)
  );
}

/**
 * Generate a raw content URL for a file source
 */
export function getRawContentUrl(source: GitHubFileSource): string {
  return `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch}/${source.path}`;
}

/**
 * Generate a GitHub API URL for folder contents
 */
export function getContentsApiUrl(source: GitHubFolderSource): string {
  return `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${source.path}?ref=${source.branch}`;
}

/**
 * Generate a cache key from a file source
 * Uses a simple hash of the full path to ensure uniqueness
 */
export function generateCacheKey(source: GitHubFileSource): string {
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
 * Extract a human-readable title from a path
 */
export function getTitleFromPath(path: string): string {
  const filename = path.split('/').pop() || 'Untitled';

  // Remove extension
  const withoutExt = filename.replace(/\.(md|markdown)$/i, '');

  // Convert kebab-case or snake_case to Title Case
  return withoutExt
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
