/**
 * Types for keyboard sound system.
 *
 * These types define the structure of the sound manifest file
 * and the internal representation of loaded sound profiles.
 */

/**
 * Structure of the manifest.json file in /public/sounds/keyboards/
 * This is what gets loaded and parsed at runtime.
 */
export interface KeyboardSoundManifest {
  version: string;
  profiles: ManifestProfile[];
}

/**
 * Profile entry in the manifest file.
 * Defines the sound files for a single keyboard profile.
 */
export interface ManifestProfile {
  /** Unique identifier matching the folder name */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Description shown in settings UI */
  description: string;

  /**
   * Volume multiplier for this profile (0.0 - 1.0).
   * Used to normalize volume across profiles.
   */
  baseVolume: number;

  /**
   * Sound file mappings.
   * Each key type maps to an array of WAV filenames.
   */
  sounds: {
    /** Regular key presses (required, should have 3-4 variations) */
    key: string[];

    /** Spacebar sounds (optional, falls back to key) */
    space?: string[];

    /** Enter key sounds (optional, falls back to key) */
    enter?: string[];

    /** Backspace sounds (optional, falls back to key) */
    backspace?: string[];

    /** Key release sounds (optional) */
    keyup?: string[];
  };
}

/**
 * Internal representation of a loaded sound profile.
 * Contains decoded AudioBuffers ready for playback.
 */
export interface LoadedSoundProfile {
  /** Profile ID */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Base volume multiplier */
  baseVolume: number;

  /** Decoded audio buffers for each key type */
  buffers: {
    key: AudioBuffer[];
    space: AudioBuffer[];
    enter: AudioBuffer[];
    backspace: AudioBuffer[];
    keyup: AudioBuffer[];
  };
}

/**
 * Key types that can have distinct sounds.
 */
export type KeySoundType = 'key' | 'space' | 'enter' | 'backspace' | 'keyup';

/**
 * Loading state for the sound engine.
 */
export type SoundEngineLoadingState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Sound engine internal state.
 */
export interface SoundEngineState {
  /** Web Audio API context */
  audioContext: AudioContext | null;

  /** Master gain node for volume control */
  masterGain: GainNode | null;

  /** Loaded sound profiles by ID */
  profiles: Map<string, LoadedSoundProfile>;

  /** Currently active profile ID */
  activeProfileId: string | null;

  /** Current loading state */
  loadingState: SoundEngineLoadingState;

  /** Error message if loadingState is 'error' */
  error: string | null;

  /** Index tracking for round-robin sound selection */
  soundIndices: {
    key: number;
    space: number;
    enter: number;
    backspace: number;
    keyup: number;
  };

  /** Last played timestamp for rate limiting */
  lastPlayedTime: number;
}
