/**
 * Agent Chat document types and serialization
 *
 * .miku-chat files store ACP agent conversation state.
 * The actual agent communication is handled by AcpClient.
 */

import type { AcpToolCallInfo } from './acpClient';

// ============================================
// Chat Document Types
// ============================================

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'thought';
  content: string;
  timestamp: string;
  toolCalls?: AcpToolCallInfo[];
}

export interface AgentChatDocument {
  version: string;
  agentConfig: {
    /** Working directory for the agent session */
    cwd?: string;
    /** Display name for the agent */
    agentName?: string;
  };
  messages: AgentChatMessage[];
  currentMode?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Document Serialization
// ============================================

export function createAgentChatDocument(cwd?: string): AgentChatDocument {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    agentConfig: {
      cwd,
      agentName: 'Claude Code',
    },
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function parseAgentChatDocument(content: string): AgentChatDocument {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Empty agent chat document');
  }
  const parsed = JSON.parse(trimmed);
  if (!parsed.agentConfig || !Array.isArray(parsed.messages)) {
    throw new Error('Invalid agent chat document format');
  }
  return parsed as AgentChatDocument;
}

export function serializeAgentChatDocument(doc: AgentChatDocument): string {
  return JSON.stringify(doc, null, 2);
}

let messageCounter = 0;
export function generateMessageId(): string {
  messageCounter++;
  return `msg-${messageCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
