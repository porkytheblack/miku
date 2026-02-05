import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTauri, safeTauriCall, toBackendSettings, toFrontendSettings } from '../index';
import type { EditorSettingsBackend } from '../commands';

// Helper to safely access window
const getWindow = () => window as Window & typeof globalThis & { __TAURI_INTERNALS__?: unknown };

describe('Tauri utilities', () => {
  describe('isTauri', () => {
    afterEach(() => {
      // Clean up after each test
      delete getWindow().__TAURI_INTERNALS__;
    });

    it('returns false when __TAURI_INTERNALS__ is not present', () => {
      delete getWindow().__TAURI_INTERNALS__;
      expect(isTauri()).toBe(false);
    });

    it('returns true when __TAURI_INTERNALS__ is present', () => {
      getWindow().__TAURI_INTERNALS__ = {};
      expect(isTauri()).toBe(true);
    });
  });

  describe('safeTauriCall', () => {
    afterEach(() => {
      // Clean up after each test
      delete getWindow().__TAURI_INTERNALS__;
    });

    it('returns fallback value when not in Tauri', async () => {
      delete getWindow().__TAURI_INTERNALS__;
      const tauriFn = vi.fn().mockResolvedValue('tauri result');
      const result = await safeTauriCall(tauriFn, 'fallback');
      expect(result).toBe('fallback');
      expect(tauriFn).not.toHaveBeenCalled();
    });

    it('returns fallback function result when not in Tauri', async () => {
      delete getWindow().__TAURI_INTERNALS__;
      const tauriFn = vi.fn().mockResolvedValue('tauri result');
      const fallbackFn = vi.fn().mockReturnValue('fallback from function');
      const result = await safeTauriCall(tauriFn, fallbackFn);
      expect(result).toBe('fallback from function');
      expect(tauriFn).not.toHaveBeenCalled();
      expect(fallbackFn).toHaveBeenCalled();
    });

    it('calls Tauri function when in Tauri environment', async () => {
      getWindow().__TAURI_INTERNALS__ = {};
      const tauriFn = vi.fn().mockResolvedValue('tauri result');
      const result = await safeTauriCall(tauriFn, 'fallback');
      expect(result).toBe('tauri result');
      expect(tauriFn).toHaveBeenCalled();
    });

    it('returns fallback when Tauri function throws', async () => {
      getWindow().__TAURI_INTERNALS__ = {};
      const tauriFn = vi.fn().mockRejectedValue(new Error('Tauri error'));
      const result = await safeTauriCall(tauriFn, 'fallback');
      expect(result).toBe('fallback');
    });
  });

  describe('toBackendSettings', () => {
    it('converts frontend settings to backend format', () => {
      const frontendSettings = {
        themePreference: {
          selected: 'dark',
          lightFallback: 'light',
          darkFallback: 'dark',
        },
        fontSize: 18,
        lineHeight: 1.8,
        editorWidth: 800,
        fontFamily: 'mono',
        reviewMode: 'auto',
        aggressiveness: 'strict',
        writingContext: 'technical documentation',
        soundEnabled: true,
        keyboardSounds: {
          enabled: true,
          profileId: 'cherry-mx-blue',
          volume: 0.7,
          playKeyupSounds: true,
          pitchVariation: 0.05,
        },
      };

      const result = toBackendSettings(frontendSettings);

      expect(result).toEqual({
        theme: null, // Deprecated field
        theme_preference: {
          selected: 'dark',
          light_fallback: 'light',
          dark_fallback: 'dark',
        },
        font_size: 18,
        line_height: 1.8,
        editor_width: 800,
        font_family: 'mono',
        review_mode: 'auto',
        aggressiveness: 'strict',
        writing_context: 'technical documentation',
        sound_enabled: true,
        keyboard_sounds: {
          enabled: true,
          profile_id: 'cherry-mx-blue',
          volume: 0.7,
          play_keyup_sounds: true,
          pitch_variation: 0.05,
        },
      });
    });

    it('handles empty strings', () => {
      const frontendSettings = {
        themePreference: {
          selected: 'system',
          lightFallback: 'light',
          darkFallback: 'dark',
        },
        fontSize: 16,
        lineHeight: 1.6,
        editorWidth: 720,
        fontFamily: 'mono',
        reviewMode: 'manual',
        aggressiveness: 'balanced',
        writingContext: '',
        soundEnabled: true,
        keyboardSounds: {
          enabled: false,
          profileId: 'cherry-mx-blue',
          volume: 0.5,
          playKeyupSounds: false,
          pitchVariation: 0.02,
        },
      };

      const result = toBackendSettings(frontendSettings);

      expect(result.writing_context).toBe('');
    });
  });

  describe('toFrontendSettings', () => {
    it('converts backend settings to frontend format', () => {
      const backendSettings: EditorSettingsBackend = {
        theme: null,
        theme_preference: {
          selected: 'dark',
          light_fallback: 'light',
          dark_fallback: 'dark',
        },
        font_size: 18,
        line_height: 1.8,
        editor_width: 800,
        font_family: 'sans',
        review_mode: 'auto',
        aggressiveness: 'strict',
        writing_context: 'blog post',
        sound_enabled: true,
        keyboard_sounds: {
          enabled: true,
          profile_id: 'topre',
          volume: 0.8,
          play_keyup_sounds: true,
          pitch_variation: 0.03,
        },
      };

      const result = toFrontendSettings(backendSettings);

      expect(result).toEqual({
        theme: null,
        themePreference: {
          selected: 'dark',
          lightFallback: 'light',
          darkFallback: 'dark',
        },
        fontSize: 18,
        lineHeight: 1.8,
        editorWidth: 800,
        fontFamily: 'sans',
        reviewMode: 'auto',
        aggressiveness: 'strict',
        writingContext: 'blog post',
        soundEnabled: true,
        keyboardSounds: {
          enabled: true,
          profileId: 'topre',
          volume: 0.8,
          playKeyupSounds: true,
          pitchVariation: 0.03,
        },
      });
    });

    it('handles system theme preference', () => {
      const backendSettings: EditorSettingsBackend = {
        theme: null,
        theme_preference: {
          selected: 'system',
          light_fallback: 'light',
          dark_fallback: 'dark',
        },
        font_size: 16,
        line_height: 1.6,
        editor_width: 720,
        font_family: 'mono',
        review_mode: 'manual',
        aggressiveness: 'balanced',
        writing_context: '',
        sound_enabled: false,
        keyboard_sounds: {
          enabled: false,
          profile_id: 'cherry-mx-blue',
          volume: 0.5,
          play_keyup_sounds: false,
          pitch_variation: 0.02,
        },
      };

      const result = toFrontendSettings(backendSettings);

      expect(result.themePreference.selected).toBe('system');
    });

    it('provides default keyboard sounds when missing from backend', () => {
      // Simulate old settings without keyboard_sounds field
      const backendSettings = {
        theme: null,
        theme_preference: {
          selected: 'light',
          light_fallback: 'light',
          dark_fallback: 'dark',
        },
        font_size: 16,
        line_height: 1.6,
        editor_width: 720,
        font_family: 'mono',
        review_mode: 'manual',
        aggressiveness: 'balanced',
        writing_context: '',
        sound_enabled: true,
      } as EditorSettingsBackend;

      const result = toFrontendSettings(backendSettings);

      expect(result.keyboardSounds).toEqual({
        enabled: false,
        profileId: 'cherry-mx-blue',
        volume: 0.5,
        playKeyupSounds: false,
        pitchVariation: 0.02,
      });
    });

    it('migrates legacy theme to theme_preference', () => {
      // Simulate old settings with only legacy theme field
      const backendSettings = {
        theme: 'dark',
        font_size: 16,
        line_height: 1.6,
        editor_width: 720,
        font_family: 'mono',
        review_mode: 'manual',
        aggressiveness: 'balanced',
        writing_context: '',
        sound_enabled: true,
      } as unknown as EditorSettingsBackend;

      const result = toFrontendSettings(backendSettings);

      expect(result.themePreference.selected).toBe('dark');
      expect(result.themePreference.lightFallback).toBe('light');
      expect(result.themePreference.darkFallback).toBe('dark');
    });
  });

  describe('round-trip conversion', () => {
    it('preserves settings through round-trip conversion', () => {
      const originalFrontend = {
        themePreference: {
          selected: 'light',
          lightFallback: 'light',
          darkFallback: 'dark',
        },
        fontSize: 20,
        lineHeight: 1.5,
        editorWidth: 900,
        fontFamily: 'sans',
        reviewMode: 'manual',
        aggressiveness: 'gentle',
        writingContext: 'creative writing',
        soundEnabled: true,
        keyboardSounds: {
          enabled: true,
          profileId: 'cherry-mx-brown',
          volume: 0.6,
          playKeyupSounds: true,
          pitchVariation: 0.04,
        },
      };

      const backend = toBackendSettings(originalFrontend);
      const roundTrip = toFrontendSettings(backend);

      // The round-trip should preserve all values
      expect(roundTrip.themePreference.selected).toBe(originalFrontend.themePreference.selected);
      expect(roundTrip.themePreference.lightFallback).toBe(originalFrontend.themePreference.lightFallback);
      expect(roundTrip.themePreference.darkFallback).toBe(originalFrontend.themePreference.darkFallback);
      expect(roundTrip.fontSize).toBe(originalFrontend.fontSize);
      expect(roundTrip.lineHeight).toBe(originalFrontend.lineHeight);
      expect(roundTrip.editorWidth).toBe(originalFrontend.editorWidth);
      expect(roundTrip.fontFamily).toBe(originalFrontend.fontFamily);
      expect(roundTrip.reviewMode).toBe(originalFrontend.reviewMode);
      expect(roundTrip.aggressiveness).toBe(originalFrontend.aggressiveness);
      expect(roundTrip.writingContext).toBe(originalFrontend.writingContext);
      expect(roundTrip.soundEnabled).toBe(originalFrontend.soundEnabled);
      // Keyboard sounds round-trip
      expect(roundTrip.keyboardSounds.enabled).toBe(originalFrontend.keyboardSounds.enabled);
      expect(roundTrip.keyboardSounds.profileId).toBe(originalFrontend.keyboardSounds.profileId);
      expect(roundTrip.keyboardSounds.volume).toBe(originalFrontend.keyboardSounds.volume);
      expect(roundTrip.keyboardSounds.playKeyupSounds).toBe(originalFrontend.keyboardSounds.playKeyupSounds);
      expect(roundTrip.keyboardSounds.pitchVariation).toBe(originalFrontend.keyboardSounds.pitchVariation);
    });
  });
});
