/**
 * Theme System Types
 * Based on RFC-001: Extensible Theming System with Installable Themes
 */

/**
 * Theme manifest version for schema evolution.
 * Follows semver: breaking changes increment major version.
 */
export type ThemeManifestVersion = '1.0';

/**
 * Theme variant indicates light/dark base.
 * Used for system preference matching and editor integration.
 */
export type ThemeVariant = 'light' | 'dark';

/**
 * Theme source identifies origin for update/security purposes.
 */
export type ThemeSource = 'builtin' | 'preset' | 'custom';

/**
 * Semantic color tokens organized by purpose.
 * All colors must be valid CSS color values.
 */
export interface ThemeColors {
  /** Background colors for layered UI */
  background: {
    /** Main content area background */
    primary: string;
    /** Sidebar, panels, secondary surfaces */
    secondary: string;
    /** Input fields, hover states, tertiary surfaces */
    tertiary: string;
  };

  /** Text colors for content hierarchy */
  text: {
    /** Primary content, headings */
    primary: string;
    /** Secondary content, labels */
    secondary: string;
    /** Placeholder text, disabled content */
    tertiary: string;
  };

  /** Accent colors for interactive elements */
  accent: {
    /** Primary brand/action color */
    primary: string;
    /** Subtle accent for hover states, selections */
    subtle: string;
  };

  /** Border colors for visual separation */
  border: {
    /** Standard borders between elements */
    default: string;
    /** Subtle borders, dividers */
    subtle: string;
    /** Focus rings, active state borders */
    focus: string;
  };

  /** Shadow definitions (CSS box-shadow values) */
  shadows: {
    /** Subtle elevation (buttons, cards) */
    sm: string;
    /** Medium elevation (dropdowns, popovers) */
    md: string;
    /** High elevation (modals, dialogs) */
    lg: string;
  };

  /** Highlight colors for editor feedback */
  highlights: {
    /** Clarity suggestions */
    clarity: string;
    /** Grammar issues */
    grammar: string;
    /** Style recommendations */
    style: string;
    /** Structure suggestions */
    structure: string;
    /** Word economy suggestions */
    economy: string;
  };

  /** Markdown editor syntax highlighting */
  syntax: {
    /** Heading markers and text */
    heading: string;
    /** Emphasis (italic, bold) */
    emphasis: string;
    /** Code block background */
    codeBackground: string;
    /** Code text color */
    codeText: string;
    /** Link color */
    link: string;
    /** List markers (bullets, numbers) */
    listMarker: string;
  };
}

/**
 * Complete theme manifest structure.
 * This is what gets stored in .json theme files.
 */
export interface ThemeManifest {
  /** Schema version for forward compatibility */
  version: ThemeManifestVersion;

  /** Unique identifier, lowercase alphanumeric with hyphens */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Brief description shown in theme picker */
  description: string;

  /** Theme author information */
  author: {
    name: string;
    url?: string;
  };

  /** Light or dark base variant */
  variant: ThemeVariant;

  /** Optional URL to theme homepage or repository */
  homepage?: string;

  /** Color palette definitions */
  colors: ThemeColors;

  /** Optional custom CSS for advanced theming */
  customCss?: string;
}

/**
 * Internal theme representation with computed metadata.
 * Used by ThemeContext for runtime operations.
 */
export interface Theme {
  manifest: ThemeManifest;
  source: ThemeSource;
  filePath?: string;  // For custom themes only
  loadedAt: number;   // Timestamp for cache invalidation
}

/**
 * User's theme preference stored in settings.
 */
export interface ThemePreference {
  /** Selected theme ID or 'system' for auto-detection */
  selected: string;
  /** Theme to use when system is in light mode */
  lightFallback: string;
  /** Theme to use when system is in dark mode */
  darkFallback: string;
}

/**
 * Central registry for all available themes.
 * Maintains consistent ordering and fast lookup.
 */
export interface ThemeRegistry {
  /** Builtin themes (light, dark) - always available */
  builtin: Map<string, Theme>;

  /** Preset themes (Gruvbox, Tokyo Night, etc.) - shipped with app */
  presets: Map<string, Theme>;

  /** Custom themes - loaded from user's theme directory */
  custom: Map<string, Theme>;
}

/**
 * Theme metadata for UI display.
 * Subset of Theme for list rendering performance.
 */
export interface ThemeListItem {
  id: string;
  name: string;
  description: string;
  variant: ThemeVariant;
  source: ThemeSource;
  previewColors: {
    background: string;
    text: string;
    accent: string;
  };
}

/**
 * Default theme preference.
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = {
  selected: 'system',
  lightFallback: 'light',
  darkFallback: 'dark',
};

/**
 * Supported theme manifest versions.
 */
export const SUPPORTED_THEME_VERSIONS: ThemeManifestVersion[] = ['1.0'];
