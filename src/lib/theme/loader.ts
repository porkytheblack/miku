/**
 * Theme Loader
 * Handles loading themes from various sources: builtin, preset, and custom.
 */

import {
  Theme,
  ThemeManifest,
  ThemeRegistry,
  ThemeListItem,
  ThemeSource,
} from '@/types/theme';
import { validateTheme, ThemeValidationError } from './validator';
import { extractPreviewColors } from './engine';

/**
 * Built-in Light Theme
 */
export const LIGHT_THEME_MANIFEST: ThemeManifest = {
  version: '1.0',
  id: 'light',
  name: 'Light',
  description: 'Default light theme with warm stone tones',
  author: { name: 'Miku Team' },
  variant: 'light',
  colors: {
    background: {
      primary: '#FAFAF9',
      secondary: '#F5F5F4',
      tertiary: '#E7E5E4',
    },
    text: {
      primary: '#1C1917',
      secondary: '#57534E',
      tertiary: '#A8A29E',
    },
    accent: {
      primary: '#D97757',
      subtle: '#FDEBE6',
    },
    border: {
      default: '#E7E5E4',
      subtle: '#F0EFEE',
      focus: '#D97757',
    },
    shadows: {
      sm: '0 1px 2px rgba(28, 25, 23, 0.05)',
      md: '0 4px 12px rgba(28, 25, 23, 0.08)',
      lg: '0 8px 24px rgba(28, 25, 23, 0.12)',
    },
    highlights: {
      clarity: 'rgba(251, 191, 36, 0.25)',
      grammar: 'rgba(239, 68, 68, 0.2)',
      style: 'rgba(59, 130, 246, 0.2)',
      structure: 'rgba(168, 85, 247, 0.2)',
      economy: 'rgba(34, 197, 94, 0.2)',
    },
    syntax: {
      heading: '#D97757',
      emphasis: '#57534E',
      codeBackground: '#E7E5E4',
      codeText: '#c7254e',
      link: '#3b82f6',
      listMarker: '#A8A29E',
    },
  },
};

/**
 * Built-in Dark Theme
 */
export const DARK_THEME_MANIFEST: ThemeManifest = {
  version: '1.0',
  id: 'dark',
  name: 'Dark',
  description: 'Default dark theme with warm stone tones',
  author: { name: 'Miku Team' },
  variant: 'dark',
  colors: {
    background: {
      primary: '#1C1917',
      secondary: '#292524',
      tertiary: '#44403C',
    },
    text: {
      primary: '#FAFAF9',
      secondary: '#A8A29E',
      tertiary: '#78716C',
    },
    accent: {
      primary: '#E89B7D',
      subtle: '#2D2420',
    },
    border: {
      default: '#44403C',
      subtle: '#3A3634',
      focus: '#E89B7D',
    },
    shadows: {
      sm: '0 1px 2px rgba(0, 0, 0, 0.2)',
      md: '0 4px 12px rgba(0, 0, 0, 0.3)',
      lg: '0 8px 24px rgba(0, 0, 0, 0.4)',
    },
    highlights: {
      clarity: 'rgba(251, 191, 36, 0.3)',
      grammar: 'rgba(248, 113, 113, 0.3)',
      style: 'rgba(96, 165, 250, 0.3)',
      structure: 'rgba(192, 132, 252, 0.3)',
      economy: 'rgba(74, 222, 128, 0.3)',
    },
    syntax: {
      heading: '#E89B7D',
      emphasis: '#A8A29E',
      codeBackground: '#44403C',
      codeText: '#e83e8c',
      link: '#60a5fa',
      listMarker: '#78716C',
    },
  },
};

/**
 * Create a Theme object from a manifest.
 */
function createTheme(manifest: ThemeManifest, source: ThemeSource, filePath?: string): Theme {
  return {
    manifest,
    source,
    filePath,
    loadedAt: Date.now(),
  };
}

/**
 * Create an empty theme registry.
 */
export function createEmptyRegistry(): ThemeRegistry {
  return {
    builtin: new Map(),
    presets: new Map(),
    custom: new Map(),
  };
}

/**
 * Load built-in themes (always available).
 */
export function loadBuiltinThemes(registry: ThemeRegistry): void {
  registry.builtin.set('light', createTheme(LIGHT_THEME_MANIFEST, 'builtin'));
  registry.builtin.set('dark', createTheme(DARK_THEME_MANIFEST, 'builtin'));
}

/**
 * Preset theme manifests.
 * These are bundled with the application.
 */
const PRESET_THEMES: ThemeManifest[] = [];

/**
 * Register a preset theme.
 * Called during module initialization.
 */
export function registerPresetTheme(manifest: ThemeManifest): void {
  PRESET_THEMES.push(manifest);
}

/**
 * Load preset themes from the bundled collection.
 */
export async function loadPresetThemes(registry: ThemeRegistry): Promise<void> {
  // Import all preset themes
  const presetModules = await Promise.all([
    import('@/themes/gruvbox-dark.json'),
    import('@/themes/gruvbox-light.json'),
    import('@/themes/tokyo-night.json'),
    import('@/themes/tokyo-night-light.json'),
    import('@/themes/catppuccin-mocha.json'),
    import('@/themes/catppuccin-latte.json'),
    import('@/themes/nord.json'),
    import('@/themes/dracula.json'),
    import('@/themes/solarized-dark.json'),
    import('@/themes/solarized-light.json'),
  ]);

  for (const module of presetModules) {
    try {
      const manifest = validateTheme(module.default || module);
      registry.presets.set(manifest.id, createTheme(manifest, 'preset'));
    } catch (error) {
      if (error instanceof ThemeValidationError) {
        console.warn(`Failed to load preset theme:`, error.message, error.details);
      } else {
        console.warn(`Failed to load preset theme:`, error);
      }
    }
  }
}

/**
 * Load all themes into a registry.
 */
export async function loadAllThemes(): Promise<ThemeRegistry> {
  const registry = createEmptyRegistry();

  // Load builtin themes
  loadBuiltinThemes(registry);

  // Load preset themes
  try {
    await loadPresetThemes(registry);
  } catch (error) {
    console.warn('Failed to load some preset themes:', error);
  }

  // Note: Custom themes would be loaded from the file system in Tauri
  // This is a placeholder for future implementation

  return registry;
}

/**
 * Get a theme from the registry by ID.
 * Searches in order: builtin, presets, custom.
 */
export function getThemeFromRegistry(registry: ThemeRegistry, id: string): Theme | undefined {
  return registry.builtin.get(id) ||
         registry.presets.get(id) ||
         registry.custom.get(id);
}

/**
 * Check if a theme ID exists in the registry.
 */
export function hasTheme(registry: ThemeRegistry, id: string): boolean {
  return registry.builtin.has(id) ||
         registry.presets.has(id) ||
         registry.custom.has(id);
}

/**
 * Get all themes as a flat array.
 */
export function getAllThemes(registry: ThemeRegistry): Theme[] {
  return [
    ...Array.from(registry.builtin.values()),
    ...Array.from(registry.presets.values()),
    ...Array.from(registry.custom.values()),
  ];
}

/**
 * Convert a Theme to a ThemeListItem for UI display.
 */
export function themeToListItem(theme: Theme): ThemeListItem {
  return {
    id: theme.manifest.id,
    name: theme.manifest.name,
    description: theme.manifest.description,
    variant: theme.manifest.variant,
    source: theme.source,
    previewColors: extractPreviewColors(theme.manifest),
  };
}

/**
 * Get all themes as list items for UI rendering.
 */
export function getThemeListItems(registry: ThemeRegistry): ThemeListItem[] {
  const themes = getAllThemes(registry);
  return themes.map(themeToListItem);
}

/**
 * Get themes grouped by source.
 */
export function getThemesGroupedBySource(registry: ThemeRegistry): {
  builtin: ThemeListItem[];
  presets: ThemeListItem[];
  custom: ThemeListItem[];
} {
  return {
    builtin: Array.from(registry.builtin.values()).map(themeToListItem),
    presets: Array.from(registry.presets.values()).map(themeToListItem),
    custom: Array.from(registry.custom.values()).map(themeToListItem),
  };
}

/**
 * Get themes filtered by variant.
 */
export function getThemesByVariant(
  registry: ThemeRegistry,
  variant: 'light' | 'dark'
): ThemeListItem[] {
  const all = getAllThemes(registry);
  return all
    .filter(theme => theme.manifest.variant === variant)
    .map(themeToListItem);
}
