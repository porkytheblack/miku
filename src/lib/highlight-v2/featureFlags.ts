/**
 * Feature Flags Module
 *
 * Controls the rollout of the new highlight management system.
 * Based on RFC-001 Section 9 Migration Plan specifications.
 */

/**
 * Environment variable name for the feature flag.
 */
const FEATURE_FLAG_ENV_VAR = 'NEXT_PUBLIC_NEW_HIGHLIGHT_MANAGER';

/**
 * Storage key for local override (for testing).
 */
const OVERRIDE_STORAGE_KEY = 'miku_highlight_manager_v2_override';

/**
 * Whether to use the new highlight manager.
 * Checks environment variable first, then local storage override.
 */
export const USE_NEW_HIGHLIGHT_MANAGER: boolean = (() => {
  // Check environment variable
  if (typeof process !== 'undefined' && process.env) {
    const envValue = process.env[FEATURE_FLAG_ENV_VAR];
    if (envValue === 'true') {
      return true;
    }
    if (envValue === 'false') {
      return false;
    }
  }

  // Default to false (legacy system)
  return false;
})();

/**
 * Override state for testing and development.
 */
let overrideValue: boolean | null = null;

/**
 * Checks if the new highlight manager is enabled.
 * Considers environment variable, local storage, and runtime override.
 *
 * @returns true if the new highlight manager should be used
 */
export function isNewHighlightManagerEnabled(): boolean {
  // Runtime override takes precedence
  if (overrideValue !== null) {
    return overrideValue;
  }

  // Check local storage override (browser only)
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const storedValue = localStorage.getItem(OVERRIDE_STORAGE_KEY);
    if (storedValue === 'true') {
      return true;
    }
    if (storedValue === 'false') {
      return false;
    }
  }

  // Fall back to compiled constant
  return USE_NEW_HIGHLIGHT_MANAGER;
}

/**
 * Sets a runtime override for the feature flag.
 * Useful for testing without changing environment variables.
 *
 * @param enabled - Whether to enable the new highlight manager
 */
export function setHighlightManagerOverride(enabled: boolean | null): void {
  overrideValue = enabled;
}

/**
 * Gets the current override value.
 *
 * @returns The override value, or null if not set
 */
export function getHighlightManagerOverride(): boolean | null {
  return overrideValue;
}

/**
 * Clears the runtime override.
 */
export function clearHighlightManagerOverride(): void {
  overrideValue = null;
}

/**
 * Sets the local storage override (persists across sessions).
 * Only works in browser environment.
 *
 * @param enabled - Whether to enable, or null to clear
 */
export function setStoredHighlightManagerOverride(enabled: boolean | null): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.warn('Local storage not available, cannot set stored override');
    return;
  }

  if (enabled === null) {
    localStorage.removeItem(OVERRIDE_STORAGE_KEY);
  } else {
    localStorage.setItem(OVERRIDE_STORAGE_KEY, String(enabled));
  }
}

/**
 * Gets the stored override value from local storage.
 *
 * @returns The stored value, or null if not set
 */
export function getStoredHighlightManagerOverride(): boolean | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  const storedValue = localStorage.getItem(OVERRIDE_STORAGE_KEY);
  if (storedValue === 'true') {
    return true;
  }
  if (storedValue === 'false') {
    return false;
  }
  return null;
}

/**
 * Feature flag configuration for all highlight-v2 features.
 */
export interface FeatureFlagConfig {
  /** Use the new highlight manager system */
  readonly newHighlightManager: boolean;
  /** Enable debug logging for the highlight system */
  readonly debugLogging: boolean;
  /** Enable performance metrics collection */
  readonly performanceMetrics: boolean;
  /** Maximum number of suggestions to display */
  readonly maxSuggestions: number;
  /** Enable undo/redo for suggestion actions */
  readonly undoRedoEnabled: boolean;
}

/**
 * Default feature flag configuration.
 */
const DEFAULT_CONFIG: FeatureFlagConfig = {
  newHighlightManager: false,
  debugLogging: false,
  performanceMetrics: false,
  maxSuggestions: 100,
  undoRedoEnabled: true,
};

/**
 * Current feature flag configuration.
 */
let currentConfig: FeatureFlagConfig = { ...DEFAULT_CONFIG };

/**
 * Gets the current feature flag configuration.
 */
export function getFeatureFlags(): FeatureFlagConfig {
  return {
    ...currentConfig,
    newHighlightManager: isNewHighlightManagerEnabled(),
  };
}

/**
 * Updates the feature flag configuration.
 *
 * @param updates - Partial configuration to merge
 */
export function setFeatureFlags(updates: Partial<FeatureFlagConfig>): void {
  currentConfig = { ...currentConfig, ...updates };

  // Handle special case for newHighlightManager
  if ('newHighlightManager' in updates) {
    setHighlightManagerOverride(updates.newHighlightManager ?? null);
  }
}

/**
 * Resets feature flags to defaults.
 */
export function resetFeatureFlags(): void {
  currentConfig = { ...DEFAULT_CONFIG };
  clearHighlightManagerOverride();
}

/**
 * Development helper: enables all experimental features.
 */
export function enableAllExperimentalFeatures(): void {
  setFeatureFlags({
    newHighlightManager: true,
    debugLogging: true,
    performanceMetrics: true,
    undoRedoEnabled: true,
  });
}

/**
 * Production-safe helper: enables only stable features.
 */
export function enableProductionFeatures(): void {
  setFeatureFlags({
    newHighlightManager: false,
    debugLogging: false,
    performanceMetrics: false,
    undoRedoEnabled: true,
  });
}

/**
 * Checks if debug mode is enabled.
 */
export function isDebugEnabled(): boolean {
  return currentConfig.debugLogging;
}

/**
 * Debug logging helper that only logs when debug is enabled.
 */
export function debugLog(category: string, message: string, data?: unknown): void {
  if (!currentConfig.debugLogging) {
    return;
  }

  const timestamp = new Date().toISOString();
  const prefix = `[Highlight:${category}] ${timestamp}`;

  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}
