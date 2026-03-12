/**
 * Miku Remote — Agent Relay
 *
 * Relays agent chat events between host and remote devices.
 *
 * Host side: Intercepts AcpClient events and forwards them to remote peers.
 *            Receives remote commands and forwards them to the local AcpClient.
 *
 * Remote side: Receives agent events and dispatches them into the local UI.
 *              Sends commands and approval responses back to the host.
 */

import type { MikuPeer } from './peer';
import type { AgentRelayMessage } from './types';
import type { AcpSessionUpdate, AcpPermissionRequest } from '@/lib/acpClient';
import type {
  AgentMessage,
  AgentTask,
  AgentActivityStatus,
  AgentConnectionStatus,
} from '@/types/agent';

// ============================================
// Host-side Relay
// ============================================

export interface AgentRelayHostHandlers {
  /** Called when a remote device sends a command to the agent */
  onRemoteCommand?: (prompt: string) => void;
  /** Called when a remote device responds to an approval request */
  onRemoteApproval?: (approvalId: string, granted: boolean) => void;
}

export class AgentRelayHost {
  private peer: MikuPeer;
  private handlers: AgentRelayHostHandlers = {};

  constructor(peer: MikuPeer) {
    this.peer = peer;
  }

  setHandlers(handlers: AgentRelayHostHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Forward an ACP session update to remote peers.
   */
  relaySessionUpdate(update: AcpSessionUpdate): void {
    this.peer.sendAgentRelayMessage({
      type: 'agent_event',
      event: update,
    });
  }

  /**
   * Forward agent status changes to remote peers.
   */
  relayStatus(status: AgentActivityStatus, connectionStatus: AgentConnectionStatus): void {
    this.peer.sendAgentRelayMessage({
      type: 'agent_status',
      status,
      connectionStatus,
    });
  }

  /**
   * Forward a permission request to remote peers.
   */
  relayPermissionRequest(request: AcpPermissionRequest): void {
    this.peer.sendAgentRelayMessage({
      type: 'agent_permission',
      request,
    });
  }

  /**
   * Send the full session state to a newly connected remote peer.
   */
  sendSessionState(conversation: AgentMessage[], tasks: AgentTask[]): void {
    this.peer.sendAgentRelayMessage({
      type: 'agent_session_state',
      conversation,
      tasks,
    });
  }

  /**
   * Handle incoming messages from remote peers.
   */
  handleMessage(message: AgentRelayMessage): void {
    switch (message.type) {
      case 'remote_command':
        this.handlers.onRemoteCommand?.(message.prompt);
        break;
      case 'remote_approval':
        this.handlers.onRemoteApproval?.(message.approvalId, message.granted);
        break;
    }
  }
}

// ============================================
// Remote-side (viewer/controller) Relay
// ============================================

export interface AgentRelayRemoteHandlers {
  /** Called when an agent event is received from the host */
  onAgentEvent?: (event: AcpSessionUpdate) => void;
  /** Called when agent status changes on the host */
  onAgentStatus?: (status: AgentActivityStatus, connectionStatus: AgentConnectionStatus) => void;
  /** Called when a permission request comes from the host */
  onPermissionRequest?: (request: AcpPermissionRequest) => void;
  /** Called when the full session state is received (initial sync) */
  onSessionState?: (conversation: AgentMessage[], tasks: AgentTask[]) => void;
}

export class AgentRelayRemote {
  private peer: MikuPeer;
  private handlers: AgentRelayRemoteHandlers = {};

  constructor(peer: MikuPeer) {
    this.peer = peer;
  }

  setHandlers(handlers: AgentRelayRemoteHandlers): void {
    this.handlers = handlers;
  }

  /**
   * Send a command to the host's agent.
   */
  sendCommand(prompt: string): void {
    this.peer.sendAgentRelayMessage({
      type: 'remote_command',
      prompt,
    });
  }

  /**
   * Respond to an approval request on the host.
   */
  respondToApproval(approvalId: string, granted: boolean): void {
    this.peer.sendAgentRelayMessage({
      type: 'remote_approval',
      approvalId,
      granted,
    });
  }

  /**
   * Handle incoming messages from the host.
   */
  handleMessage(message: AgentRelayMessage): void {
    switch (message.type) {
      case 'agent_event':
        this.handlers.onAgentEvent?.(message.event);
        break;
      case 'agent_status':
        this.handlers.onAgentStatus?.(message.status, message.connectionStatus);
        break;
      case 'agent_permission':
        this.handlers.onPermissionRequest?.(message.request);
        break;
      case 'agent_session_state':
        this.handlers.onSessionState?.(message.conversation, message.tasks);
        break;
    }
  }
}
