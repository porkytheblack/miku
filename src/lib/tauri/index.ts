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
