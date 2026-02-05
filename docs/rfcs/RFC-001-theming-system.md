# RFC-001: Extensible Theming System with Installable Themes

## Status
Draft

## Abstract

This RFC proposes a comprehensive theming system for Miku that supports light/dark mode, custom color themes, and installable third-party themes. The system builds upon the existing CSS custom properties foundation while introducing a structured theme schema, theme management infrastructure, and popular preset themes including Gruvbox, Tokyo Night, Catppuccin, Nord, Dracula, and Solarized.

## 1. Introduction

### 1.1 Problem Statement

The current Miku theming system supports only two modes: light and dark (plus system preference detection). Users have no ability to customize colors beyond this binary choice. Many developers and writers have strong preferences for specific color schemes they use across their tools (VS Code, terminal, etc.), and the lack of theme customization reduces Miku's appeal to power users who value visual consistency across their workflow.

### 1.2 Goals

1. **Extensible Theme Schema**: Define a comprehensive, versioned JSON schema for themes that covers all UI elements
2. **Built-in Popular Themes**: Ship with 6+ high-quality themes (Gruvbox, Tokyo Night, Catppuccin, Nord, Dracula, Solarized)
3. **Installable Themes**: Allow users to install custom themes from JSON files
4. **Theme Persistence**: Persist selected theme across sessions using existing settings infrastructure
5. **Instant Theme Switching**: Provide smooth, instant theme switching without page reload
6. **Backward Compatibility**: Maintain full compatibility with existing light/dark mode toggle
7. **Developer Experience**: Make theme creation straightforward with clear documentation and validation

### 1.3 Non-Goals

1. **Theme Marketplace**: This RFC does not cover building a theme marketplace or online distribution
2. **Per-File Theming**: Themes apply globally; per-workspace or per-file theming is out of scope
3. **Custom Fonts in Themes**: Themes control colors and spacing; font customization remains separate
4. **Theme Export**: Exporting user-modified themes is out of scope for this iteration
5. **Programmatic Theme Generation**: AI-assisted or procedural theme generation is not covered

### 1.4 Success Criteria

1. Users can switch between 8+ themes (2 base + 6 community) in under 100ms
2. Custom themes can be installed by placing a JSON file in the themes directory
3. All 856+ existing CSS variable usages continue to work without modification
4. Theme settings persist correctly in both Tauri and browser environments
5. The settings panel provides clear, intuitive theme selection UI

## 2. Background

### 2.1 Current State

Miku currently implements theming via CSS custom properties defined in `src/app/globals.css`:

```css
:root {
  --bg-primary: #FAFAF9;
  --bg-secondary: #F5F5F4;
  --bg-tertiary: #E7E5E4;
  --text-primary: #1C1917;
  /* ... 40+ variables total */
}

.dark {
  --bg-primary: #1C1917;
  --bg-secondary: #292524;
  /* ... dark overrides */
}
```

Theme switching is handled by `SettingsContext.tsx`, which toggles the `.dark` class on `document.documentElement`. Settings persist via:
- **Browser mode**: `localStorage.setItem('miku-settings', ...)`
- **Tauri mode**: `{appDataDir}/miku/settings.json` via Rust backend

The `Theme` type is currently defined as `'light' | 'dark' | 'system'`.

### 2.2 Terminology

| Term | Definition |
|------|------------|
| **Base Theme** | The built-in light/dark themes that ship with Miku |
| **Preset Theme** | Popular community themes bundled with Miku (Gruvbox, etc.) |
| **Custom Theme** | User-installed themes loaded from JSON files |
| **Theme Variant** | Light/dark variant of a theme (e.g., "Gruvbox Light", "Gruvbox Dark") |
| **Color Palette** | The set of color values defined in a theme |
| **Semantic Token** | A CSS variable name that describes purpose, not color (e.g., `--bg-primary`) |
| **Theme Manifest** | The JSON file containing theme metadata and color definitions |

### 2.3 Prior Art

| System | Approach | Strengths | Weaknesses |
|--------|----------|-----------|------------|
| **VS Code** | JSON themes with TextMate scopes | Massive ecosystem, familiar | Complex schema, syntax-focused |
| **Obsidian** | CSS snippets + theme JSON | Highly customizable | Fragmented, inconsistent quality |
| **Linear** | Curated presets only | Consistent quality | No customization |
| **Notion** | Light/dark only | Simple | Extremely limited |
| **Tailwind** | Config-based theme | Developer-friendly | Requires rebuild |

Our approach combines VS Code's JSON schema clarity with Obsidian's file-based installation simplicity while maintaining Linear's focus on curated quality for bundled themes.

## 3. Algorithm Analysis

### 3.1 Candidate Approaches

#### 3.1.1 CSS Custom Properties (Current + Extended)

**Description**: Extend the current CSS variable system with a richer set of semantic tokens. Themes are JSON files that define values for these variables. At runtime, theme application sets CSS variables on `:root`.

**Time Complexity**: O(n) where n = number of CSS variables (~50-100)
**Space Complexity**: O(n) for theme storage, O(1) for application (variables stored in CSSOM)

**Advantages**:
- Zero migration cost for existing styles
- Native browser feature, excellent performance
- Themes are portable and framework-agnostic
- Instant application via `setProperty()`
- No CSS-in-JS runtime overhead

**Disadvantages**:
- Limited to what CSS can express (no conditional logic)
- Variable naming must be consistent across codebase
- No automatic color manipulation (darken, lighten)

**Best Suited For**: Applications with established CSS variable usage (Miku's case)

#### 3.1.2 CSS-in-JS Theme Provider

**Description**: Use a CSS-in-JS library (styled-components, Emotion) with a ThemeProvider context that passes theme values to all styled components.

**Time Complexity**: O(n*m) where n = components, m = styles per component (for style recalculation)
**Space Complexity**: O(n*m) for generated styles

**Advantages**:
- Type-safe theme access
- Dynamic style computation
- Component-scoped theming

**Disadvantages**:
- Requires significant refactor of 36+ components
- Runtime overhead for style generation
- Bundle size increase (~15-25KB)
- Breaks existing Tailwind integration

**Best Suited For**: New projects without existing styling infrastructure

#### 3.1.3 Tailwind Config Themes

**Description**: Define themes in `tailwind.config.js` using CSS variables and Tailwind's theme extension.

**Time Complexity**: O(1) for application (compiled at build time)
**Space Complexity**: O(n) where n = generated utility classes

**Advantages**:
- Integrates with existing Tailwind usage
- Build-time optimization
- Familiar API for Tailwind users

**Disadvantages**:
- Requires rebuild for theme changes (not runtime switchable)
- Complex configuration syntax
- CSS variables still needed for runtime switching

**Best Suited For**: Tailwind-heavy codebases with static theme requirements

#### 3.1.4 Hybrid: CSS Variables + Runtime Theme Engine

**Description**: CSS variables for color application, with a TypeScript theme engine for validation, color manipulation, and theme management.

**Time Complexity**: O(n) for theme application, O(1) for color lookups
**Space Complexity**: O(n) for theme storage + O(1) for active theme

**Advantages**:
- Best of both worlds: CSS performance + JS flexibility
- Type-safe theme definitions with runtime validation
- Can compute derived colors (hover states, etc.)
- Clean separation of concerns

**Disadvantages**:
- More code to maintain
- Slight complexity increase

**Best Suited For**: Applications needing both performance and flexibility (Miku's case)

### 3.2 Comparative Analysis

| Criterion | CSS Variables | CSS-in-JS | Tailwind Config | Hybrid |
|-----------|--------------|-----------|-----------------|--------|
| Migration Cost | None | Very High | Medium | Low |
| Runtime Performance | Excellent | Good | Excellent | Excellent |
| Type Safety | Poor | Excellent | Medium | Good |
| Flexibility | Medium | High | Low | High |
| Bundle Size Impact | None | +15-25KB | None | +2KB |
| Runtime Theme Switching | Yes | Yes | No | Yes |
| Theme Validation | Manual | Automatic | Build-time | Automatic |

### 3.3 Recommendation

**Selected Approach**: Hybrid CSS Variables + Runtime Theme Engine (3.1.4)

**Justification**:

1. **Zero Breaking Changes**: The 856+ existing CSS variable usages across 36 components continue to work unchanged
2. **Performance**: CSS custom properties are the fastest way to apply themes; no runtime style generation
3. **Validation**: TypeScript theme engine validates theme files on load, catching errors early
4. **Derived Colors**: Engine can compute hover states, disabled states, and focus rings from base colors
5. **Future Extensibility**: Clean architecture supports future features (theme creation UI, marketplace)

## 4. Detailed Design

### 4.1 Architecture Overview

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                      Theme System                          │
                    └─────────────────────────────────────────────────────────────┘
                                               │
              ┌────────────────────────────────┼────────────────────────────────┐
              │                                │                                │
              ▼                                ▼                                ▼
     ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
     │  Theme Engine   │            │  Theme Loader   │            │  Theme Store    │
     │  (validation,   │◄──────────►│  (file I/O,     │◄──────────►│  (persistence,  │
     │   application)  │            │   parsing)      │            │   caching)      │
     └─────────────────┘            └─────────────────┘            └─────────────────┘
              │                                │                                │
              │                                │                                │
              ▼                                ▼                                ▼
     ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
     │  CSS Variables  │            │  Theme Files    │            │  Settings.json  │
     │  (runtime DOM)  │            │  (JSON on disk) │            │  (user prefs)   │
     └─────────────────┘            └─────────────────┘            └─────────────────┘


    Data Flow for Theme Application:
    ┌──────────────────────────────────────────────────────────────────────────────┐
    │                                                                              │
    │   User selects theme ──► ThemeContext.setTheme(id) ──► Load theme manifest  │
    │          │                                                     │             │
    │          │                                                     ▼             │
    │          │                                            Validate schema        │
    │          │                                                     │             │
    │          │                                                     ▼             │
    │          │                                            Apply CSS variables    │
    │          │                                                     │             │
    │          │                                                     ▼             │
    │          └──────────────────────────── Persist to settings ◄───┘             │
    │                                                                              │
    └──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Structures

#### 4.2.1 Theme Manifest Schema

```typescript
/**
 * Theme manifest version for schema evolution.
 * Follows semver: breaking changes increment major version.
 */
type ThemeManifestVersion = '1.0';

/**
 * Theme variant indicates light/dark base.
 * Used for system preference matching and editor integration.
 */
type ThemeVariant = 'light' | 'dark';

/**
 * Theme source identifies origin for update/security purposes.
 */
type ThemeSource = 'builtin' | 'preset' | 'custom';

/**
 * Complete theme manifest structure.
 * This is what gets stored in .json theme files.
 */
interface ThemeManifest {
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
 * Semantic color tokens organized by purpose.
 * All colors must be valid CSS color values.
 */
interface ThemeColors {
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
 * Internal theme representation with computed metadata.
 * Used by ThemeContext for runtime operations.
 */
interface Theme {
  manifest: ThemeManifest;
  source: ThemeSource;
  filePath?: string;  // For custom themes only
  loadedAt: number;   // Timestamp for cache invalidation
}

/**
 * User's theme preference stored in settings.
 */
interface ThemePreference {
  /** Selected theme ID or 'system' for auto-detection */
  selected: string | 'system';
  /** Theme to use when system is in light mode */
  lightFallback: string;
  /** Theme to use when system is in dark mode */
  darkFallback: string;
}
```

**Invariants**:
1. `id` must match pattern `/^[a-z0-9-]+$/` (lowercase alphanumeric with hyphens)
2. `id` must be unique across all loaded themes
3. All color values must be valid CSS colors (hex, rgb, rgba, hsl, hsla, named)
4. Shadow values must be valid CSS `box-shadow` syntax
5. `version` must be a supported schema version

**Memory Layout Considerations**:
- Theme manifests are small (~2-4KB JSON), so memory is not a concern
- Only the active theme's colors are applied to DOM; others remain in JS memory
- Custom CSS (if present) is injected as a `<style>` element with theme ID

#### 4.2.2 Theme Registry

```typescript
/**
 * Central registry for all available themes.
 * Maintains consistent ordering and fast lookup.
 */
interface ThemeRegistry {
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
interface ThemeListItem {
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
```

### 4.3 Algorithm Specification

#### 4.3.1 Theme Application

```
PROCEDURE applyTheme(themeId: string)
  REQUIRE: themeId is a valid theme ID or 'system'
  ENSURE: CSS variables on :root reflect the theme's colors
          Settings are persisted with new theme preference

  1. IF themeId === 'system' THEN
       1.1. Detect system preference via matchMedia('(prefers-color-scheme: dark)')
       1.2. SET effectiveId = systemPrefersDark ? settings.darkFallback : settings.lightFallback
     ELSE
       1.2. SET effectiveId = themeId

  2. LOAD theme from registry by effectiveId
     2.1. IF theme not found THEN
            LOG warning "Theme not found, falling back to default"
            SET theme = registry.builtin.get('light')

  3. VALIDATE theme.manifest against schema
     3.1. IF validation fails THEN
            THROW ThemeValidationError with details

  4. APPLY CSS variables to document.documentElement
     4.1. FOR each semantic token in theme.colors:
            SET document.documentElement.style.setProperty(
              '--' + tokenToKebabCase(token),
              theme.colors[token]
            )

  5. UPDATE document class for variant
     5.1. IF theme.manifest.variant === 'dark' THEN
            document.documentElement.classList.add('dark')
          ELSE
            document.documentElement.classList.remove('dark')

  6. INJECT custom CSS if present
     6.1. REMOVE existing custom theme style element
     6.2. IF theme.manifest.customCss THEN
            CREATE <style id="theme-custom-{themeId}">
            SET textContent = theme.manifest.customCss
            APPEND to document.head

  7. PERSIST theme preference to settings
     7.1. CALL updateSettings({ theme: { selected: themeId, ... } })

  8. EMIT 'themeChanged' event for components that need notification

COMPLEXITY: O(n) where n = number of CSS variables (~50-80)
```

#### 4.3.2 Theme Loading

```
PROCEDURE loadThemes()
  REQUIRE: None
  ENSURE: ThemeRegistry contains all valid themes
          Invalid themes are logged but not loaded

  1. INITIALIZE registry with empty Maps

  2. LOAD builtin themes (compiled into application)
     2.1. FOR theme IN [lightTheme, darkTheme]:
            VALIDATE theme
            registry.builtin.set(theme.id, theme)

  3. LOAD preset themes (bundled JSON files)
     3.1. FOR themeFile IN listPresetThemeFiles():
            TRY:
              manifest = JSON.parse(themeFile.content)
              VALIDATE manifest
              theme = { manifest, source: 'preset', loadedAt: Date.now() }
              registry.presets.set(manifest.id, theme)
            CATCH error:
              LOG error "Failed to load preset theme: {themeFile.name}"
              CONTINUE

  4. LOAD custom themes (user's theme directory)
     4.1. SET themesDir = getThemesDirectory()
     4.2. IF NOT exists(themesDir) THEN
            createDirectory(themesDir)
            RETURN registry
     4.3. FOR file IN listFiles(themesDir, '*.json'):
            TRY:
              content = readFile(file.path)
              manifest = JSON.parse(content)
              VALIDATE manifest
              // Check for ID conflicts
              IF registry.has(manifest.id) THEN
                LOG warning "Theme ID conflict: {manifest.id}, skipping"
                CONTINUE
              theme = { manifest, source: 'custom', filePath: file.path, loadedAt: Date.now() }
              registry.custom.set(manifest.id, theme)
            CATCH error:
              LOG error "Failed to load custom theme: {file.name}"
              CONTINUE

  5. RETURN registry

COMPLEXITY: O(n) where n = total number of theme files
```

#### 4.3.3 Theme Validation

```
PROCEDURE validateTheme(manifest: unknown): ThemeManifest
  REQUIRE: manifest is a parsed JSON object
  ENSURE: Returns validated ThemeManifest or throws ThemeValidationError

  1. CHECK required fields exist
     REQUIRE: manifest.version, manifest.id, manifest.name, manifest.variant, manifest.colors

  2. VALIDATE version
     2.1. IF manifest.version NOT IN supportedVersions THEN
            THROW "Unsupported theme version: {manifest.version}"

  3. VALIDATE id format
     3.1. IF NOT /^[a-z0-9-]+$/.test(manifest.id) THEN
            THROW "Invalid theme ID format: must be lowercase alphanumeric with hyphens"
     3.2. IF manifest.id.length < 2 OR manifest.id.length > 50 THEN
            THROW "Theme ID must be 2-50 characters"

  4. VALIDATE variant
     4.1. IF manifest.variant NOT IN ['light', 'dark'] THEN
            THROW "Invalid variant: must be 'light' or 'dark'"

  5. VALIDATE colors structure
     5.1. FOR category IN ['background', 'text', 'accent', 'border', 'shadows', 'highlights', 'syntax']:
            IF NOT manifest.colors[category] THEN
              THROW "Missing color category: {category}"
            FOR token IN requiredTokens[category]:
              IF NOT manifest.colors[category][token] THEN
                THROW "Missing color token: colors.{category}.{token}"
              IF NOT isValidCssColor(manifest.colors[category][token]) THEN
                THROW "Invalid color value: colors.{category}.{token}"

  6. VALIDATE author (if present)
     6.1. IF manifest.author THEN
            REQUIRE: manifest.author.name is string
            IF manifest.author.url AND NOT isValidUrl(manifest.author.url) THEN
              THROW "Invalid author URL"

  7. VALIDATE customCss (if present)
     7.1. IF manifest.customCss THEN
            IF manifest.customCss.length > 50000 THEN
              THROW "Custom CSS exceeds 50KB limit"
            // Basic sanitization check
            IF containsDangerousPatterns(manifest.customCss) THEN
              THROW "Custom CSS contains potentially dangerous patterns"

  8. RETURN manifest as ThemeManifest

COMPLEXITY: O(n) where n = number of color tokens to validate
```

### 4.4 Interface Definition

#### 4.4.1 ThemeContext API

```typescript
/**
 * React context for theme management.
 * Provides theme state and actions to all components.
 */
interface ThemeContextValue {
  /** Currently active theme (resolved, never 'system') */
  activeTheme: Theme;

  /** User's theme preference (may be 'system') */
  preference: ThemePreference;

  /** All available themes, organized by source */
  registry: ThemeRegistry;

  /** Flat list of all themes for UI display */
  themeList: ThemeListItem[];

  /** Whether themes are still loading */
  isLoading: boolean;

  /** Error from last theme operation, if any */
  error: string | null;

  /**
   * Set the active theme by ID.
   * @param themeId - Theme ID or 'system'
   * @throws ThemeNotFoundError if ID is invalid
   */
  setTheme: (themeId: string) => Promise<void>;

  /**
   * Install a custom theme from a file.
   * @param file - JSON file containing theme manifest
   * @returns The installed theme's ID
   * @throws ThemeValidationError if manifest is invalid
   */
  installTheme: (file: File) => Promise<string>;

  /**
   * Uninstall a custom theme.
   * @param themeId - ID of custom theme to remove
   * @throws Error if theme is builtin/preset or not found
   */
  uninstallTheme: (themeId: string) => Promise<void>;

  /**
   * Reload all themes from disk.
   * Useful after external file changes.
   */
  reloadThemes: () => Promise<void>;

  /**
   * Get a specific theme by ID.
   * @returns Theme or undefined if not found
   */
  getTheme: (themeId: string) => Theme | undefined;
}
```

#### 4.4.2 Theme Utility Functions

```typescript
/**
 * Validate a color string is valid CSS.
 * Supports: hex (3,4,6,8 digit), rgb(), rgba(), hsl(), hsla(), named colors
 */
function isValidCssColor(color: string): boolean;

/**
 * Convert a semantic token path to CSS variable name.
 * Example: 'background.primary' -> '--bg-primary'
 */
function tokenToCssVar(path: string): string;

/**
 * Generate preview colors for theme list UI.
 * Extracts key colors for visual preview without loading full theme.
 */
function extractPreviewColors(manifest: ThemeManifest): ThemeListItem['previewColors'];

/**
 * Compute a derived color (e.g., hover state from base).
 * @param base - Base color in any CSS format
 * @param operation - 'lighten' | 'darken' | 'saturate' | 'desaturate'
 * @param amount - 0-100 percentage
 */
function deriveColor(base: string, operation: string, amount: number): string;

/**
 * Get the themes directory path.
 * - Tauri: {appDataDir}/miku/themes
 * - Browser: Not applicable (returns null)
 */
function getThemesDirectory(): string | null;
```

### 4.5 Error Handling

| Error Type | Cause | Recovery Strategy |
|------------|-------|-------------------|
| `ThemeNotFoundError` | Requested theme ID doesn't exist | Fall back to default theme, show toast notification |
| `ThemeValidationError` | Manifest fails schema validation | Skip loading, log details, continue with other themes |
| `ThemeInstallError` | Failed to copy theme file | Show error dialog with reason |
| `ThemeIOError` | File system operation failed | Show error toast, keep current theme |
| `ThemeCSSError` | Custom CSS parsing failed | Apply theme without custom CSS, log warning |

### 4.6 Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Empty themes directory | Create directory, load only builtin/preset themes |
| Corrupt theme JSON | Log error, skip theme, continue loading others |
| Duplicate theme IDs | First loaded wins (builtin > preset > custom), log warning |
| Missing color tokens | Validation fails, theme not loaded |
| Invalid color values | Validation fails, specific token identified in error |
| Very large custom CSS | Reject if > 50KB |
| Theme deleted while active | Detect on next app start, fall back to default |
| System preference changes | Auto-update if user selected 'system' |
| Theme file modified externally | No auto-reload; user can trigger manual reload |
| Concurrent theme switches | Last write wins, intermediate states handled gracefully |

## 5. Implementation Guide

### 5.1 Prerequisites

- TypeScript 5.9+
- React 19.2+
- Tauri 2.x (for desktop file system access)
- Understanding of CSS custom properties
- Familiarity with React Context API

### 5.2 Implementation Order

#### Phase 1: Core Infrastructure (Week 1)

1. **Define Theme Types** (`src/types/theme.ts`)
   - ThemeManifest interface
   - ThemeColors interface
   - ThemePreference interface
   - Theme type combining manifest with metadata

2. **Create Theme Validator** (`src/lib/theme/validator.ts`)
   - Schema validation function
   - Color validation utilities
   - Error types and messages

3. **Build Theme Engine** (`src/lib/theme/engine.ts`)
   - CSS variable application logic
   - Token-to-variable mapping
   - Custom CSS injection

4. **Implement Theme Loader** (`src/lib/theme/loader.ts`)
   - Builtin theme definitions
   - Preset theme loading
   - Custom theme discovery (Tauri)

#### Phase 2: State Management (Week 2)

5. **Create ThemeContext** (`src/context/ThemeContext.tsx`)
   - Theme state management
   - Theme switching logic
   - System preference detection
   - Persistence integration

6. **Update SettingsContext** (`src/context/SettingsContext.tsx`)
   - Add theme preference to EditorSettings
   - Migration for existing users

7. **Update Tauri Backend** (`src-tauri/src/commands.rs`)
   - Add theme_preference to EditorSettings struct
   - Theme file operations (install, uninstall)

#### Phase 3: Bundled Themes (Week 2)

8. **Create Preset Themes**
   - `themes/gruvbox-dark.json`
   - `themes/gruvbox-light.json`
   - `themes/tokyo-night.json`
   - `themes/tokyo-night-light.json`
   - `themes/catppuccin-mocha.json`
   - `themes/catppuccin-latte.json`
   - `themes/nord.json`
   - `themes/dracula.json`
   - `themes/solarized-dark.json`
   - `themes/solarized-light.json`

#### Phase 4: UI Integration (Week 3)

9. **Update SettingsPanel** (`src/components/SettingsPanel.tsx`)
   - Theme picker component
   - Theme preview cards
   - Install/uninstall buttons

10. **Add Theme Preview Component** (`src/components/ThemePreview.tsx`)
    - Visual color swatch display
    - Live preview functionality

#### Phase 5: Testing & Polish (Week 4)

11. **Write Tests**
    - Theme validation tests
    - Theme application tests
    - Context integration tests

12. **Documentation**
    - Theme creation guide
    - Color token reference

### 5.3 Testing Strategy

#### Unit Tests

```typescript
// Theme validation
describe('validateTheme', () => {
  it('accepts valid theme manifest', () => { ... });
  it('rejects missing required fields', () => { ... });
  it('rejects invalid color values', () => { ... });
  it('rejects invalid ID format', () => { ... });
  it('handles edge case color formats', () => { ... });
});

// CSS variable application
describe('applyThemeToDOM', () => {
  it('sets all CSS variables on :root', () => { ... });
  it('adds dark class for dark themes', () => { ... });
  it('removes dark class for light themes', () => { ... });
  it('injects custom CSS when present', () => { ... });
  it('cleans up previous custom CSS', () => { ... });
});
```

#### Integration Tests

```typescript
// ThemeContext
describe('ThemeContext', () => {
  it('loads all themes on mount', () => { ... });
  it('applies theme on setTheme', () => { ... });
  it('persists theme preference', () => { ... });
  it('handles system preference changes', () => { ... });
  it('falls back gracefully on errors', () => { ... });
});
```

#### Visual Regression Tests

- Screenshot comparison for each bundled theme
- Verify all components render correctly with each theme
- Test high contrast and accessibility

### 5.4 Common Pitfalls

| Pitfall | Prevention |
|---------|------------|
| **CSS specificity issues** | Ensure theme CSS variables take precedence over component styles |
| **Flash of wrong theme** | Load theme preference before first render, use SSR-safe initial state |
| **Memory leaks from style injection** | Always remove previous custom CSS before injecting new |
| **Race conditions on rapid switching** | Debounce theme switches, cancel pending operations |
| **Breaking existing styles** | Map new tokens to existing variable names exactly |
| **Invalid JSON in theme files** | Validate on load, provide clear error messages |
| **Large theme files slowing load** | Set size limits, lazy load non-active themes |

## 6. Performance Characteristics

### 6.1 Complexity Analysis

| Operation | Time Complexity | Space Complexity |
|-----------|-----------------|------------------|
| Load all themes | O(n) files | O(n) manifests in memory |
| Apply theme | O(m) CSS vars | O(1) additional |
| Validate theme | O(m) tokens | O(1) |
| Find theme by ID | O(1) Map lookup | O(1) |
| System preference change | O(m) CSS vars | O(1) |

Where n = number of theme files, m = number of CSS variables (~80)

### 6.2 Benchmarking Methodology

```typescript
// Theme application benchmark
async function benchmarkThemeSwitch() {
  const iterations = 100;
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await setTheme(i % 2 === 0 ? 'gruvbox-dark' : 'tokyo-night');
    times.push(performance.now() - start);
  }

  return {
    mean: times.reduce((a, b) => a + b) / iterations,
    p95: times.sort((a, b) => a - b)[Math.floor(iterations * 0.95)],
    max: Math.max(...times)
  };
}
```

### 6.3 Expected Performance

| Metric | Target | Expected |
|--------|--------|----------|
| Theme switch (hot) | < 50ms | ~20ms |
| Theme switch (cold, with validation) | < 100ms | ~50ms |
| Initial theme load | < 200ms | ~100ms |
| Memory per theme | < 10KB | ~3-5KB |
| Total memory (10 themes loaded) | < 100KB | ~50KB |

### 6.4 Optimization Opportunities

1. **Lazy Loading**: Load only active theme fully; others as metadata only
2. **CSS Variable Batching**: Use `cssText` for batch updates instead of individual `setProperty` calls
3. **Theme Caching**: Cache validated themes in memory to skip re-validation
4. **Precomputed Derived Colors**: Store hover/focus variants in manifest rather than computing
5. **Virtual List**: For large custom theme collections, virtualize the theme picker

## 7. Security Considerations

### 7.1 Custom CSS Injection

**Risk**: Malicious custom CSS could be used for UI spoofing or data exfiltration.

**Mitigations**:
1. Size limit: 50KB maximum for custom CSS
2. Sanitization: Block `@import`, `url()` with external URLs, `expression()`
3. Sandboxing: Custom CSS is scoped and cannot override security-critical styles
4. Validation: Parse CSS before injection, reject on parse errors

### 7.2 Theme File Integrity

**Risk**: Corrupted or malicious theme files could crash the application.

**Mitigations**:
1. JSON schema validation on every load
2. Try-catch around all file operations
3. Graceful degradation to default theme on errors
4. No code execution from theme files (JSON-only)

### 7.3 Path Traversal

**Risk**: Theme file paths could be manipulated to read/write outside themes directory.

**Mitigations**:
1. Strict path validation before file operations
2. Only allow `.json` extension for theme files
3. Reject paths containing `..` or absolute paths
4. Tauri's built-in path security policies

## 8. Operational Considerations

### 8.1 Monitoring

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `theme_load_failures` | Count of theme files that failed to load | > 0 (warning) |
| `theme_switch_latency` | Time to apply theme change | > 200ms (p95) |
| `custom_theme_count` | Number of installed custom themes | > 50 (info) |
| `theme_validation_errors` | Count of validation failures | > 5/hour |

### 8.2 Alerting

- **Critical**: Theme system completely fails to initialize (fall back to hardcoded light theme)
- **Warning**: Multiple theme files fail validation on startup
- **Info**: User installs custom theme (for analytics)

### 8.3 Debugging

**Theme not applying correctly**:
1. Check browser DevTools > Elements > Computed for CSS variable values
2. Verify theme ID matches in settings
3. Check console for validation errors
4. Confirm `.dark` class presence/absence on html element

**Custom theme not appearing**:
1. Verify file is in correct directory
2. Check file has `.json` extension
3. Validate JSON syntax
4. Look for ID conflicts with existing themes
5. Check console for load errors

## 9. Migration Plan

### 9.1 Data Migration

**Settings Migration**:

Current format:
```json
{
  "theme": "dark"  // or "light" or "system"
}
```

New format:
```json
{
  "themePreference": {
    "selected": "dark",        // Theme ID or "system"
    "lightFallback": "light",  // Used when selected is "system"
    "darkFallback": "dark"     // Used when selected is "system"
  }
}
```

**Migration Logic**:
```typescript
function migrateSettings(old: OldSettings): NewSettings {
  const theme = old.theme || 'system';

  return {
    ...old,
    themePreference: {
      selected: theme,
      lightFallback: 'light',
      darkFallback: 'dark'
    }
  };
}
```

### 9.2 Rollout Strategy

1. **Phase 1**: Deploy with feature flag disabled, validate no regressions
2. **Phase 2**: Enable for internal testing, gather feedback
3. **Phase 3**: Enable for 10% of users, monitor metrics
4. **Phase 4**: Full rollout, deprecation notice for old format
5. **Phase 5**: Remove migration code after 2 release cycles

## 10. Open Questions

1. **Should themes support font customization?**
   - Pro: More complete theming
   - Con: Scope creep, font licensing issues
   - Current decision: Defer to future RFC

2. **Should custom CSS be sandboxed more strictly?**
   - Current: Basic sanitization
   - Option: Use Shadow DOM isolation
   - Current decision: Start simple, tighten if abuse detected

3. **Should themes be shareable via URL?**
   - Would enable easy theme sharing without file management
   - Requires server-side component
   - Current decision: Out of scope, revisit for v2

4. **How to handle theme updates for installed themes?**
   - Currently: Manual reinstall
   - Could: Check for updates on startup
   - Current decision: Manual for now, evaluate user demand

## 11. References

1. [CSS Custom Properties Specification](https://www.w3.org/TR/css-variables-1/)
2. [VS Code Theme Color Reference](https://code.visualstudio.com/api/references/theme-color)
3. [Obsidian Theme Documentation](https://docs.obsidian.md/Themes)
4. [Gruvbox Color Scheme](https://github.com/morhetz/gruvbox)
5. [Tokyo Night Theme](https://github.com/enkia/tokyo-night-vscode-theme)
6. [Catppuccin Theme](https://github.com/catppuccin/catppuccin)
7. [Nord Theme](https://www.nordtheme.com/)
8. [Dracula Theme](https://draculatheme.com/)
9. [Solarized Theme](https://ethanschoonover.com/solarized/)

## Appendices

### Appendix A: Worked Examples

#### A.1 Applying Gruvbox Dark Theme

Starting state:
- Current theme: `light`
- User selects: "Gruvbox Dark"

Execution trace:

```
1. setTheme('gruvbox-dark') called
2. themeId !== 'system', so effectiveId = 'gruvbox-dark'
3. registry.presets.get('gruvbox-dark') returns Theme object
4. validateTheme(theme.manifest) passes
5. Apply CSS variables:
   document.documentElement.style.setProperty('--bg-primary', '#282828')
   document.documentElement.style.setProperty('--bg-secondary', '#3c3836')
   document.documentElement.style.setProperty('--bg-tertiary', '#504945')
   document.documentElement.style.setProperty('--text-primary', '#ebdbb2')
   document.documentElement.style.setProperty('--text-secondary', '#d5c4a1')
   document.documentElement.style.setProperty('--text-tertiary', '#a89984')
   document.documentElement.style.setProperty('--accent-primary', '#fe8019')
   document.documentElement.style.setProperty('--accent-subtle', '#3c3836')
   ... (continue for all 50+ variables)
6. theme.manifest.variant === 'dark', so:
   document.documentElement.classList.add('dark')
7. No customCss in Gruvbox, skip injection
8. updateSettings({ themePreference: { selected: 'gruvbox-dark', ... } })
9. Emit 'themeChanged' event

Result: All components immediately render with Gruvbox colors
Total time: ~25ms
```

#### A.2 Installing a Custom Theme

User action: Drops `my-custom-theme.json` into themes folder

```json
// my-custom-theme.json
{
  "version": "1.0",
  "id": "my-custom-theme",
  "name": "My Custom Theme",
  "description": "A personalized dark theme",
  "author": { "name": "User" },
  "variant": "dark",
  "colors": {
    "background": {
      "primary": "#1a1a2e",
      "secondary": "#16213e",
      "tertiary": "#0f3460"
    },
    "text": {
      "primary": "#eaeaea",
      "secondary": "#b8b8b8",
      "tertiary": "#7a7a7a"
    },
    "accent": {
      "primary": "#e94560",
      "subtle": "#1a1a2e"
    },
    "border": {
      "default": "#0f3460",
      "subtle": "#16213e",
      "focus": "#e94560"
    },
    "shadows": {
      "sm": "0 1px 2px rgba(0, 0, 0, 0.3)",
      "md": "0 4px 12px rgba(0, 0, 0, 0.4)",
      "lg": "0 8px 24px rgba(0, 0, 0, 0.5)"
    },
    "highlights": {
      "clarity": "rgba(251, 191, 36, 0.3)",
      "grammar": "rgba(248, 113, 113, 0.3)",
      "style": "rgba(96, 165, 250, 0.3)",
      "structure": "rgba(192, 132, 252, 0.3)",
      "economy": "rgba(74, 222, 128, 0.3)"
    },
    "syntax": {
      "heading": "#e94560",
      "emphasis": "#b8b8b8",
      "codeBackground": "#0f3460",
      "codeText": "#eaeaea",
      "link": "#4ea8de",
      "listMarker": "#7a7a7a"
    }
  }
}
```

Execution trace:

```
1. User clicks "Refresh themes" in settings
2. reloadThemes() called
3. listFiles(themesDir) finds 'my-custom-theme.json'
4. readFile('my-custom-theme.json') returns content
5. JSON.parse(content) succeeds
6. validateTheme(manifest):
   - version '1.0' is supported
   - id 'my-custom-theme' matches /^[a-z0-9-]+$/
   - variant 'dark' is valid
   - All color categories present
   - All color values valid CSS
7. Check for ID conflicts: none found
8. Create Theme object:
   {
     manifest: {...},
     source: 'custom',
     filePath: '/path/to/themes/my-custom-theme.json',
     loadedAt: 1706745600000
   }
9. registry.custom.set('my-custom-theme', theme)
10. UI updates to show new theme in picker

User can now select "My Custom Theme" from the theme picker.
```

### Appendix B: Proof of Correctness

#### B.1 Theme Application Correctness

**Claim**: After `applyTheme(id)` completes successfully, all CSS variables in the document match the theme's color definitions.

**Proof**:

1. The function iterates over every key in `theme.colors` (Step 4.1)
2. For each key, it calls `setProperty()` which is a synchronous DOM operation
3. The function only returns after all `setProperty()` calls complete
4. `setProperty()` guarantees the CSS variable is set immediately
5. Therefore, upon return, all variables are set to theme values

**Invariant preserved**: CSS variables always reflect the active theme's colors.

#### B.2 Theme Loading Safety

**Claim**: Invalid theme files cannot crash the application or corrupt the registry.

**Proof**:

1. All file operations are wrapped in try-catch (Step 3.1, 4.3)
2. JSON parsing is wrapped in try-catch
3. Validation is wrapped in try-catch
4. On any error, the loop continues to the next file
5. Only fully validated themes are added to the registry
6. Therefore, the registry only ever contains valid themes

**Invariant preserved**: Registry contains only valid, complete theme definitions.

### Appendix C: Alternative Approaches Considered

#### C.1 CSS-in-JS Migration

**Analysis**: Converting all 36 components with 856+ style usages to CSS-in-JS would require:
- ~40 hours of refactoring work
- Addition of styled-components or Emotion (~20KB bundle increase)
- Retraining team on new styling patterns
- Risk of introducing visual regressions

**Rejection reason**: Cost/benefit ratio unfavorable; CSS variables achieve same goal with zero migration.

#### C.2 Server-Side Theme Rendering

**Analysis**: Pre-render pages with theme variables baked in via SSR.

**Rejection reason**:
- Miku is a client-side app (Next.js but primarily CSR)
- Would complicate deployment
- Would slow down theme switching (requires server round-trip)
- No benefit over client-side CSS variable application

#### C.3 Theme as React Context Values (not CSS vars)

**Analysis**: Pass theme colors through React context, access via `useTheme().colors.background.primary`.

**Rejection reason**:
- Requires modifying every component
- Style updates trigger full React reconciliation
- Cannot leverage Tailwind's CSS variable integration
- Slower than CSS custom properties

---

*Document version: 1.0*
*Last updated: 2026-02-05*
*Author: Claude (AI Assistant)*
