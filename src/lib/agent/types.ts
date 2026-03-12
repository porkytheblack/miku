/**
 * Re-export agent types from the main types directory
 *
 * EXPERIMENTAL: This is an experimental feature for Claude Code integration.
 */

export type {
  AgentMessageRole,
  AgentMessage,
  AgentTaskStatus,
  AgentTask,
  AgentApprovalType,
  AgentApprovalStatus,
  AgentApprovalRequest,
  AgentConfig,
  AgentMetadata,
  MikuAgentDocument,
  AgentConnectionStatus,
  AgentActivityStatus,
  AgentUIState,
  AgentEvent,
} from '@/types/agent';

export {
  DEFAULT_AGENT_CONFIG,
  DEFAULT_AGENT_UI_STATE,
  generateAgentId,
  resetAgentIdCounter,
  getApprovalTypeLabel,
  getApprovalTypeIcon,
  isLowRiskApproval,
} from '@/types/agent';
