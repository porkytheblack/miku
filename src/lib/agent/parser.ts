/**
 * Parser and serializer for .miku-agent files
 *
 * EXPERIMENTAL: This is an experimental feature for Claude Code integration.
 * The file format is JSON-based and may change in future versions.
 */

import type {
  MikuAgentDocument,
  AgentMetadata,
  AgentConfig,
  AgentMessage,
  AgentTask,
  AgentApprovalRequest,
  AgentMessageRole,
  AgentTaskStatus,
  AgentApprovalType,
  AgentApprovalStatus,
} from './types';

import {
  DEFAULT_AGENT_CONFIG,
  generateAgentId,
} from './types';

const AGENT_VERSION = '1.0';

// ============================================
// Validation Helpers
// ============================================

/**
 * Valid message roles
 */
const VALID_MESSAGE_ROLES: AgentMessageRole[] = ['user', 'assistant', 'system'];

/**
 * Valid task statuses
 */
const VALID_TASK_STATUSES: AgentTaskStatus[] = ['pending', 'in_progress', 'completed', 'failed'];

/**
 * Valid approval types
 */
const VALID_APPROVAL_TYPES: AgentApprovalType[] = [
  'file_edit',
  'file_create',
  'file_delete',
  'command',
  'web_fetch',
  'other',
];

/**
 * Valid approval statuses
 */
const VALID_APPROVAL_STATUSES: AgentApprovalStatus[] = ['pending', 'approved', 'rejected'];

/**
 * Validate a message role
 */
function validateMessageRole(role: unknown): AgentMessageRole {
  if (VALID_MESSAGE_ROLES.includes(role as AgentMessageRole)) {
    return role as AgentMessageRole;
  }
  return 'user'; // Default
}

/**
 * Validate a task status
 */
function validateTaskStatus(status: unknown): AgentTaskStatus {
  if (VALID_TASK_STATUSES.includes(status as AgentTaskStatus)) {
    return status as AgentTaskStatus;
  }
  return 'pending'; // Default
}

/**
 * Validate an approval type
 */
function validateApprovalType(type: unknown): AgentApprovalType {
  if (VALID_APPROVAL_TYPES.includes(type as AgentApprovalType)) {
    return type as AgentApprovalType;
  }
  return 'other'; // Default
}

/**
 * Validate an approval status
 */
function validateApprovalStatus(status: unknown): AgentApprovalStatus {
  if (VALID_APPROVAL_STATUSES.includes(status as AgentApprovalStatus)) {
    return status as AgentApprovalStatus;
  }
  return 'pending'; // Default
}

// ============================================
// Parse Functions
// ============================================

/**
 * Parse and validate a message object
 */
function parseMessage(msg: unknown, seenIds: Set<string>): AgentMessage | null {
  if (!msg || typeof msg !== 'object') return null;

  const m = msg as Record<string, unknown>;

  // Require content
  if (typeof m.content !== 'string') return null;

  // Generate or validate ID
  let id = typeof m.id === 'string' ? m.id : generateAgentId('msg');
  if (seenIds.has(id)) {
    id = generateAgentId('msg');
  }
  seenIds.add(id);

  const result: AgentMessage = {
    id,
    role: validateMessageRole(m.role),
    content: m.content,
    timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date().toISOString(),
  };

  // Parse optional metadata
  if (m.metadata && typeof m.metadata === 'object') {
    const meta = m.metadata as Record<string, unknown>;
    result.metadata = {};
    if (typeof meta.toolCallId === 'string') {
      result.metadata.toolCallId = meta.toolCallId;
    }
    if (typeof meta.error === 'string') {
      result.metadata.error = meta.error;
    }
    if (typeof meta.thinking === 'string') {
      result.metadata.thinking = meta.thinking;
    }
    // Remove empty metadata object
    if (Object.keys(result.metadata).length === 0) {
      delete result.metadata;
    }
  }

  return result;
}

/**
 * Parse and validate a task object
 */
function parseTask(task: unknown, seenIds: Set<string>): AgentTask | null {
  if (!task || typeof task !== 'object') return null;

  const t = task as Record<string, unknown>;

  // Require content
  if (typeof t.content !== 'string' || !t.content.trim()) return null;

  // Generate or validate ID
  let id = typeof t.id === 'string' ? t.id : generateAgentId('task');
  if (seenIds.has(id)) {
    id = generateAgentId('task');
  }
  seenIds.add(id);

  return {
    id,
    content: t.content.slice(0, 500),
    activeForm: typeof t.activeForm === 'string' ? t.activeForm.slice(0, 500) : t.content.slice(0, 500),
    status: validateTaskStatus(t.status),
    error: typeof t.error === 'string' ? t.error : undefined,
    createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
    startedAt: typeof t.startedAt === 'string' ? t.startedAt : undefined,
    completedAt: typeof t.completedAt === 'string' ? t.completedAt : undefined,
  };
}

/**
 * Parse and validate an approval request object
 */
function parseApprovalRequest(approval: unknown, seenIds: Set<string>): AgentApprovalRequest | null {
  if (!approval || typeof approval !== 'object') return null;

  const a = approval as Record<string, unknown>;

  // Require description
  if (typeof a.description !== 'string' || !a.description.trim()) return null;

  // Generate or validate ID
  let id = typeof a.id === 'string' ? a.id : generateAgentId('approval');
  if (seenIds.has(id)) {
    id = generateAgentId('approval');
  }
  seenIds.add(id);

  // Parse details
  const details: AgentApprovalRequest['details'] = {};
  if (a.details && typeof a.details === 'object') {
    const d = a.details as Record<string, unknown>;
    if (typeof d.filePath === 'string') details.filePath = d.filePath;
    if (typeof d.diff === 'string') details.diff = d.diff;
    if (typeof d.command === 'string') details.command = d.command;
    if (typeof d.url === 'string') details.url = d.url;
    if (typeof d.context === 'string') details.context = d.context;
  }

  return {
    id,
    type: validateApprovalType(a.type),
    status: validateApprovalStatus(a.status),
    description: a.description.slice(0, 1000),
    details,
    createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date().toISOString(),
    resolvedAt: typeof a.resolvedAt === 'string' ? a.resolvedAt : undefined,
    messageId: typeof a.messageId === 'string' ? a.messageId : undefined,
  };
}

/**
 * Parse and validate metadata
 */
function parseMetadata(metadata: unknown): AgentMetadata {
  const now = new Date().toISOString();

  if (!metadata || typeof metadata !== 'object') {
    return {
      name: 'New Agent',
      createdAt: now,
      updatedAt: now,
    };
  }

  const m = metadata as Record<string, unknown>;
  return {
    name: typeof m.name === 'string' && m.name.trim() ? m.name : 'New Agent',
    description: typeof m.description === 'string' ? m.description : undefined,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : now,
    updatedAt: typeof m.updatedAt === 'string' ? m.updatedAt : now,
  };
}

/**
 * Parse and validate config
 */
function parseConfig(config: unknown): AgentConfig {
  if (!config || typeof config !== 'object') {
    return { ...DEFAULT_AGENT_CONFIG };
  }

  const c = config as Record<string, unknown>;

  // Parse autoApproveTypes if present
  let autoApproveTypes: AgentApprovalType[] | undefined;
  if (Array.isArray(c.autoApproveTypes)) {
    autoApproveTypes = c.autoApproveTypes
      .filter((t): t is AgentApprovalType => VALID_APPROVAL_TYPES.includes(t as AgentApprovalType));
  }

  return {
    workingDirectory: typeof c.workingDirectory === 'string' ? c.workingDirectory : '',
    autoApprove: typeof c.autoApprove === 'boolean' ? c.autoApprove : false,
    autoApproveTypes,
    model: typeof c.model === 'string' ? c.model : DEFAULT_AGENT_CONFIG.model,
    customSystemPrompt: typeof c.customSystemPrompt === 'string' ? c.customSystemPrompt : undefined,
    maxTokens: typeof c.maxTokens === 'number' ? c.maxTokens : DEFAULT_AGENT_CONFIG.maxTokens,
  };
}

// ============================================
// Main Parser
// ============================================

/**
 * Create an empty .miku-agent document with default values
 */
export function createEmptyAgentDocument(): MikuAgentDocument {
  const now = new Date().toISOString();
  return {
    version: AGENT_VERSION,
    metadata: {
      name: 'New Agent',
      description: 'Claude Code integration',
      createdAt: now,
      updatedAt: now,
    },
    config: { ...DEFAULT_AGENT_CONFIG },
    conversation: [],
    tasks: [],
    pendingApprovals: [],
  };
}

/**
 * Parse a .miku-agent file content into a MikuAgentDocument
 * @param content - Raw file content (JSON string)
 * @returns Parsed and validated MikuAgentDocument
 */
export function parseAgentFile(content: string): MikuAgentDocument {
  const trimmed = content.trim();

  // Handle empty file
  if (!trimmed) {
    return createEmptyAgentDocument();
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    console.error('Invalid JSON in .miku-agent file:', error);
    return createEmptyAgentDocument();
  }

  if (!parsed || typeof parsed !== 'object') {
    return createEmptyAgentDocument();
  }

  const doc = parsed as Record<string, unknown>;

  // Check version (log warning for unknown versions but try to parse)
  if (doc.version && doc.version !== AGENT_VERSION) {
    console.warn(`Unknown .miku-agent version ${doc.version}, attempting to parse`);
  }

  // Track seen IDs for uniqueness
  const seenIds = new Set<string>();

  // Parse conversation
  const conversation: AgentMessage[] = [];
  if (Array.isArray(doc.conversation)) {
    for (const msg of doc.conversation.slice(0, 1000)) { // Max 1000 messages
      const parsed = parseMessage(msg, seenIds);
      if (parsed) conversation.push(parsed);
    }
  }

  // Parse tasks
  const tasks: AgentTask[] = [];
  if (Array.isArray(doc.tasks)) {
    for (const task of doc.tasks.slice(0, 100)) { // Max 100 tasks
      const parsed = parseTask(task, seenIds);
      if (parsed) tasks.push(parsed);
    }
  }

  // Parse pending approvals
  const pendingApprovals: AgentApprovalRequest[] = [];
  if (Array.isArray(doc.pendingApprovals)) {
    for (const approval of doc.pendingApprovals.slice(0, 50)) { // Max 50 pending approvals
      const parsed = parseApprovalRequest(approval, seenIds);
      if (parsed) pendingApprovals.push(parsed);
    }
  }

  return {
    version: AGENT_VERSION,
    metadata: parseMetadata(doc.metadata),
    config: parseConfig(doc.config),
    conversation,
    tasks,
    pendingApprovals,
  };
}

/**
 * Serialize a MikuAgentDocument to .miku-agent file format
 * Does NOT inject timestamps - serialization is idempotent for change detection
 * @param document - The agent document to serialize
 * @returns Formatted JSON string
 */
export function serializeAgentDocument(document: MikuAgentDocument): string {
  const output = {
    version: document.version,
    metadata: document.metadata,
    config: document.config,
    conversation: document.conversation,
    tasks: document.tasks,
    pendingApprovals: document.pendingApprovals,
  };

  return JSON.stringify(output, null, 2);
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new message
 */
export function createMessage(
  role: AgentMessageRole,
  content: string,
  metadata?: AgentMessage['metadata']
): AgentMessage {
  return {
    id: generateAgentId('msg'),
    role,
    content,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

/**
 * Create a new task
 */
export function createTask(content: string, activeForm?: string): AgentTask {
  return {
    id: generateAgentId('task'),
    content,
    activeForm: activeForm || content,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a new approval request
 */
export function createApprovalRequest(
  type: AgentApprovalType,
  description: string,
  details: AgentApprovalRequest['details'],
  messageId?: string
): AgentApprovalRequest {
  return {
    id: generateAgentId('approval'),
    type,
    status: 'pending',
    description,
    details,
    createdAt: new Date().toISOString(),
    messageId,
  };
}
