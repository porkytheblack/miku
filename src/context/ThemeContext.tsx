'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
  useRef,
} from 'react';
import {
  Theme,
  ThemeRegistry,
  ThemeListItem,
  ThemePreference,
  DEFAULT_THEME_PREFERENCE,
} from '@/types/theme';
import {
  loadAllThemes,
  getThemeFromRegistry,
  getThemeListItems,
  getThemesGroupedBySource,
  LIGHT_THEME_MANIFEST,
  DARK_THEME_MANIFEST,
} from '@/lib/theme/loader';
import {
  applyTheme,
  getSystemColorScheme,
  subscribeToSystemColorScheme,
} from '@/lib/theme/engine';

/**
 * Theme context value interface.
 */
interface ThemeContextValue {
  /** Currently active theme (resolved, never 'system') */
  activeTheme: Theme;

  /** User's theme preference (may be 'system') */
  preference: ThemePreference;

  /** All available themes, organized by source */
  registry: ThemeRegistry | null;

  /** Flat list of all themes for UI display */
  themeList: ThemeListItem[];

  /** Themes grouped by source for UI sections */
  groupedThemes: {
    builtin: ThemeListItem[];
    presets: ThemeListItem[];
    custom: ThemeListItem[];
  };

  /** Whether themes are still loading */
  isLoading: boolean;

  /** Error from last theme operation, if any */
  error: string | null;

  /** Resolved variant (light or dark) based on active theme */
  resolvedVariant: 'light' | 'dark';

  /**
   * Set the active theme by ID.
   * @param themeId - Theme ID or 'system'
   */
  setTheme: (themeId: string) => void;

  /**
   * Update theme preference with fallbacks.
   * @param preference - Partial preference to update
   */
  updatePreference: (preference: Partial<ThemePreference>) => void;

  /**
   * Get a specific theme by ID.
   * @returns Theme or undefined if not found
   */
  getTheme: (themeId: string) => Theme | undefined;

  /**
   * Reload all themes from sources.
   */
  reloadThemes: () => Promise<void>;
}

/**
 * Default light theme as fallback.
 */
const DEFAULT_THEME: Theme = {
  manifest: LIGHT_THEME_MANIFEST,
  source: 'builtin',
  loadedAt: Date.now(),
};

/**
 * Default dark theme as fallback.
 */
const DEFAULT_DARK_THEME: Theme = {
  manifest: DARK_THEME_MANIFEST,
  source: 'builtin',
  loadedAt: Date.now(),
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  /** Initial theme preference (loaded from settings) */
  initialPreference?: ThemePreference;
  /** Callback when preference changes (for persisting to settings) */
  onPreferenceChange?: (preference: ThemePreference) => void;
}

export function ThemeProvider({
  children,
  initialPreference,
  onPreferenceChange,
}: ThemeProviderProps) {
  const [registry, setRegistry] = useState<ThemeRegistry | null>(null);
  const [preference, setPreference] = useState<ThemePreference>(
    initialPreference || DEFAULT_THEME_PREFERENCE
  );
  const [activeTheme, setActiveTheme] = useState<Theme>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemColorScheme, setSystemColorScheme] = useState<'light' | 'dark'>('light');

  // Track if preference was modified by user action (not initialization)
  const preferenceModifiedRef = useRef(false);

  // Initialize system color scheme on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSystemColorScheme(getSystemColorScheme());
    }
  }, []);

  // Subscribe to system color scheme changes
  useEffect(() => {
    const unsubscribe = subscribeToSystemColorScheme((scheme) => {
      setSystemColorScheme(scheme);
    });
    return unsubscribe;
  }, []);

  // Load themes on mount
  useEffect(() => {
    let mounted = true;

    const loadThemes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const loadedRegistry = await loadAllThemes();
        if (mounted) {
          setRegistry(loadedRegistry);
        }
      } catch (err) {
        if (mounted) {
          console.error('Failed to load themes:', err);
          setError(err instanceof Error ? err.message : 'Failed to load themes');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadThemes();

    return () => {
      mounted = false;
    };
  }, []);

  // Resolve effective theme based on preference and system color scheme
  const resolveEffectiveTheme = useCallback(
    (pref: ThemePreference, reg: ThemeRegistry | null): Theme => {
      if (!reg) {
        // Registry not loaded yet, use default based on system preference
        return systemColorScheme === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_THEME;
      }

      let themeId: string;

      if (pref.selected === 'system') {
        // Use fallback based on system preference
        themeId = systemColorScheme === 'dark' ? pref.darkFallback : pref.lightFallback;
      } else {
        themeId = pref.selected;
      }

      // Try to find the theme in registry
      const theme = getThemeFromRegistry(reg, themeId);
      if (theme) {
        return theme;
      }

      // Theme not found, log warning and fall back to builtin
      console.warn(`Theme not found: ${themeId}, falling back to default`);
      return systemColorScheme === 'dark'
        ? reg.builtin.get('dark') || DEFAULT_DARK_THEME
        : reg.builtin.get('light') || DEFAULT_THEME;
    },
    [systemColorScheme]
  );

  // Update active theme when preference, registry, or system scheme changes
  useEffect(() => {
    const effectiveTheme = resolveEffectiveTheme(preference, registry);
    setActiveTheme(effectiveTheme);
    applyTheme(effectiveTheme);
  }, [preference, registry, systemColorScheme, resolveEffectiveTheme]);

  // Notify parent of preference changes (only when user modifies preference)
  useEffect(() => {
    // Only notify parent if the preference was actually modified by user action,
    // not on initial mount or when initialPreference prop changes
    if (onPreferenceChange && preferenceModifiedRef.current) {
      onPreferenceChange(preference);
    }
  }, [preference, onPreferenceChange]);

  // Set theme by ID
  const setTheme = useCallback((themeId: string) => {
    preferenceModifiedRef.current = true;
    setPreference((prev) => ({
      ...prev,
      selected: themeId,
    }));
    setError(null);
  }, []);

  // Update preference with fallbacks
  const updatePreference = useCallback((partial: Partial<ThemePreference>) => {
    preferenceModifiedRef.current = true;
    setPreference((prev) => ({
      ...prev,
      ...partial,
    }));
    setError(null);
  }, []);

  // Get theme by ID
  const getTheme = useCallback(
    (themeId: string): Theme | undefined => {
      if (!registry) return undefined;
      return getThemeFromRegistry(registry, themeId);
    },
    [registry]
  );

  // Reload themes
  const reloadThemes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const loadedRegistry = await loadAllThemes();
      setRegistry(loadedRegistry);
    } catch (err) {
      console.error('Failed to reload themes:', err);
      setError(err instanceof Error ? err.message : 'Failed to reload themes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Compute theme list for UI
  const themeList = useMemo(() => {
    if (!registry) return [];
    return getThemeListItems(registry);
  }, [registry]);

  // Compute grouped themes for UI
  const groupedThemes = useMemo(() => {
    if (!registry) {
      return { builtin: [], presets: [], custom: [] };
    }
    return getThemesGroupedBySource(registry);
  }, [registry]);

  // Compute resolved variant
  const resolvedVariant = activeTheme.manifest.variant;

  const value: ThemeContextValue = {
    activeTheme,
    preference,
    registry,
    themeList,
    groupedThemes,
    isLoading,
    error,
    resolvedVariant,
    setTheme,
    updatePreference,
    getTheme,
    reloadThemes,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Hook to access only the resolved variant (light/dark).
 * Useful for components that only need to know the current mode.
 */
export function useThemeVariant(): 'light' | 'dark' {
  const { resolvedVariant } = useTheme();
  return resolvedVariant;
}

/**
 * Hook to check if a specific theme is active.
 */
export function useIsThemeActive(themeId: string): boolean {
  const { activeTheme, preference } = useTheme();

  if (preference.selected === 'system') {
    // When system is selected, check the actual active theme
    return activeTheme.manifest.id === themeId;
  }

  return preference.selected === themeId;
}
