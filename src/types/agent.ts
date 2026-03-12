/**
 * Type definitions for .miku-agent files
 *
 * EXPERIMENTAL: This is an experimental feature for Claude Code integration.
 * The API and file format may change in future versions.
 *
 * .miku-agent files enable direct interaction with Claude Code from within
 * the Miku app, providing a chat interface, task progress tracking, and
 * an approval workflow for agent actions.
 */

// ============================================
// Message Types
// ============================================

/**
 * Role of a message in the conversation
 */
export type AgentMessageRole = 'user' | 'assistant' | 'system';

/**
 * A single message in the agent conversation
 */
export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  timestamp: string; // ISO 8601 timestamp
  /** Optional metadata for tool calls, errors, etc. */
  metadata?: {
    /** If this message contains a tool call result */
    toolCallId?: string;
    /** If this message resulted in an error */
    error?: string;
    /** Thinking/reasoning content (for extended thinking models) */
    thinking?: string;
  };
}

// ============================================
// Task Types
// ============================================

/**
 * Status of an agent task
 */
export type AgentTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * A task that the agent is working on
 * Similar to Claude Code's todo list functionality
 */
export interface AgentTask {
  id: string;
  /** Description of what needs to be done (imperative form) */
  content: string;
  /** Description shown while task is in progress (present continuous form) */
  activeForm: string;
  status: AgentTaskStatus;
  /** Optional error message if task failed */
  error?: string;
  /** Timestamps for task lifecycle */
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ============================================
// Approval Types
// ============================================

/**
 * Type of action requiring approval
 */
export type AgentApprovalType =
  | 'file_edit'      // Editing a file
  | 'file_create'    // Creating a new file
  | 'file_delete'    // Deleting a file
  | 'command'        // Running a terminal command
  | 'web_fetch'      // Fetching from the web
  | 'other';         // Other actions

/**
 * Status of an approval request
 */
export type AgentApprovalStatus = 'pending' | 'approved' | 'rejected';

/**
 * A request for user approval before the agent takes an action
 */
export interface AgentApprovalRequest {
  id: string;
  type: AgentApprovalType;
  status: AgentApprovalStatus;
  /** Human-readable description of what will happen */
  description: string;
  /** Detailed information about the action */
  details: {
    /** For file operations: the file path */
    filePath?: string;
    /** For file edits: the proposed changes (diff or new content) */
    diff?: string;
    /** For commands: the command to run */
    command?: string;
    /** For web fetch: the URL */
    url?: string;
    /** Additional context */
    context?: string;
  };
  /** Timestamps */
  createdAt: string;
  resolvedAt?: string;
  /** ID of the message that triggered this approval */
  messageId?: string;
}

// ============================================
// Configuration Types
// ============================================

/**
 * Configuration for the agent
 */
export interface AgentConfig {
  /** Working directory for file operations */
  workingDirectory: string;
  /** If true, automatically approve certain low-risk actions */
  autoApprove: boolean;
  /** List of action types to auto-approve when autoApprove is true */
  autoApproveTypes?: AgentApprovalType[];
  /** Model to use (default: claude-sonnet-4) */
  model: string;
  /** Custom system prompt to prepend to the agent's instructions */
  customSystemPrompt?: string;
  /** Maximum tokens for responses */
  maxTokens?: number;
}

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  workingDirectory: '',
  autoApprove: false,
  autoApproveTypes: [],
  model: 'claude-sonnet-4',
  maxTokens: 8192,
};

// ============================================
// Document Types
// ============================================

/**
 * Metadata for a .miku-agent document
 */
export interface AgentMetadata {
  /** Display name for the agent */
  name: string;
  /** Description of what this agent does */
  description?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Complete .miku-agent document structure
 * This is what gets serialized to/from the .miku-agent file
 */
export interface MikuAgentDocument {
  /** Format version, currently "1.0" */
  version: string;
  /** Document metadata */
  metadata: AgentMetadata;
  /** Agent configuration */
  config: AgentConfig;
  /** Conversation history */
  conversation: AgentMessage[];
  /** Current tasks */
  tasks: AgentTask[];
  /** Pending approval requests */
  pendingApprovals: AgentApprovalRequest[];
}

// ============================================
// UI State Types
// ============================================

/**
 * Connection status with the agent backend
 */
export type AgentConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Current state of the agent
 */
export type AgentActivityStatus = 'idle' | 'thinking' | 'working' | 'waiting_approval';

/**
 * Combined UI state for the agent editor
 */
export interface AgentUIState {
  /** Connection status with backend */
  connectionStatus: AgentConnectionStatus;
  /** Current activity status */
  activityStatus: AgentActivityStatus;
  /** Error message if any */
  error?: string;
  /** Whether the config panel is open */
  isConfigOpen: boolean;
  /** ID of the currently selected message (for reference) */
  selectedMessageId?: string;
  /** Whether the agent is currently generating a response */
  isGenerating: boolean;
  /** Input draft (for persistence across tab switches) */
  inputDraft: string;
}

/**
 * Default UI state
 */
export const DEFAULT_AGENT_UI_STATE: AgentUIState = {
  connectionStatus: 'disconnected',
  activityStatus: 'idle',
  isConfigOpen: false,
  isGenerating: false,
  inputDraft: '',
};

// ============================================
// Event Types (for future WebSocket integration)
// ============================================

/**
 * Events that can be sent to/from the agent
 */
export type AgentEvent =
  | { type: 'message'; payload: AgentMessage }
  | { type: 'task_update'; payload: AgentTask }
  | { type: 'approval_request'; payload: AgentApprovalRequest }
  | { type: 'approval_response'; payload: { id: string; status: AgentApprovalStatus } }
  | { type: 'status_change'; payload: { status: AgentActivityStatus } }
  | { type: 'error'; payload: { message: string; code?: string } };

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique ID for agent entities
 */
let agentIdCounter = 0;
export function generateAgentId(prefix: 'msg' | 'task' | 'approval'): string {
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${++agentIdCounter}-${Date.now()}-${random}`;
}

/**
 * Reset ID counter (useful for testing)
 */
export function resetAgentIdCounter(): void {
  agentIdCounter = 0;
}

/**
 * Get display label for approval type
 */
export function getApprovalTypeLabel(type: AgentApprovalType): string {
  switch (type) {
    case 'file_edit':
      return 'Edit File';
    case 'file_create':
      return 'Create File';
    case 'file_delete':
      return 'Delete File';
    case 'command':
      return 'Run Command';
    case 'web_fetch':
      return 'Fetch URL';
    case 'other':
    default:
      return 'Action';
  }
}

/**
 * Get icon name for approval type (for use with your icon system)
 */
export function getApprovalTypeIcon(type: AgentApprovalType): string {
  switch (type) {
    case 'file_edit':
      return 'edit';
    case 'file_create':
      return 'file-plus';
    case 'file_delete':
      return 'trash';
    case 'command':
      return 'terminal';
    case 'web_fetch':
      return 'globe';
    case 'other':
    default:
      return 'alert-circle';
  }
}

/**
 * Check if an approval type is considered low-risk for auto-approval
 */
export function isLowRiskApproval(type: AgentApprovalType): boolean {
  // Only web fetch is considered low-risk by default
  return type === 'web_fetch';
}
