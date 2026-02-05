'use client';

import { useEffect } from 'react';
import { isTauri, openExternalUrl } from '@/lib/tauri';

// Re-export for convenience
export { openExternalUrl } from '@/lib/tauri';

/**
 * Checks if a URL is external (http/https)
 */
function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Component that intercepts clicks on external links and opens them
 * in the system's default browser instead of navigating within the app.
 *
 * This component should be mounted once at the application root.
 */
export default function ExternalLinkHandler(): null {
  useEffect(() => {
    // Only set up the handler in Tauri environment
    if (!isTauri()) {
      return;
    }

    const handleClick = async (event: MouseEvent) => {
      // Find the closest anchor element
      const target = event.target as HTMLElement;
      const anchor = target.closest('a');

      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute('href');

      if (!href) {
        return;
      }

      // Check if this is an external URL
      if (isExternalUrl(href)) {
        // Prevent default navigation
        event.preventDefault();
        event.stopPropagation();

        // Open in external browser
        await openExternalUrl(href);
      }
    };

    // Use capture phase to intercept before any other handlers
    document.addEventListener('click', handleClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, []);

  // This component doesn't render anything
  return null;
}
