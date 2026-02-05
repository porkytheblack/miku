/**
 * Theme Engine
 * Handles CSS variable application and theme switching.
 */

import { Theme, ThemeManifest, ThemeColors } from '@/types/theme';

/**
 * CSS variable prefix mapping.
 * Maps semantic token paths to CSS variable names.
 */
const CSS_VAR_MAP: Record<string, string> = {
  // Background
  'background.primary': '--bg-primary',
  'background.secondary': '--bg-secondary',
  'background.tertiary': '--bg-tertiary',

  // Text
  'text.primary': '--text-primary',
  'text.secondary': '--text-secondary',
  'text.tertiary': '--text-tertiary',

  // Accent
  'accent.primary': '--accent-primary',
  'accent.subtle': '--accent-subtle',

  // Border
  'border.default': '--border-default',
  'border.subtle': '--border-subtle',
  'border.focus': '--border-focus',

  // Shadows
  'shadows.sm': '--shadow-sm',
  'shadows.md': '--shadow-md',
  'shadows.lg': '--shadow-lg',

  // Highlights
  'highlights.clarity': '--highlight-clarity',
  'highlights.grammar': '--highlight-grammar',
  'highlights.style': '--highlight-style',
  'highlights.structure': '--highlight-structure',
  'highlights.economy': '--highlight-economy',

  // Syntax
  'syntax.heading': '--md-heading-color',
  'syntax.emphasis': '--md-emphasis-color',
  'syntax.codeBackground': '--md-code-bg',
  'syntax.codeText': '--md-code-color',
  'syntax.link': '--md-link-color',
  'syntax.listMarker': '--md-list-marker-color',
};

/**
 * ID for custom CSS style element.
 */
const CUSTOM_CSS_STYLE_ID = 'miku-theme-custom-css';

/**
 * Convert a semantic token path to CSS variable name.
 * @param path - Dot-notation path like 'background.primary'
 * @returns CSS variable name like '--bg-primary'
 */
export function tokenToCssVar(path: string): string {
  return CSS_VAR_MAP[path] || `--${path.replace(/\./g, '-')}`;
}

/**
 * Extract all color values from a ThemeColors object as flat key-value pairs.
 * @param colors - The theme colors object
 * @returns Map of CSS variable names to color values
 */
export function flattenThemeColors(colors: ThemeColors): Map<string, string> {
  const result = new Map<string, string>();

  const categories: (keyof ThemeColors)[] = [
    'background', 'text', 'accent', 'border', 'shadows', 'highlights', 'syntax'
  ];

  for (const category of categories) {
    const categoryColors = colors[category];
    for (const [token, value] of Object.entries(categoryColors)) {
      const path = `${category}.${token}`;
      const cssVar = tokenToCssVar(path);
      result.set(cssVar, value);
    }
  }

  return result;
}

/**
 * Apply CSS variables to the document root.
 * @param cssVars - Map of CSS variable names to values
 */
export function applyCssVariables(cssVars: Map<string, string>): void {
  const root = document.documentElement;

  for (const [varName, value] of cssVars) {
    root.style.setProperty(varName, value);
  }
}

/**
 * Remove custom CSS style element if it exists.
 */
function removeCustomCss(): void {
  const existing = document.getElementById(CUSTOM_CSS_STYLE_ID);
  if (existing) {
    existing.remove();
  }
}

/**
 * Inject custom CSS into the document.
 * @param css - The CSS string to inject
 * @param themeId - The theme ID for debugging
 */
function injectCustomCss(css: string, themeId: string): void {
  removeCustomCss();

  const style = document.createElement('style');
  style.id = CUSTOM_CSS_STYLE_ID;
  style.setAttribute('data-theme', themeId);
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Update the document class for the theme variant.
 * @param variant - 'light' or 'dark'
 */
export function updateVariantClass(variant: 'light' | 'dark'): void {
  const root = document.documentElement;

  if (variant === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Apply a theme to the document.
 * This sets all CSS variables and updates the dark/light class.
 * @param theme - The theme to apply
 */
export function applyTheme(theme: Theme): void {
  const { manifest } = theme;

  // 1. Flatten and apply CSS variables
  const cssVars = flattenThemeColors(manifest.colors);
  applyCssVariables(cssVars);

  // 2. Update variant class
  updateVariantClass(manifest.variant);

  // 3. Handle custom CSS
  if (manifest.customCss) {
    injectCustomCss(manifest.customCss, manifest.id);
  } else {
    removeCustomCss();
  }

  // 4. Store active theme ID in data attribute for debugging
  document.documentElement.setAttribute('data-theme', manifest.id);
}

/**
 * Extract preview colors from a theme manifest.
 * Used for rendering theme preview swatches in the UI.
 * @param manifest - The theme manifest
 * @returns Preview colors for the theme
 */
export function extractPreviewColors(manifest: ThemeManifest): {
  background: string;
  text: string;
  accent: string;
} {
  return {
    background: manifest.colors.background.primary,
    text: manifest.colors.text.primary,
    accent: manifest.colors.accent.primary,
  };
}

/**
 * Get the current system color scheme preference.
 * @returns 'dark' if system prefers dark mode, 'light' otherwise
 */
export function getSystemColorScheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Subscribe to system color scheme changes.
 * @param callback - Function to call when system preference changes
 * @returns Cleanup function to unsubscribe
 */
export function subscribeToSystemColorScheme(
  callback: (scheme: 'light' | 'dark') => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };

  mediaQuery.addEventListener('change', handler);

  return () => {
    mediaQuery.removeEventListener('change', handler);
  };
}

/**
 * Clear all theme-related CSS variables and classes.
 * Used when resetting to defaults or during cleanup.
 */
export function clearTheme(): void {
  const root = document.documentElement;

  // Remove data attribute
  root.removeAttribute('data-theme');

  // Remove dark class
  root.classList.remove('dark');

  // Remove custom CSS
  removeCustomCss();

  // Note: We don't remove the CSS variables because the defaults
  // are defined in globals.css and will take effect.
}

/**
 * Batch update CSS variables using cssText for better performance.
 * Useful when applying many variables at once.
 * @param cssVars - Map of CSS variable names to values
 */
export function batchApplyCssVariables(cssVars: Map<string, string>): void {
  const root = document.documentElement;

  // Build CSS text
  const cssText = Array.from(cssVars.entries())
    .map(([name, value]) => `${name}: ${value}`)
    .join('; ');

  // Apply in one operation
  root.style.cssText = root.style.cssText + '; ' + cssText;
}
