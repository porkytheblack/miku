'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  EditorSettings,
  DEFAULT_KEYBOARD_SOUND_SETTINGS,
  ThemePreference,
  DEFAULT_THEME_PREFERENCE,
  LegacyTheme,
} from '@/types';
import { isTauri, loadSettings, saveSettings, toBackendSettings, toFrontendSettings } from '@/lib/tauri';

interface SettingsContextType {
  settings: EditorSettings;
  updateSettings: (settings: Partial<EditorSettings>) => void;
  /** Resolved theme variant based on themePreference */
  resolvedTheme: 'light' | 'dark';
}

const defaultSettings: EditorSettings = {
  themePreference: DEFAULT_THEME_PREFERENCE,
  fontSize: 16,
  lineHeight: 1.6,
  editorWidth: 720,
  fontFamily: 'mono',
  reviewMode: 'manual',
  aggressiveness: 'balanced',
  writingContext: '',
  soundEnabled: true,
  keyboardSounds: DEFAULT_KEYBOARD_SOUND_SETTINGS,
};

/**
 * Migrate old theme setting to new themePreference format.
 */
function migrateThemeSettings(settings: Partial<EditorSettings>): EditorSettings {
  const result = { ...defaultSettings, ...settings };

  // Migration: convert legacy theme to themePreference
  if (settings.theme && !settings.themePreference) {
    const legacyTheme = settings.theme as LegacyTheme;
    result.themePreference = {
      selected: legacyTheme === 'system' ? 'system' : legacyTheme,
      lightFallback: 'light',
      darkFallback: 'dark',
    };
    // Remove the legacy field after migration
    delete result.theme;
  }

  // Ensure themePreference exists
  if (!result.themePreference) {
    result.themePreference = DEFAULT_THEME_PREFERENCE;
  }

  return result;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<EditorSettings>(defaultSettings);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Load settings on mount
  useEffect(() => {
    setMounted(true);

    const loadInitialSettings = async () => {
      if (isTauri()) {
        // Load from Tauri backend
        try {
          const backendSettings = await loadSettings();
          const frontendSettings = toFrontendSettings(backendSettings);
          setSettings(migrateThemeSettings(frontendSettings));
        } catch {
          // Fall back to defaults
          setSettings(defaultSettings);
        }
      } else {
        // Load from localStorage (browser mode)
        const saved = localStorage.getItem('miku-settings');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setSettings(migrateThemeSettings(parsed));
          } catch {
            // Invalid JSON, use defaults
          }
        }
      }
    };

    loadInitialSettings();
  }, []);

  // Save settings when they change
  const persistSettings = useCallback(async (newSettings: EditorSettings) => {
    if (!mounted) return;

    if (isTauri()) {
      // Save to Tauri backend
      try {
        await saveSettings(toBackendSettings(newSettings));
      } catch (error) {
        console.error('Failed to save settings to Tauri:', error);
      }
    } else {
      // Save to localStorage (browser mode)
      localStorage.setItem('miku-settings', JSON.stringify(newSettings));
    }
  }, [mounted]);

  // Update theme when settings change
  useEffect(() => {
    const updateTheme = () => {
      let theme: 'light' | 'dark' = 'light';
      const { themePreference } = settings;

      if (themePreference.selected === 'system') {
        // Use fallback based on system preference
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const fallbackId = systemDark ? themePreference.darkFallback : themePreference.lightFallback;
        // Determine variant from fallback theme ID
        // For builtin themes, the ID matches the variant
        // For other themes, we check if 'dark' or 'light' is in the name
        theme = fallbackId.includes('dark') || fallbackId === 'dark' ? 'dark' : 'light';
      } else {
        // Direct theme selection
        const selectedId = themePreference.selected;
        theme = selectedId.includes('dark') || selectedId === 'dark' ? 'dark' : 'light';
      }

      setResolvedTheme(theme);

      // Note: The actual theme application is handled by ThemeContext
      // We only track resolvedTheme here for backward compatibility
    };

    updateTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);

    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [settings.themePreference]);

  const updateSettings = useCallback((newSettings: Partial<EditorSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      persistSettings(updated);
      return updated;
    });
  }, [persistSettings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resolvedTheme }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
