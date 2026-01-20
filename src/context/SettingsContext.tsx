'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { EditorSettings, Theme } from '@/types';

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
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<EditorSettings>(defaultSettings);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('miku-settings');
    if (saved) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch {
        // Invalid JSON, use defaults
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('miku-settings', JSON.stringify(settings));
  }, [settings, mounted]);

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

  const updateSettings = (newSettings: Partial<EditorSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

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
