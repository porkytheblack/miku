import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTauri, safeTauriCall, toBackendSettings, toFrontendSettings } from '../index';
import type { EditorSettings } from '../commands';

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
        theme: 'dark',
        fontSize: 18,
        lineHeight: 1.8,
        editorWidth: 800,
        fontFamily: 'mono',
        reviewMode: 'auto',
        aggressiveness: 'strict',
        writingContext: 'technical documentation',
      };

      const result = toBackendSettings(frontendSettings);

      expect(result).toEqual({
        theme: 'dark',
        font_size: 18,
        line_height: 1.8,
        editor_width: 800,
        font_family: 'mono',
        review_mode: 'auto',
        aggressiveness: 'strict',
        writing_context: 'technical documentation',
      });
    });

    it('handles empty strings', () => {
      const frontendSettings = {
        theme: 'system',
        fontSize: 16,
        lineHeight: 1.6,
        editorWidth: 720,
        fontFamily: 'mono',
        reviewMode: 'manual',
        aggressiveness: 'balanced',
        writingContext: '',
      };

      const result = toBackendSettings(frontendSettings);

      expect(result.writing_context).toBe('');
    });
  });

  describe('toFrontendSettings', () => {
    it('converts backend settings to frontend format', () => {
      const backendSettings: EditorSettings = {
        theme: 'dark',
        font_size: 18,
        line_height: 1.8,
        editor_width: 800,
        font_family: 'sans',
        review_mode: 'auto',
        aggressiveness: 'strict',
        writing_context: 'blog post',
      };

      const result = toFrontendSettings(backendSettings);

      expect(result).toEqual({
        theme: 'dark',
        fontSize: 18,
        lineHeight: 1.8,
        editorWidth: 800,
        fontFamily: 'sans',
        reviewMode: 'auto',
        aggressiveness: 'strict',
        writingContext: 'blog post',
      });
    });

    it('handles system theme', () => {
      const backendSettings: EditorSettings = {
        theme: 'system',
        font_size: 16,
        line_height: 1.6,
        editor_width: 720,
        font_family: 'mono',
        review_mode: 'manual',
        aggressiveness: 'balanced',
        writing_context: '',
      };

      const result = toFrontendSettings(backendSettings);

      expect(result.theme).toBe('system');
    });
  });

  describe('round-trip conversion', () => {
    it('preserves settings through round-trip conversion', () => {
      const originalFrontend = {
        theme: 'light',
        fontSize: 20,
        lineHeight: 1.5,
        editorWidth: 900,
        fontFamily: 'sans',
        reviewMode: 'manual',
        aggressiveness: 'gentle',
        writingContext: 'creative writing',
      };

      const backend = toBackendSettings(originalFrontend);
      const roundTrip = toFrontendSettings(backend);

      // The round-trip should preserve all values
      expect(roundTrip.theme).toBe(originalFrontend.theme);
      expect(roundTrip.fontSize).toBe(originalFrontend.fontSize);
      expect(roundTrip.lineHeight).toBe(originalFrontend.lineHeight);
      expect(roundTrip.editorWidth).toBe(originalFrontend.editorWidth);
      expect(roundTrip.fontFamily).toBe(originalFrontend.fontFamily);
      expect(roundTrip.reviewMode).toBe(originalFrontend.reviewMode);
      expect(roundTrip.aggressiveness).toBe(originalFrontend.aggressiveness);
      expect(roundTrip.writingContext).toBe(originalFrontend.writingContext);
    });
  });
});
