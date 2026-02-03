/**
 * Mechanical Keyboard Sound Engine
 *
 * A high-performance audio engine for playing mechanical keyboard sounds
 * with minimal latency (< 10ms) using the Web Audio API.
 *
 * Supports MechVibes-compatible sound packs in three formats:
 *
 * 1. Single format (key_define_type: "single"):
 *    - Single OGG/WAV file containing all key sounds
 *    - defines: { "scancode": [startMs, durationMs] }
 *
 * 2. Multi v1 format (key_define_type: "multi", no version field):
 *    - Individual sound files per key
 *    - defines: { "scancode": "filename.wav" }
 *
 * 3. Multi v2 format (key_define_type: "multi", version: 2):
 *    - Pattern-based sound files with {0-4} for random selection
 *    - sound: "GENERIC_R{0-4}.mp3" for generic keydown
 *    - soundup: "release/GENERIC.mp3" for generic keyup
 *    - defines: { "scancode": "keydown.mp3", "scancode-up": "keyup.mp3" }
 *
 * Profiles are discovered dynamically from /public/sounds/keyboards/manifest.json
 * Any folder with a valid config.json + sound file(s) can be added.
 *
 * @see /docs/rfc-mechanical-keyboard-sounds.md
 */

import {
  KeyboardSoundSettings,
  KeyboardSoundProfileId,
  DEFAULT_KEYBOARD_SOUND_SETTINGS,
} from '@/types';

// ============================================
// Type Definitions
// ============================================

/**
 * MechVibes-compatible config.json structure - supports all three formats
 */
export interface MechVibesConfig {
  id: string;
  name: string;
  key_define_type: 'single' | 'multi';
  includes_numpad?: boolean;
  /** For single: the audio file. For multi v2: pattern like "GENERIC_R{0-4}.mp3" */
  sound: string;
  /** For multi v2: pattern for generic keyup sound */
  soundup?: string;
  /** Version field - only present in multi v2 configs */
  version?: number;
  /** Key definitions - format varies by type */
  defines: Record<string, [number, number] | string | null>;
}

/**
 * Manifest file structure listing available profiles
 */
export interface ProfilesManifest {
  profiles: string[]; // List of folder names
}

/**
 * Profile format type for internal use
 */
export type ProfileFormat = 'single' | 'multi-v1' | 'multi-v2';

/**
 * Loaded sound profile with decoded audio
 */
export interface LoadedProfile {
  id: string;
  name: string;
  description: string;
  config: MechVibesConfig;
  format: ProfileFormat;
  /** For single format: the main audio buffer */
  audioBuffer?: AudioBuffer;
  /** For multi formats: map of filename -> AudioBuffer */
  audioBuffers?: Map<string, AudioBuffer>;
  /** For multi-v2: preloaded generic sounds (random selection) */
  genericDownBuffers?: AudioBuffer[];
  /** For multi-v2: preloaded generic keyup sound */
  genericUpBuffer?: AudioBuffer;
  baseVolume: number;
}

/**
 * Profile metadata for UI display
 */
export interface ProfileInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * Loading state for UI feedback
 */
export type LoadingState = 'idle' | 'loading' | 'ready' | 'error';

// ============================================
// Key Code Mapping
// ============================================

/**
 * Maps browser KeyboardEvent.code to MechVibes scancode.
 * MechVibes uses Windows virtual key codes / scancodes.
 */
const KEY_CODE_TO_SCANCODE: Record<string, number> = {
  // Row 1: Function keys
  Escape: 1,
  F1: 59,
  F2: 60,
  F3: 61,
  F4: 62,
  F5: 63,
  F6: 64,
  F7: 65,
  F8: 66,
  F9: 67,
  F10: 68,
  F11: 87,
  F12: 88,

  // Row 2: Number row
  Backquote: 41, // `~
  Digit1: 2,
  Digit2: 3,
  Digit3: 4,
  Digit4: 5,
  Digit5: 6,
  Digit6: 7,
  Digit7: 8,
  Digit8: 9,
  Digit9: 10,
  Digit0: 11,
  Minus: 12,
  Equal: 13,
  Backspace: 14,

  // Row 3: QWERTY
  Tab: 15,
  KeyQ: 16,
  KeyW: 17,
  KeyE: 18,
  KeyR: 19,
  KeyT: 20,
  KeyY: 21,
  KeyU: 22,
  KeyI: 23,
  KeyO: 24,
  KeyP: 25,
  BracketLeft: 26,
  BracketRight: 27,
  Backslash: 43,

  // Row 4: ASDF
  CapsLock: 58,
  KeyA: 30,
  KeyS: 31,
  KeyD: 32,
  KeyF: 33,
  KeyG: 34,
  KeyH: 35,
  KeyJ: 36,
  KeyK: 37,
  KeyL: 38,
  Semicolon: 39,
  Quote: 40,
  Enter: 28,

  // Row 5: ZXCV
  ShiftLeft: 42,
  KeyZ: 44,
  KeyX: 45,
  KeyC: 46,
  KeyV: 47,
  KeyB: 48,
  KeyN: 49,
  KeyM: 50,
  Comma: 51,
  Period: 52,
  Slash: 53,
  ShiftRight: 54,

  // Row 6: Bottom
  ControlLeft: 29,
  MetaLeft: 3675, // Windows key
  AltLeft: 56,
  Space: 57,
  AltRight: 3640,
  MetaRight: 3676,
  ContextMenu: 3677,
  ControlRight: 3613,

  // Navigation cluster
  PrintScreen: 3639,
  ScrollLock: 70,
  Pause: 3653,
  Insert: 3666,
  Home: 3655,
  PageUp: 3657,
  Delete: 3667,
  End: 3663,
  PageDown: 3665,

  // Arrow keys
  ArrowUp: 57416,
  ArrowLeft: 57419,
  ArrowDown: 57424,
  ArrowRight: 57421,

  // Numpad
  NumLock: 69,
  NumpadDivide: 3637,
  NumpadMultiply: 55,
  NumpadSubtract: 74,
  Numpad7: 71,
  Numpad8: 72,
  Numpad9: 73,
  NumpadAdd: 78,
  Numpad4: 75,
  Numpad5: 76,
  Numpad6: 77,
  Numpad1: 79,
  Numpad2: 80,
  Numpad3: 81,
  NumpadEnter: 3612,
  Numpad0: 82,
  NumpadDecimal: 83,
};

const SOUNDS_BASE_PATH = '/sounds/keyboards';

// ============================================
// Internal State
// ============================================

interface KeyboardSoundEngineState {
  audioContext: AudioContext | null;
  masterGain: GainNode | null;
  profiles: Map<string, LoadedProfile>;
  availableProfiles: ProfileInfo[];
  activeProfileId: string | null;
  loadingState: LoadingState;
  error: string | null;
  lastPlayedTime: number;
  settings: KeyboardSoundSettings;
  initializationAttempted: boolean;
  /** Cache of available scancodes per profile for random selection */
  profileScancodes: Map<string, number[]>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Determine the profile format from config
 */
function detectProfileFormat(config: MechVibesConfig): ProfileFormat {
  if (config.key_define_type === 'single') {
    return 'single';
  }
  // Multi format - check for version 2 indicators
  if (config.version === 2 || config.soundup || config.sound.includes('{')) {
    return 'multi-v2';
  }
  return 'multi-v1';
}

/**
 * Expand a pattern like "GENERIC_R{0-4}.mp3" into individual filenames
 */
function expandPattern(pattern: string): string[] {
  const match = pattern.match(/\{(\d+)-(\d+)\}/);
  if (!match) {
    return [pattern];
  }

  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);
  const results: string[] = [];

  for (let i = start; i <= end; i++) {
    results.push(pattern.replace(match[0], i.toString()));
  }

  return results;
}

// ============================================
// KeyboardSoundEngine Class
// ============================================

/**
 * Singleton engine for keyboard sound playback.
 * Supports MechVibes-compatible sound packs in all three formats.
 * Profiles are discovered dynamically from manifest.json.
 */
export class KeyboardSoundEngine {
  private static instance: KeyboardSoundEngine | null = null;

  private state: KeyboardSoundEngineState = {
    audioContext: null,
    masterGain: null,
    profiles: new Map(),
    availableProfiles: [],
    activeProfileId: null,
    loadingState: 'idle',
    error: null,
    lastPlayedTime: 0,
    settings: { ...DEFAULT_KEYBOARD_SOUND_SETTINGS },
    initializationAttempted: false,
    profileScancodes: new Map(),
  };

  private constructor() {}

  public static getInstance(): KeyboardSoundEngine {
    if (!KeyboardSoundEngine.instance) {
      KeyboardSoundEngine.instance = new KeyboardSoundEngine();
    }
    return KeyboardSoundEngine.instance;
  }

  public static resetInstance(): void {
    if (KeyboardSoundEngine.instance) {
      KeyboardSoundEngine.instance.dispose();
      KeyboardSoundEngine.instance = null;
    }
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Initialize the audio engine.
   */
  public async initialize(): Promise<void> {
    if (this.state.loadingState === 'ready' || this.state.loadingState === 'loading') {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    this.state.initializationAttempted = true;

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      this.state.loadingState = 'error';
      this.state.error = 'Web Audio API not supported';
      console.warn('[KeyboardSounds] Web Audio API not supported');
      return;
    }

    try {
      this.state.audioContext = new AudioContextClass({
        latencyHint: 'interactive',
      });

      this.state.masterGain = this.state.audioContext.createGain();
      this.state.masterGain.connect(this.state.audioContext.destination);
      this.state.masterGain.gain.value = 1.0;

      if (this.state.audioContext.state === 'suspended') {
        await this.state.audioContext.resume();
      }

      this.state.loadingState = 'loading';

      // Discover and load profiles
      await this.discoverAndLoadProfiles();

      if (this.state.profiles.size > 0) {
        // Use preferred profile if available, otherwise first available
        const preferredProfile = this.state.settings.profileId
          ? this.state.profiles.get(this.state.settings.profileId)
          : undefined;

        if (preferredProfile) {
          this.state.activeProfileId = this.state.settings.profileId;
        } else {
          this.state.activeProfileId = this.state.profiles.keys().next().value ?? null;
        }
        this.state.loadingState = 'ready';

        if (process.env.NODE_ENV === 'development') {
          console.log(
            '[KeyboardSounds] Initialized with latency:',
            (this.state.audioContext.baseLatency * 1000).toFixed(2),
            'ms'
          );
          console.log('[KeyboardSounds] Loaded profiles:', Array.from(this.state.profiles.keys()));
        }
      } else {
        this.state.loadingState = 'error';
        this.state.error = 'No sound profiles could be loaded';
        console.warn('[KeyboardSounds] No sound profiles could be loaded');
      }
    } catch (error) {
      this.state.loadingState = 'error';
      this.state.error = error instanceof Error ? error.message : 'Failed to initialize audio';
      console.error('[KeyboardSounds] Initialization error:', error);
    }
  }

  /**
   * Play a key sound using KeyboardEvent.code
   */
  public playKeySound(keyType: 'keydown' | 'keyup', code: string): void {
    if (!this.state.settings.enabled) return;
    if (this.state.loadingState !== 'ready') return;
    if (!this.state.audioContext || !this.state.masterGain) return;

    // Skip keyup if not enabled
    if (keyType === 'keyup' && !this.state.settings.playKeyupSounds) return;

    // Resume context if suspended
    if (this.state.audioContext.state === 'suspended') {
      this.state.audioContext.resume();
    }

    // Rate limiting
    const now = performance.now();
    if (now - this.state.lastPlayedTime < 10) {
      return;
    }
    this.state.lastPlayedTime = now;

    const profile = this.state.activeProfileId
      ? this.state.profiles.get(this.state.activeProfileId)
      : undefined;
    if (!profile) return;

    // Get scancode for this key
    let scancode = KEY_CODE_TO_SCANCODE[code];

    // If no direct mapping, use a generic scancode
    if (scancode === undefined) {
      scancode = 30; // Fallback to 'A' key scancode
    }

    // Play sound based on profile format
    switch (profile.format) {
      case 'single':
        this.playSingleFormat(profile, scancode);
        break;
      case 'multi-v1':
        this.playMultiV1Format(profile, scancode);
        break;
      case 'multi-v2':
        this.playMultiV2Format(profile, scancode, keyType);
        break;
    }
  }

  /**
   * Play sound for single format profile
   */
  private playSingleFormat(profile: LoadedProfile, scancode: number): void {
    if (!profile.audioBuffer) return;

    const timing = profile.config.defines[scancode.toString()];

    // If this specific key isn't defined, pick a random one
    if (!timing || !Array.isArray(timing)) {
      const availableScancodes = this.state.profileScancodes.get(profile.id);
      if (availableScancodes && availableScancodes.length > 0) {
        const randomScancode =
          availableScancodes[Math.floor(Math.random() * availableScancodes.length)];
        const randomTiming = profile.config.defines[randomScancode.toString()];
        if (randomTiming && Array.isArray(randomTiming)) {
          this.playSoundSlice(profile.audioBuffer, randomTiming[0], randomTiming[1]);
        }
      }
      return;
    }

    const [startMs, durationMs] = timing;
    this.playSoundSlice(profile.audioBuffer, startMs, durationMs);
  }

  /**
   * Play sound for multi v1 format profile (individual files per key)
   */
  private playMultiV1Format(profile: LoadedProfile, scancode: number): void {
    if (!profile.audioBuffers) return;

    let filename = profile.config.defines[scancode.toString()];

    // Skip if null (disabled key)
    if (filename === null) return;

    // If this specific key isn't defined, pick a random one
    if (!filename || typeof filename !== 'string') {
      const availableScancodes = this.state.profileScancodes.get(profile.id);
      if (availableScancodes && availableScancodes.length > 0) {
        const randomScancode =
          availableScancodes[Math.floor(Math.random() * availableScancodes.length)];
        filename = profile.config.defines[randomScancode.toString()] as string;
      }
    }

    if (!filename || typeof filename !== 'string') return;

    const buffer = profile.audioBuffers.get(filename);
    if (buffer) {
      this.playFullBuffer(buffer);
    }
  }

  /**
   * Play sound for multi v2 format profile (pattern-based with keyup)
   */
  private playMultiV2Format(
    profile: LoadedProfile,
    scancode: number,
    keyType: 'keydown' | 'keyup'
  ): void {
    if (!profile.audioBuffers) return;

    const scancodeStr = scancode.toString();
    const keyupScancodeStr = `${scancode}-up`;

    if (keyType === 'keyup') {
      // Check for specific keyup sound
      const keyupFilename = profile.config.defines[keyupScancodeStr];
      if (keyupFilename && typeof keyupFilename === 'string') {
        const buffer = profile.audioBuffers.get(keyupFilename);
        if (buffer) {
          this.playFullBuffer(buffer);
          return;
        }
      }

      // Fall back to generic keyup sound
      if (profile.genericUpBuffer) {
        this.playFullBuffer(profile.genericUpBuffer);
      }
      return;
    }

    // Keydown: check for specific key sound first
    const keydownFilename = profile.config.defines[scancodeStr];
    if (keydownFilename && typeof keydownFilename === 'string' && !keydownFilename.includes('-up')) {
      const buffer = profile.audioBuffers.get(keydownFilename);
      if (buffer) {
        this.playFullBuffer(buffer);
        return;
      }
    }

    // Fall back to generic keydown sound (random selection)
    if (profile.genericDownBuffers && profile.genericDownBuffers.length > 0) {
      const randomIndex = Math.floor(Math.random() * profile.genericDownBuffers.length);
      this.playFullBuffer(profile.genericDownBuffers[randomIndex]);
    }
  }

  /**
   * Play a slice of an audio buffer (for single format)
   */
  private playSoundSlice(buffer: AudioBuffer, startMs: number, durationMs: number): void {
    if (!this.state.audioContext || !this.state.masterGain) return;

    const source = this.state.audioContext.createBufferSource();
    source.buffer = buffer;

    // Apply pitch variation
    if (this.state.settings.pitchVariation > 0) {
      const variation = 1 + (Math.random() * 2 - 1) * this.state.settings.pitchVariation;
      source.playbackRate.value = variation;
    }

    // Create gain node for volume
    const gainNode = this.state.audioContext.createGain();
    gainNode.gain.value = this.state.settings.volume;

    source.connect(gainNode);
    gainNode.connect(this.state.masterGain);

    // Convert ms to seconds and play the slice
    const startSec = startMs / 1000;
    const durationSec = durationMs / 1000;
    source.start(0, startSec, durationSec);
  }

  /**
   * Play a full audio buffer (for multi formats)
   */
  private playFullBuffer(buffer: AudioBuffer): void {
    if (!this.state.audioContext || !this.state.masterGain) return;

    const source = this.state.audioContext.createBufferSource();
    source.buffer = buffer;

    // Apply pitch variation
    if (this.state.settings.pitchVariation > 0) {
      const variation = 1 + (Math.random() * 2 - 1) * this.state.settings.pitchVariation;
      source.playbackRate.value = variation;
    }

    // Create gain node for volume
    const gainNode = this.state.audioContext.createGain();
    gainNode.gain.value = this.state.settings.volume;

    source.connect(gainNode);
    gainNode.connect(this.state.masterGain);

    source.start(0);
  }

  public updateSettings(settings: Partial<KeyboardSoundSettings>): void {
    this.state.settings = { ...this.state.settings, ...settings };

    if (settings.profileId && settings.profileId !== this.state.activeProfileId) {
      const newProfile = this.state.profiles.get(settings.profileId);
      if (newProfile) {
        this.state.activeProfileId = settings.profileId;
      }
    }
  }

  public getSettings(): KeyboardSoundSettings {
    return { ...this.state.settings };
  }

  public getLoadingState(): LoadingState {
    return this.state.loadingState;
  }

  public getError(): string | null {
    return this.state.error;
  }

  /**
   * Get all available profiles (from manifest)
   */
  public getProfiles(): ProfileInfo[] {
    return this.state.availableProfiles;
  }

  /**
   * Get only the successfully loaded profiles
   */
  public getLoadedProfiles(): ProfileInfo[] {
    return Array.from(this.state.profiles.values()).map(
      ({ id, name, description }): ProfileInfo => ({
        id,
        name,
        description,
      })
    );
  }

  public setActiveProfile(profileId: KeyboardSoundProfileId): boolean {
    const profile = this.state.profiles.get(profileId);
    if (profile) {
      this.state.activeProfileId = profileId;
      this.state.settings.profileId = profileId;
      return true;
    }
    return false;
  }

  public getActiveProfileId(): string | null {
    return this.state.activeProfileId;
  }

  public isReady(): boolean {
    return this.state.loadingState === 'ready';
  }

  /**
   * Fetch available profiles from manifest without initializing audio.
   * This is useful for populating UI dropdowns before user interaction.
   */
  public async fetchAvailableProfiles(): Promise<ProfileInfo[]> {
    // If we already have profiles loaded, return them
    if (this.state.availableProfiles.length > 0) {
      return this.state.availableProfiles;
    }

    try {
      // Load manifest to get list of available profiles
      const manifestResponse = await fetch(`${SOUNDS_BASE_PATH}/manifest.json`);
      if (!manifestResponse.ok) {
        console.warn('[KeyboardSounds] No manifest.json found');
        return [];
      }

      const manifest: ProfilesManifest = await manifestResponse.json();

      if (!manifest.profiles || manifest.profiles.length === 0) {
        return [];
      }

      // Fetch config.json for each profile to get names
      const profilePromises = manifest.profiles.map(async (folderName): Promise<ProfileInfo | null> => {
        try {
          const configResponse = await fetch(`${SOUNDS_BASE_PATH}/${folderName}/config.json`);
          if (!configResponse.ok) return null;

          const config = await configResponse.json();
          return {
            id: folderName,
            name: config.name || folderName,
            description: '',
          };
        } catch {
          return null;
        }
      });

      const results = await Promise.all(profilePromises);
      const profiles = results.filter((p): p is ProfileInfo => p !== null);

      // Cache the results
      this.state.availableProfiles = profiles;

      return profiles;
    } catch (error) {
      console.warn('[KeyboardSounds] Failed to fetch profiles:', error);
      return [];
    }
  }

  public dispose(): void {
    if (this.state.audioContext) {
      this.state.audioContext.close().catch(() => {});
    }

    this.state = {
      audioContext: null,
      masterGain: null,
      profiles: new Map(),
      availableProfiles: [],
      activeProfileId: null,
      loadingState: 'idle',
      error: null,
      lastPlayedTime: 0,
      settings: { ...DEFAULT_KEYBOARD_SOUND_SETTINGS },
      initializationAttempted: false,
      profileScancodes: new Map(),
    };
  }

  // ============================================
  // Private Methods - Profile Loading
  // ============================================

  /**
   * Discover profiles from manifest.json and load them
   */
  private async discoverAndLoadProfiles(): Promise<void> {
    try {
      // Load manifest to get list of available profiles
      const manifestResponse = await fetch(`${SOUNDS_BASE_PATH}/manifest.json`);
      if (!manifestResponse.ok) {
        console.warn('[KeyboardSounds] No manifest.json found, no profiles will be loaded');
        return;
      }

      const manifest: ProfilesManifest = await manifestResponse.json();

      if (!manifest.profiles || manifest.profiles.length === 0) {
        console.warn('[KeyboardSounds] Manifest has no profiles listed');
        return;
      }

      // Load each profile in parallel
      const loadPromises = manifest.profiles.map((folderName) =>
        this.loadProfile(folderName, `${SOUNDS_BASE_PATH}/${folderName}/`)
      );

      await Promise.allSettled(loadPromises);
    } catch (error) {
      console.warn('[KeyboardSounds] Failed to load manifest:', error);
    }
  }

  /**
   * Load a single profile from its folder
   */
  private async loadProfile(folderId: string, basePath: string): Promise<void> {
    if (!this.state.audioContext) return;

    try {
      // Load config.json
      const configResponse = await fetch(`${basePath}config.json`);
      if (!configResponse.ok) {
        console.warn(`[KeyboardSounds] No config.json found for profile: ${folderId}`);
        return;
      }

      const config: MechVibesConfig = await configResponse.json();
      const format = detectProfileFormat(config);

      let profile: LoadedProfile;

      switch (format) {
        case 'single':
          profile = await this.loadSingleProfile(folderId, basePath, config);
          break;
        case 'multi-v1':
          profile = await this.loadMultiV1Profile(folderId, basePath, config);
          break;
        case 'multi-v2':
          profile = await this.loadMultiV2Profile(folderId, basePath, config);
          break;
      }

      if (!profile) return;

      this.state.profiles.set(folderId, profile);

      // Add to available profiles list (only if not already present from eager fetch)
      const existingProfile = this.state.availableProfiles.find((p) => p.id === folderId);
      if (!existingProfile) {
        this.state.availableProfiles.push({
          id: folderId,
          name: config.name || folderId,
          description: '',
        });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[KeyboardSounds] Loaded profile: ${folderId}`, {
          name: config.name,
          format,
        });
      }
    } catch (error) {
      console.warn(`[KeyboardSounds] Failed to load profile: ${folderId}`, error);
    }
  }

  /**
   * Load a single format profile (one audio file with time offsets)
   */
  private async loadSingleProfile(
    folderId: string,
    basePath: string,
    config: MechVibesConfig
  ): Promise<LoadedProfile> {
    const soundPath = `${basePath}${config.sound}`;
    const soundResponse = await fetch(soundPath);
    if (!soundResponse.ok) {
      throw new Error(`Sound file not found: ${soundPath}`);
    }

    const arrayBuffer = await soundResponse.arrayBuffer();
    const audioBuffer = await this.state.audioContext!.decodeAudioData(arrayBuffer);

    // Cache available scancodes for random selection
    const scancodes = Object.keys(config.defines)
      .filter((k) => Array.isArray(config.defines[k]))
      .map((k) => parseInt(k, 10))
      .filter((n) => !isNaN(n));
    this.state.profileScancodes.set(folderId, scancodes);

    return {
      id: folderId,
      name: config.name || folderId,
      description: '',
      config,
      format: 'single',
      audioBuffer,
      baseVolume: 1.0,
    };
  }

  /**
   * Load a multi v1 format profile (individual files per key)
   */
  private async loadMultiV1Profile(
    folderId: string,
    basePath: string,
    config: MechVibesConfig
  ): Promise<LoadedProfile> {
    const audioBuffers = new Map<string, AudioBuffer>();
    const filesToLoad = new Set<string>();

    // Collect unique filenames
    for (const [, value] of Object.entries(config.defines)) {
      if (typeof value === 'string' && value) {
        filesToLoad.add(value);
      }
    }

    // Load all sound files in parallel
    const loadPromises = Array.from(filesToLoad).map(async (filename) => {
      try {
        const soundPath = `${basePath}${filename}`;
        const response = await fetch(soundPath);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.state.audioContext!.decodeAudioData(arrayBuffer);
          audioBuffers.set(filename, audioBuffer);
        }
      } catch (error) {
        console.warn(`[KeyboardSounds] Failed to load sound: ${filename}`, error);
      }
    });

    await Promise.allSettled(loadPromises);

    // Cache available scancodes (those with non-null string values)
    const scancodes = Object.entries(config.defines)
      .filter(([, value]) => typeof value === 'string' && value)
      .map(([key]) => parseInt(key, 10))
      .filter((n) => !isNaN(n));
    this.state.profileScancodes.set(folderId, scancodes);

    return {
      id: folderId,
      name: config.name || folderId,
      description: '',
      config,
      format: 'multi-v1',
      audioBuffers,
      baseVolume: 1.0,
    };
  }

  /**
   * Load a multi v2 format profile (pattern-based with keyup sounds)
   */
  private async loadMultiV2Profile(
    folderId: string,
    basePath: string,
    config: MechVibesConfig
  ): Promise<LoadedProfile> {
    const audioBuffers = new Map<string, AudioBuffer>();
    const genericDownBuffers: AudioBuffer[] = [];
    let genericUpBuffer: AudioBuffer | undefined;

    // Helper to load a single audio file
    const loadAudioFile = async (filename: string): Promise<AudioBuffer | null> => {
      try {
        const soundPath = `${basePath}${filename}`;
        const response = await fetch(soundPath);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          return await this.state.audioContext!.decodeAudioData(arrayBuffer);
        }
      } catch (error) {
        console.warn(`[KeyboardSounds] Failed to load sound: ${filename}`, error);
      }
      return null;
    };

    // Load generic keydown sounds (pattern expansion)
    const genericDownFilenames = expandPattern(config.sound);
    const genericDownPromises = genericDownFilenames.map(async (filename) => {
      const buffer = await loadAudioFile(filename);
      if (buffer) {
        genericDownBuffers.push(buffer);
        audioBuffers.set(filename, buffer);
      }
    });

    // Load generic keyup sound if specified
    const genericUpPromise = config.soundup
      ? loadAudioFile(config.soundup).then((buffer) => {
          if (buffer) {
            genericUpBuffer = buffer;
            audioBuffers.set(config.soundup!, buffer);
          }
        })
      : Promise.resolve();

    // Load specific key sounds from defines
    const specificFilesToLoad = new Set<string>();
    for (const [, value] of Object.entries(config.defines)) {
      if (typeof value === 'string' && value) {
        specificFilesToLoad.add(value);
      }
    }

    const specificPromises = Array.from(specificFilesToLoad).map(async (filename) => {
      const buffer = await loadAudioFile(filename);
      if (buffer) {
        audioBuffers.set(filename, buffer);
      }
    });

    await Promise.allSettled([...genericDownPromises, genericUpPromise, ...specificPromises]);

    // Cache available scancodes (those with specific keydown sounds)
    const scancodes = Object.entries(config.defines)
      .filter(([key, value]) => typeof value === 'string' && value && !key.includes('-up'))
      .map(([key]) => parseInt(key, 10))
      .filter((n) => !isNaN(n));
    this.state.profileScancodes.set(folderId, scancodes);

    return {
      id: folderId,
      name: config.name || folderId,
      description: '',
      config,
      format: 'multi-v2',
      audioBuffers,
      genericDownBuffers,
      genericUpBuffer,
      baseVolume: 1.0,
    };
  }
}

// ============================================
// Convenience Exports
// ============================================

export function getKeyboardSoundEngine(): KeyboardSoundEngine {
  return KeyboardSoundEngine.getInstance();
}

export async function initKeyboardSounds(): Promise<KeyboardSoundEngine> {
  const engine = KeyboardSoundEngine.getInstance();
  await engine.initialize();
  return engine;
}

// Re-export types from central location for convenience
export type { KeyboardSoundSettings, KeyboardSoundProfileId, KeyboardSoundProfileInfo } from '@/types';
export { DEFAULT_KEYBOARD_SOUND_SETTINGS } from '@/types';
