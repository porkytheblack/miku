/**
 * useKeyboardSounds Hook
 *
 * React hook for integrating keyboard sounds with the editor.
 * Handles initialization, settings synchronization, and cleanup.
 *
 * @see /docs/rfc-mechanical-keyboard-sounds.md
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettings } from '@/context/SettingsContext';
import {
  KeyboardSoundEngine,
  getKeyboardSoundEngine,
  LoadingState,
  ProfileInfo,
} from '@/lib/keyboardSounds';

/**
 * Return type for the useKeyboardSounds hook.
 */
export interface UseKeyboardSoundsReturn {
  /** Whether the sound engine is ready for playback */
  isReady: boolean;

  /** Current loading state */
  loadingState: LoadingState;

  /** Error message if in error state */
  error: string | null;

  /** Available sound profiles */
  profiles: ProfileInfo[];

  /**
   * Play a key sound.
   * Call this from keydown/keyup event handlers.
   *
   * @param keyType - 'keydown' or 'keyup'
   * @param key - The key that was pressed (e.g., 'a', 'Enter', ' ')
   */
  playKeySound: (keyType: 'keydown' | 'keyup', key: string) => void;

  /**
   * Initialize the sound engine.
   * Called automatically on first user interaction when sounds are enabled.
   * Can be called manually to pre-initialize.
   */
  initialize: () => Promise<void>;
}

/**
 * Hook for using keyboard sounds in a component.
 *
 * Handles:
 * - Lazy initialization on first user interaction
 * - Settings synchronization
 * - Engine lifecycle management
 *
 * @example
 * ```tsx
 * function Editor() {
 *   const { playKeySound, isReady } = useKeyboardSounds();
 *
 *   const handleKeyDown = (e: React.KeyboardEvent) => {
 *     playKeySound('keydown', e.key);
 *     // ... rest of handler
 *   };
 *
 *   return <textarea onKeyDown={handleKeyDown} />;
 * }
 * ```
 */
export function useKeyboardSounds(): UseKeyboardSoundsReturn {
  const { settings } = useSettings();
  const engineRef = useRef<KeyboardSoundEngine | null>(null);
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);

  // Get or create engine reference
  const getEngine = useCallback((): KeyboardSoundEngine => {
    if (!engineRef.current) {
      engineRef.current = getKeyboardSoundEngine();
    }
    return engineRef.current;
  }, []);

  // Fetch available profiles eagerly (without initializing audio)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const engine = getEngine();
    engine.fetchAvailableProfiles().then((fetchedProfiles) => {
      setProfiles(fetchedProfiles);
    });
  }, [getEngine]);

  // Initialize the sound engine
  const initialize = useCallback(async (): Promise<void> => {
    // Prevent concurrent initialization
    if (initializingRef.current || initializedRef.current) {
      return;
    }

    // Skip if sounds are disabled
    if (!settings.keyboardSounds.enabled) {
      return;
    }

    // Skip SSR
    if (typeof window === 'undefined') {
      return;
    }

    initializingRef.current = true;

    try {
      const engine = getEngine();
      await engine.initialize();
      initializedRef.current = true;
    } finally {
      initializingRef.current = false;
    }
  }, [settings.keyboardSounds.enabled, getEngine]);

  // Sync settings with engine whenever they change
  useEffect(() => {
    const engine = getEngine();
    engine.updateSettings(settings.keyboardSounds);
  }, [settings.keyboardSounds, getEngine]);

  // Auto-initialize when sounds become enabled
  useEffect(() => {
    if (settings.keyboardSounds.enabled && !initializedRef.current) {
      // Initialize on next user interaction to comply with autoplay policy
      const handleUserInteraction = () => {
        initialize();
        // Remove listeners after first interaction
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
      };

      document.addEventListener('click', handleUserInteraction, { once: true });
      document.addEventListener('keydown', handleUserInteraction, { once: true });

      return () => {
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('keydown', handleUserInteraction);
      };
    }
  }, [settings.keyboardSounds.enabled, initialize]);

  // Play a key sound
  const playKeySound = useCallback(
    (keyType: 'keydown' | 'keyup', key: string): void => {
      // Quick check for disabled sounds
      if (!settings.keyboardSounds.enabled) {
        return;
      }

      const engine = getEngine();

      // Lazy initialization if needed
      if (!initializedRef.current && !initializingRef.current) {
        initialize();
      }

      // Play the sound (engine handles its own ready checks)
      engine.playKeySound(keyType, key);
    },
    [settings.keyboardSounds.enabled, getEngine, initialize]
  );

  // Get current state from engine
  const engine = getEngine();

  // Use profiles from state (eagerly fetched) or from engine (after full init)
  const loadedProfiles = engine.getProfiles();
  const availableProfiles = loadedProfiles.length > 0 ? loadedProfiles : profiles;

  return {
    isReady: engine.isReady(),
    loadingState: engine.getLoadingState(),
    error: engine.getError(),
    profiles: availableProfiles,
    playKeySound,
    initialize,
  };
}

/**
 * Maps a keyboard event key to the appropriate sound type.
 *
 * @param key - The key from a keyboard event
 * @returns The sound type to play
 */
export function mapKeyToSoundType(key: string): 'key' | 'space' | 'enter' | 'backspace' {
  switch (key) {
    case ' ':
    case 'Space':
      return 'space';
    case 'Enter':
      return 'enter';
    case 'Backspace':
      return 'backspace';
    default:
      return 'key';
  }
}

export default useKeyboardSounds;
