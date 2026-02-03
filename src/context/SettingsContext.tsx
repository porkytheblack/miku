'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { EditorSettings, DEFAULT_KEYBOARD_SOUND_SETTINGS } from '@/types';
import { isTauri, loadSettings, saveSettings, toBackendSettings, toFrontendSettings } from '@/lib/tauri';

interface SettingsContextType {
  settings: EditorSettings;
  updateSettings: (settings: Partial<EditorSettings>) => void;
  resolvedTheme: 'light' | 'dark';
}

const defaultSettings: EditorSettings = {
  theme: 'system',
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
          setSettings(toFrontendSettings(backendSettings));
        } catch {
          // Fall back to defaults
          setSettings(defaultSettings);
        }
      } else {
        // Load from localStorage (browser mode)
        const saved = localStorage.getItem('miku-settings');
        if (saved) {
          try {
            setSettings({ ...defaultSettings, ...JSON.parse(saved) });
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

      if (settings.theme === 'system') {
        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } else {
        theme = settings.theme;
      }

      setResolvedTheme(theme);

      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    updateTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateTheme);

    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [settings.theme]);

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
