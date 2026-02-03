/**
 * Highlight Management System v2
 *
 * Comprehensive highlight management with optimized algorithms,
 * formal state machines, and type-safe tool call architecture.
 *
 * Based on RFC-001 specifications.
 *
 * @module highlight-v2
 */

// ============================================================================
// Range Module
// ============================================================================

export {
  type Range,
  RangeValidationError as RangeCreationError,
  createRange,
  rangeLength,
  rangeOverlaps,
  rangeContains,
  rangeContainsPoint,
  rangeApplyEdit,
  isValidRange,
  compareRangesByStart,
  rangeFrom,
  rangeIntersection,
  rangeUnion,
} from './Range';

// ============================================================================
// Types Module
// ============================================================================

export {
  // Category types
  type HighlightCategory,
  type SuggestionCategory,
  HIGHLIGHT_CATEGORIES,
  SUGGESTION_CATEGORIES,
  isHighlightCategory,
  isSuggestionCategory,

  // Priority types
  type HighlightPriority,
  PRIORITY_VALUES,
  HIGHLIGHT_PRIORITIES,
  isHighlightPriority,
  comparePriority,

  // Highlight types
  type Highlight,
  type SuggestionHighlight,
  isSuggestionHighlight,
  createSuggestionId,

  // Error classes
  HighlightError,
  RangeValidationError,
  OverlapError,
  ToolExecutionError,
  StateTransitionError,
  SuggestionNotFoundError,
  DocumentError,

  // Utility types
  type LineColumn,
  type PositionedSuggestion,
  toPositionedSuggestion,
  type DocumentStats,
  type ValidationResult,
} from './types';

// ============================================================================
// RangeIndex Module
// ============================================================================

export {
  type RangeIndexItem,
  type PrioritizedItem,
  type OverlapResolutionStrategy,
  type FromArrayResult,
  RangeIndex,
  detectOverlaps,
} from './RangeIndex';

// ============================================================================
// Suggestion State Machine Module
// ============================================================================

export {
  type SuggestionState,
  type SuggestionEvent,
  SUGGESTION_STATES,
  SUGGESTION_EVENT_TYPES,
  TERMINAL_STATES,
  ACTIVE_STATES,
  isTerminalState,
  isActiveState,
  suggestionTransition,
  canTransition as canSuggestionTransition,
  getValidEvents as getSuggestionValidEvents,
  getPossibleNextStates,
  type SuggestionWithState,
  createSuggestionState,
  applySuggestionTransition,
  validateTransition as validateSuggestionTransition,
  getStateDescription as getSuggestionStateDescription,
  getEventDescription as getSuggestionEventDescription,
  batchTransition,
  filterByState,
  countByState,
} from './suggestionStateMachine';

// ============================================================================
// Highlight Manager State Machine Module
// ============================================================================

export {
  type HighlightManagerState,
  MANAGER_STATES,
  type HighlightManagerEvent,
  MANAGER_EVENT_TYPES,
  isHighlightManagerState,
  type TransitionResult,
  type SideEffect,
  highlightManagerTransition,
  getNextState,
  canTransition as canManagerTransition,
  validateTransition as validateManagerTransition,
  getValidEvents as getManagerValidEvents,
  getStateDescription as getManagerStateDescription,
  canInteractWithSuggestions,
  canStartReview,
  isBusy,
  isError,
  type HighlightManagerContext,
  createInitialContext,
  applyTransitionToContext,
} from './highlightManagerStateMachine';

// ============================================================================
// Suggestion Store Module
// ============================================================================

export {
  type SuggestionStoreState,
  type SuggestionStoreAction,
  createInitialState,
  suggestionStoreReducer,

  // Selectors
  selectAllSuggestions,
  selectActiveSuggestion,
  selectSuggestionById,
  selectSuggestionCount,
  selectHasSuggestion,
  selectSuggestionAtPoint,
  selectSuggestionsInRange,
  selectRejectedIds,
  selectHasAnySuggestions,
  selectIsActive,

  // Action creators
  setAllSuggestions,
  addSuggestion,
  removeSuggestion,
  removeAllSuggestions,
  setActiveSuggestion,
  applyEdit,
  updateSuggestion,
  restoreState,

  // Store class
  type StoreListener,
  SuggestionStore,
  createSuggestionStore,
} from './SuggestionStore';

// ============================================================================
// Tool Types Module
// ============================================================================

export {
  type ToolParameters,
  type ParameterSchema,
  type ToolParameterSchema,
  type ToolContext,
  type DocumentContext,
  type ToolResult,
  type ToolResultSuccess,
  type ToolResultFailure,
  toolSuccess,
  toolFailure,
  isToolSuccess,
  isToolFailure,
  type ToolDefinition,
  type ToolParams,
  type ToolReturnType,
  type ToolName,
  type ToolCall,
  type ToolCallResult,
  type ProviderToolFormat,
  toProviderFormat,
  validators,
  createDocumentContext,
  createToolContext,
} from './tools/types';

// ============================================================================
// Tool Definitions
// ============================================================================

export {
  type HighlightTextParams,
  highlightTextTool,
  createHighlightParams,
} from './tools/highlightTextTool';

export {
  type LineContentResult,
  type GetLineContentParams,
  type GetLineContentWithContextResult,
  type GetLineContentResultType,
  isContextResult,
  getLineContentTool,
} from './tools/getLineContentTool';

export {
  type ExtendedDocumentStats,
  type GetDocumentStatsParams,
  getDocumentStatsTool,
} from './tools/getDocumentStatsTool';

export {
  type FinishReviewResult,
  type FinishReviewParams,
  finishReviewTool,
} from './tools/finishReviewTool';

// ============================================================================
// Tool Registry Module
// ============================================================================

export {
  type AnyToolDefinition,
  ToolRegistry,
  createDefaultToolRegistry,
  DEFAULT_TOOL_NAMES,
  type DefaultToolName,
  getDefaultToolRegistry,
  resetDefaultToolRegistry,
} from './tools/ToolRegistry';

// ============================================================================
// Tool Executor Module
// ============================================================================

export {
  type ToolExecutorOptions,
  type ContextProvider,
  ToolExecutor,
  createToolExecutor,
  type BatchResultStats,
  calculateBatchStats,
  extractSuccessfulResults,
  extractFailedResults,
} from './tools/ToolExecutor';

// ============================================================================
// Command Module
// ============================================================================

export {
  type Command,
  type EnhancedCommand,
  type CommandFactory,
  BaseCommand,
  generateCommandId,
  CompositeCommand,
  isEnhancedCommand,
  isCompositeCommand,
} from './commands/Command';

// ============================================================================
// Command Implementations
// ============================================================================

export {
  type AcceptSuggestionParams,
  AcceptSuggestionCommand,
  createAcceptSuggestionCommand,
} from './commands/AcceptSuggestionCommand';

export {
  type DismissSuggestionParams,
  DismissSuggestionCommand,
  createDismissSuggestionCommand,
  DismissAllSuggestionsCommand,
  createDismissAllSuggestionsCommand,
} from './commands/DismissSuggestionCommand';

// ============================================================================
// Undo Manager Module
// ============================================================================

export {
  type UndoManagerOptions,
  type UndoManagerState,
  UndoManager,
  createUndoManager,
} from './commands/UndoManager';

// ============================================================================
// Feature Flags Module
// ============================================================================

export {
  USE_NEW_HIGHLIGHT_MANAGER,
  isNewHighlightManagerEnabled,
  setHighlightManagerOverride,
  getHighlightManagerOverride,
  clearHighlightManagerOverride,
  setStoredHighlightManagerOverride,
  getStoredHighlightManagerOverride,
  type FeatureFlagConfig,
  getFeatureFlags,
  setFeatureFlags,
  resetFeatureFlags,
  enableAllExperimentalFeatures,
  enableProductionFeatures,
  isDebugEnabled,
  debugLog,
} from './featureFlags';
