/**
 * Keyboard Sound System
 *
 * This module provides mechanical keyboard sound playback for the editor.
 * Uses Web Audio API with preloaded buffers for low-latency playback.
 *
 * @see /docs/rfc-mechanical-keyboard-sounds.md for full specification
 */

// Re-export types
export type {
  KeyboardSoundManifest,
  ManifestProfile,
  LoadedSoundProfile,
  KeySoundType,
  SoundEngineLoadingState,
  SoundEngineState,
} from './types';

// Constants
export const SOUNDS_BASE_PATH = '/sounds/keyboards';
export const MANIFEST_PATH = `${SOUNDS_BASE_PATH}/manifest.json`;

/**
 * Minimum time between sounds in milliseconds.
 * Prevents audio glitches from rapid key presses.
 */
export const RATE_LIMIT_MS = 10;

/**
 * Default pitch variation range.
 * Applied as +/- percentage to playback rate.
 */
export const DEFAULT_PITCH_VARIATION = 0.02;
