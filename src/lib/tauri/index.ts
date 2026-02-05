/**
 * Tauri utilities and re-exports
 */

export * from './commands';

/**
 * Check if we're running inside a Tauri app
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window;
}

/**
 * Opens an external URL in the system's default browser.
 * In Tauri, uses the shell plugin. In browser, uses window.open.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    // Dynamically import to avoid SSR issues
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
  } catch (error) {
    console.error('Failed to open URL with Tauri shell:', error);
    // Fallback to window.open
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Safe wrapper for Tauri commands that falls back gracefully in browser
 */
export async function safeTauriCall<T>(
  tauriFn: () => Promise<T>,
  fallback: T | (() => T | Promise<T>)
): Promise<T> {
  if (!isTauri()) {
    return typeof fallback === 'function' ? (fallback as () => T | Promise<T>)() : fallback;
  }

  try {
    return await tauriFn();
  } catch (error) {
    console.error('Tauri command failed:', error);
    return typeof fallback === 'function' ? (fallback as () => T | Promise<T>)() : fallback;
  }
}
