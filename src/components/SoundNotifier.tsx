'use client';

import { useEffect, useRef } from 'react';
import { useMiku } from '@/context/MikuContext';
import { useSettings } from '@/context/SettingsContext';
import { playCompletionSound, preloadCompletionSound } from '@/lib/audio';

/**
 * Component that listens for Miku status changes and plays sounds
 * This component renders nothing but handles sound notifications
 */
export default function SoundNotifier() {
  const { state } = useMiku();
  const { settings } = useSettings();
  const prevStatusRef = useRef(state.status);

  // Preload sound on mount
  useEffect(() => {
    preloadCompletionSound();
  }, []);

  // Play sound when status changes from 'thinking' to 'ready' or 'idle' (completed)
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    const currentStatus = state.status;

    // Update ref first
    prevStatusRef.current = currentStatus;

    // Only play sound if:
    // 1. Sound is enabled in settings
    // 2. Previous status was 'thinking' (meaning we were processing)
    // 3. Current status is 'ready' or 'idle' (meaning we finished)
    if (
      settings.soundEnabled &&
      prevStatus === 'thinking' &&
      (currentStatus === 'ready' || currentStatus === 'idle')
    ) {
      playCompletionSound();
    }
  }, [state.status, settings.soundEnabled]);

  // This component renders nothing
  return null;
}
