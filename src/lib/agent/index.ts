/**
 * Agent module exports
 *
 * EXPERIMENTAL: This is an experimental feature for Claude Code integration.
 */

// Re-export types
export * from './types';

// Re-export parser functions
export {
  createEmptyAgentDocument,
  parseAgentFile,
  serializeAgentDocument,
  createMessage,
  createTask,
  createApprovalRequest,
} from './parser';

// Re-export Claude Code event types
export * from './claude-events';

// Re-export Claude bridge
export {
  ClaudeBridge,
  createClaudeBridge,
  getClaudeBridge,
  convertPermissionToApproval,
  toolToApprovalType,
  extractMessageText,
  extractThinkingText,
} from './claude-bridge';
