'use client';

import { ReactNode, useCallback, useRef } from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { ThemeProvider } from './ThemeContext';
import { MikuProvider } from './MikuContext';
import { DocumentProvider } from './DocumentContext';
import { WorkspaceProvider } from './WorkspaceContext';
import { ToastProvider } from './ToastContext';
import { UpdateProvider } from './UpdateContext';
import { ThemePreference } from '@/types/theme';

/**
 * Inner wrapper that connects ThemeProvider with SettingsContext.
 */
function ThemeSettingsConnector({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();

  // Use a ref to track if this is the initial mount
  // to avoid updating settings when ThemeProvider initializes
  const isInitialMount = useRef(true);

  // Memoize the callback to prevent infinite update loops.
  // The callback reference must be stable to avoid triggering
  // ThemeContext's useEffect on every render.
  const handlePreferenceChange = useCallback((preference: ThemePreference) => {
    // Skip the initial callback from ThemeProvider initialization
    // to avoid an unnecessary settings update cycle
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    updateSettings({ themePreference: preference });
  }, [updateSettings]);

  return (
    <ThemeProvider
      initialPreference={settings.themePreference}
      onPreferenceChange={handlePreferenceChange}
    >
      {children}
    </ThemeProvider>
  );
}

/**
 * App-wide providers wrapper.
 * Provides all contexts in the correct order with proper dependencies.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ThemeSettingsConnector>
        <WorkspaceProvider>
          <DocumentProvider>
            <MikuProvider>
              <ToastProvider position="bottom-right">
                <UpdateProvider>
                  {children}
                </UpdateProvider>
              </ToastProvider>
            </MikuProvider>
          </DocumentProvider>
        </WorkspaceProvider>
      </ThemeSettingsConnector>
    </SettingsProvider>
  );
}
