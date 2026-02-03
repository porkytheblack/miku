'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isTauri } from '@/lib/tauri';

interface UpdateInfo {
  currentVersion: string;
  newVersion: string;
  releaseNotes: string;
  releaseDate: string;
}

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

interface UpdateContextType {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  downloadProgress: number;
  error: string | null;
  checkForUpdates: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismissUpdate: () => void;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Check for updates on mount (app launch)
  useEffect(() => {
    // Only check for updates in Tauri environment
    if (isTauri()) {
      // Small delay to ensure app is fully loaded
      const timer = setTimeout(() => {
        checkForUpdates();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    if (!isTauri()) {
      console.log('Update checking is only available in the desktop app');
      return;
    }

    setStatus('checking');
    setError(null);

    try {
      // Dynamically import Tauri updater to avoid SSR issues
      const { check } = await import('@tauri-apps/plugin-updater');
      const { getVersion } = await import('@tauri-apps/api/app');

      const currentVersion = await getVersion();
      const update = await check();

      if (update) {
        setUpdateInfo({
          currentVersion,
          newVersion: update.version,
          releaseNotes: update.body || 'No release notes available.',
          releaseDate: update.date || '',
        });
        setStatus('available');
        setDismissed(false);
      } else {
        setStatus('idle');
        setUpdateInfo(null);
      }
    } catch (err) {
      // Silently handle check failures (network issues, etc.)
      // Don't bother the user - just log for debugging
      console.debug('Update check failed (this is normal if offline):', err);
      setStatus('idle');
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!isTauri()) {
      return;
    }

    setStatus('downloading');
    setDownloadProgress(0);

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');

      const update = await check();

      if (!update) {
        setStatus('idle');
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setDownloadProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setDownloadProgress(100);
            break;
        }
      });

      setStatus('ready');

      // Ask user before relaunching - the UI component will handle this
      // For now, just relaunch after a brief moment
      setTimeout(async () => {
        await relaunch();
      }, 1000);
    } catch (err) {
      console.error('Failed to download/install update:', err);
      setError(err instanceof Error ? err.message : 'Failed to install update');
      setStatus('error');
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  // Compute effective status considering dismissal
  const effectiveStatus = dismissed && status === 'available' ? 'idle' : status;

  return (
    <UpdateContext.Provider
      value={{
        status: effectiveStatus,
        updateInfo,
        downloadProgress,
        error,
        checkForUpdates,
        downloadAndInstall,
        dismissUpdate,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  const context = useContext(UpdateContext);
  if (!context) {
    throw new Error('useUpdate must be used within an UpdateProvider');
  }
  return context;
}
