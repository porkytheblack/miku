'use client';

/**
 * Agent Editor Context
 *
 * EXPERIMENTAL: This is an experimental feature for Claude Code integration.
 * Provides state management for .miku-agent files following the same patterns
 * as KanbanEditorContext and EnvEditorContext.
 *
 * Now includes Claude Code CLI bridge integration for real AI interactions.
 */

import { createContext, useContext, useReducer, useCallback, useRef, useEffect, ReactNode } from 'react';
import type {
  MikuAgentDocument,
  AgentMetadata,
  AgentConfig,
  AgentMessage,
  AgentTask,
  AgentApprovalRequest,
  AgentMessageRole,
  AgentTaskStatus,
  AgentApprovalStatus,
  AgentUIState,
  AgentActivityStatus,
  AgentConnectionStatus,
} from '@/types/agent';
import {
  parseAgentFile,
  serializeAgentDocument,
  createEmptyAgentDocument,
  createMessage,
  createTask,
  createApprovalRequest,
} from '@/lib/agent/parser';
import { DEFAULT_AGENT_UI_STATE, generateAgentId } from '@/types/agent';
import {
  ClaudeBridge,
  createClaudeBridge,
  convertPermissionToApproval,
  extractMessageText,
  extractThinkingText,
} from '@/lib/agent/claude-bridge';
import type {
  ClaudeMessageEvent,
  ClaudePermissionRequestEvent,
  ClaudeErrorEvent,
} from '@/lib/agent/claude-events';

// ============================================
// State Types
// ============================================

interface AgentEditorState {
  document: MikuAgentDocument;
  ui: AgentUIState;
  isModified: boolean;
  hasLoaded: boolean;
  /** Current streaming message content (for partial updates) */
  streamingMessageId: string | null;
  /** Map from our approval IDs to Claude's request IDs */
  approvalRequestMap: Map<string, string>;
}

// ============================================
// Action Types
// ============================================

type AgentEditorAction =
  // Document loading
  | { type: 'LOAD_CONTENT'; content: string }
  | { type: 'LOAD_DOCUMENT'; document: MikuAgentDocument }

  // Message operations
  | { type: 'ADD_MESSAGE'; role: AgentMessageRole; content: string; metadata?: AgentMessage['metadata'] }
  | { type: 'UPDATE_MESSAGE'; id: string; updates: Partial<Omit<AgentMessage, 'id' | 'timestamp'>> }
  | { type: 'DELETE_MESSAGE'; id: string }
  | { type: 'CLEAR_CONVERSATION' }

  // Task operations
  | { type: 'ADD_TASK'; content: string; activeForm?: string }
  | { type: 'UPDATE_TASK'; id: string; updates: Partial<Omit<AgentTask, 'id' | 'createdAt'>> }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'SET_TASK_STATUS'; id: string; status: AgentTaskStatus }
  | { type: 'CLEAR_COMPLETED_TASKS' }
  | { type: 'SET_TASKS'; tasks: AgentTask[] }

  // Approval operations
  | { type: 'ADD_APPROVAL'; approval: Omit<AgentApprovalRequest, 'id' | 'createdAt' | 'status'> }
  | { type: 'RESOLVE_APPROVAL'; id: string; status: AgentApprovalStatus }
  | { type: 'DELETE_APPROVAL'; id: string }

  // Config operations
  | { type: 'UPDATE_CONFIG'; config: Partial<AgentConfig> }
  | { type: 'UPDATE_METADATA'; metadata: Partial<AgentMetadata> }

  // UI state operations
  | { type: 'SET_CONNECTION_STATUS'; status: AgentConnectionStatus }
  | { type: 'SET_ACTIVITY_STATUS'; status: AgentActivityStatus }
  | { type: 'SET_ERROR'; error: string | undefined }
  | { type: 'TOGGLE_CONFIG_PANEL' }
  | { type: 'SET_CONFIG_PANEL_OPEN'; isOpen: boolean }
  | { type: 'SET_SELECTED_MESSAGE'; messageId: string | undefined }
  | { type: 'SET_GENERATING'; isGenerating: boolean }
  | { type: 'SET_INPUT_DRAFT'; draft: string }

  // Persistence
  | { type: 'MARK_SAVED' }

  // Claude bridge operations
  | { type: 'START_STREAMING'; messageId: string }
  | { type: 'UPDATE_STREAMING_MESSAGE'; content: string; thinking?: string }
  | { type: 'END_STREAMING' }
  | { type: 'ADD_APPROVAL_WITH_REQUEST_ID'; approval: Omit<AgentApprovalRequest, 'id' | 'createdAt' | 'status'>; requestId: string }
  | { type: 'CLEAR_APPROVAL_MAP' };

// ============================================
// Reducer
// ============================================

function agentEditorReducer(state: AgentEditorState, action: AgentEditorAction): AgentEditorState {
  switch (action.type) {
    case 'LOAD_CONTENT': {
      const parsed = parseAgentFile(action.content);
      return {
        ...state,
        document: parsed,
        isModified: false,
        hasLoaded: true,
        ui: { ...DEFAULT_AGENT_UI_STATE },
      };
    }

    case 'LOAD_DOCUMENT': {
      return {
        ...state,
        document: action.document,
        isModified: false,
        hasLoaded: true,
        ui: { ...DEFAULT_AGENT_UI_STATE },
      };
    }

    // Message operations
    case 'ADD_MESSAGE': {
      const newMessage = createMessage(action.role, action.content, action.metadata);
      return {
        ...state,
        document: {
          ...state.document,
          conversation: [...state.document.conversation, newMessage],
        },
        isModified: true,
      };
    }

    case 'UPDATE_MESSAGE': {
      return {
        ...state,
        document: {
          ...state.document,
          conversation: state.document.conversation.map(msg =>
            msg.id === action.id ? { ...msg, ...action.updates } : msg
          ),
        },
        isModified: true,
      };
    }

    case 'DELETE_MESSAGE': {
      return {
        ...state,
        document: {
          ...state.document,
          conversation: state.document.conversation.filter(msg => msg.id !== action.id),
        },
        isModified: true,
      };
    }

    case 'CLEAR_CONVERSATION': {
      return {
        ...state,
        document: {
          ...state.document,
          conversation: [],
        },
        isModified: true,
      };
    }

    // Task operations
    case 'ADD_TASK': {
      const newTask = createTask(action.content, action.activeForm);
      return {
        ...state,
        document: {
          ...state.document,
          tasks: [...state.document.tasks, newTask],
        },
        isModified: true,
      };
    }

    case 'UPDATE_TASK': {
      return {
        ...state,
        document: {
          ...state.document,
          tasks: state.document.tasks.map(task =>
            task.id === action.id ? { ...task, ...action.updates } : task
          ),
        },
        isModified: true,
      };
    }

    case 'DELETE_TASK': {
      return {
        ...state,
        document: {
          ...state.document,
          tasks: state.document.tasks.filter(task => task.id !== action.id),
        },
        isModified: true,
      };
    }

    case 'SET_TASK_STATUS': {
      const now = new Date().toISOString();
      return {
        ...state,
        document: {
          ...state.document,
          tasks: state.document.tasks.map(task => {
            if (task.id !== action.id) return task;

            const updates: Partial<AgentTask> = { status: action.status };

            // Set timestamps based on status
            if (action.status === 'in_progress' && !task.startedAt) {
              updates.startedAt = now;
            }
            if (action.status === 'completed' || action.status === 'failed') {
              updates.completedAt = now;
            }

            return { ...task, ...updates };
          }),
        },
        isModified: true,
      };
    }

    case 'CLEAR_COMPLETED_TASKS': {
      return {
        ...state,
        document: {
          ...state.document,
          tasks: state.document.tasks.filter(
            task => task.status !== 'completed' && task.status !== 'failed'
          ),
        },
        isModified: true,
      };
    }

    case 'SET_TASKS': {
      return {
        ...state,
        document: {
          ...state.document,
          tasks: action.tasks,
        },
        isModified: true,
      };
    }

    // Approval operations
    case 'ADD_APPROVAL': {
      const newApproval = createApprovalRequest(
        action.approval.type,
        action.approval.description,
        action.approval.details,
        action.approval.messageId
      );
      return {
        ...state,
        document: {
          ...state.document,
          pendingApprovals: [...state.document.pendingApprovals, newApproval],
        },
        ui: {
          ...state.ui,
          activityStatus: 'waiting_approval',
        },
        isModified: true,
      };
    }

    case 'RESOLVE_APPROVAL': {
      const now = new Date().toISOString();
      const updatedApprovals = state.document.pendingApprovals.map(approval =>
        approval.id === action.id
          ? { ...approval, status: action.status, resolvedAt: now }
          : approval
      );

      // Remove resolved approvals from pending
      const pendingApprovals = updatedApprovals.filter(a => a.status === 'pending');

      // Update activity status if no more pending approvals
      const newActivityStatus = pendingApprovals.length === 0 ? 'idle' : 'waiting_approval';

      return {
        ...state,
        document: {
          ...state.document,
          pendingApprovals,
        },
        ui: {
          ...state.ui,
          activityStatus: newActivityStatus,
        },
        isModified: true,
      };
    }

    case 'DELETE_APPROVAL': {
      const pendingApprovals = state.document.pendingApprovals.filter(a => a.id !== action.id);
      const newActivityStatus = pendingApprovals.length === 0 ? 'idle' : 'waiting_approval';

      return {
        ...state,
        document: {
          ...state.document,
          pendingApprovals,
        },
        ui: {
          ...state.ui,
          activityStatus: newActivityStatus,
        },
        isModified: true,
      };
    }

    // Config operations
    case 'UPDATE_CONFIG': {
      return {
        ...state,
        document: {
          ...state.document,
          config: { ...state.document.config, ...action.config },
        },
        isModified: true,
      };
    }

    case 'UPDATE_METADATA': {
      return {
        ...state,
        document: {
          ...state.document,
          metadata: { ...state.document.metadata, ...action.metadata },
        },
        isModified: true,
      };
    }

    // UI state operations
    case 'SET_CONNECTION_STATUS': {
      return {
        ...state,
        ui: { ...state.ui, connectionStatus: action.status },
      };
    }

    case 'SET_ACTIVITY_STATUS': {
      return {
        ...state,
        ui: { ...state.ui, activityStatus: action.status },
      };
    }

    case 'SET_ERROR': {
      return {
        ...state,
        ui: { ...state.ui, error: action.error },
      };
    }

    case 'TOGGLE_CONFIG_PANEL': {
      return {
        ...state,
        ui: { ...state.ui, isConfigOpen: !state.ui.isConfigOpen },
      };
    }

    case 'SET_CONFIG_PANEL_OPEN': {
      return {
        ...state,
        ui: { ...state.ui, isConfigOpen: action.isOpen },
      };
    }

    case 'SET_SELECTED_MESSAGE': {
      return {
        ...state,
        ui: { ...state.ui, selectedMessageId: action.messageId },
      };
    }

    case 'SET_GENERATING': {
      return {
        ...state,
        ui: {
          ...state.ui,
          isGenerating: action.isGenerating,
          activityStatus: action.isGenerating ? 'thinking' : 'idle',
        },
      };
    }

    case 'SET_INPUT_DRAFT': {
      return {
        ...state,
        ui: { ...state.ui, inputDraft: action.draft },
      };
    }

    // Persistence
    case 'MARK_SAVED': {
      return {
        ...state,
        document: {
          ...state.document,
          metadata: {
            ...state.document.metadata,
            updatedAt: new Date().toISOString(),
          },
        },
        isModified: false,
      };
    }

    // Claude bridge operations
    case 'START_STREAMING': {
      // Create a new assistant message for streaming
      const newMessage = createMessage('assistant', '', undefined);
      return {
        ...state,
        document: {
          ...state.document,
          conversation: [...state.document.conversation, { ...newMessage, id: action.messageId }],
        },
        streamingMessageId: action.messageId,
        ui: {
          ...state.ui,
          isGenerating: true,
          activityStatus: 'thinking',
        },
        isModified: true,
      };
    }

    case 'UPDATE_STREAMING_MESSAGE': {
      if (!state.streamingMessageId) return state;

      return {
        ...state,
        document: {
          ...state.document,
          conversation: state.document.conversation.map(msg =>
            msg.id === state.streamingMessageId
              ? {
                  ...msg,
                  content: action.content,
                  metadata: action.thinking ? { ...msg.metadata, thinking: action.thinking } : msg.metadata,
                }
              : msg
          ),
        },
        ui: {
          ...state.ui,
          activityStatus: 'working',
        },
      };
    }

    case 'END_STREAMING': {
      return {
        ...state,
        streamingMessageId: null,
        ui: {
          ...state.ui,
          isGenerating: false,
          activityStatus: 'idle',
        },
      };
    }

    case 'ADD_APPROVAL_WITH_REQUEST_ID': {
      const newApproval = createApprovalRequest(
        action.approval.type,
        action.approval.description,
        action.approval.details,
        action.approval.messageId
      );
      // Store the mapping from our approval ID to Claude's request ID
      const newMap = new Map(state.approvalRequestMap);
      newMap.set(newApproval.id, action.requestId);

      return {
        ...state,
        document: {
          ...state.document,
          pendingApprovals: [...state.document.pendingApprovals, newApproval],
        },
        approvalRequestMap: newMap,
        ui: {
          ...state.ui,
          activityStatus: 'waiting_approval',
        },
        isModified: true,
      };
    }

    case 'CLEAR_APPROVAL_MAP': {
      return {
        ...state,
        approvalRequestMap: new Map(),
      };
    }

    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

interface AgentEditorContextType {
  state: AgentEditorState;

  // Loading
  loadContent: (content: string) => void;
  loadDocument: (document: MikuAgentDocument) => void;

  // Messages
  addMessage: (role: AgentMessageRole, content: string, metadata?: AgentMessage['metadata']) => void;
  updateMessage: (id: string, updates: Partial<Omit<AgentMessage, 'id' | 'timestamp'>>) => void;
  deleteMessage: (id: string) => void;
  clearConversation: () => void;

  // Tasks
  addTask: (content: string, activeForm?: string) => void;
  updateTask: (id: string, updates: Partial<Omit<AgentTask, 'id' | 'createdAt'>>) => void;
  deleteTask: (id: string) => void;
  setTaskStatus: (id: string, status: AgentTaskStatus) => void;
  clearCompletedTasks: () => void;
  setTasks: (tasks: AgentTask[]) => void;

  // Approvals
  addApproval: (approval: Omit<AgentApprovalRequest, 'id' | 'createdAt' | 'status'>) => void;
  resolveApproval: (id: string, status: AgentApprovalStatus) => void;
  deleteApproval: (id: string) => void;
  approveRequest: (id: string) => void;
  rejectRequest: (id: string) => void;

  // Config
  updateConfig: (config: Partial<AgentConfig>) => void;
  updateMetadata: (metadata: Partial<AgentMetadata>) => void;

  // UI State
  setConnectionStatus: (status: AgentConnectionStatus) => void;
  setActivityStatus: (status: AgentActivityStatus) => void;
  setError: (error: string | undefined) => void;
  toggleConfigPanel: () => void;
  setConfigPanelOpen: (isOpen: boolean) => void;
  setSelectedMessage: (messageId: string | undefined) => void;
  setGenerating: (isGenerating: boolean) => void;
  setInputDraft: (draft: string) => void;

  // Serialization
  getContent: () => string;
  markSaved: () => void;

  // Computed helpers
  getPendingApprovals: () => AgentApprovalRequest[];
  getActiveTasks: () => AgentTask[];
  getMessageById: (id: string) => AgentMessage | undefined;

  // Claude Code bridge methods
  /** Start a Claude Code session with the given prompt */
  startClaudeSession: (prompt: string) => Promise<void>;
  /** Stop the current Claude Code session */
  stopClaudeSession: () => Promise<void>;
  /** Send a message to Claude (starts a new session or continues) */
  sendToClaud: (prompt: string) => Promise<void>;
  /** Respond to a permission request */
  respondToPermission: (approvalId: string, granted: boolean) => Promise<void>;
  /** Check if Claude is currently connected */
  isClaudeConnected: () => boolean;
}

const AgentEditorContext = createContext<AgentEditorContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================

const initialState: AgentEditorState = {
  document: createEmptyAgentDocument(),
  ui: { ...DEFAULT_AGENT_UI_STATE },
  isModified: false,
  hasLoaded: false,
  streamingMessageId: null,
  approvalRequestMap: new Map(),
};

export function AgentEditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(agentEditorReducer, initialState);

  // Claude bridge instance (persists across re-renders)
  const bridgeRef = useRef<ClaudeBridge | null>(null);

  // Initialize bridge on mount
  useEffect(() => {
    if (!bridgeRef.current) {
      bridgeRef.current = createClaudeBridge();
    }

    // Cleanup on unmount
    return () => {
      if (bridgeRef.current?.isActive()) {
        bridgeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Loading
  const loadContent = useCallback((content: string) => {
    dispatch({ type: 'LOAD_CONTENT', content });
  }, []);

  const loadDocument = useCallback((document: MikuAgentDocument) => {
    dispatch({ type: 'LOAD_DOCUMENT', document });
  }, []);

  // Messages
  const addMessage = useCallback((role: AgentMessageRole, content: string, metadata?: AgentMessage['metadata']) => {
    dispatch({ type: 'ADD_MESSAGE', role, content, metadata });
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Omit<AgentMessage, 'id' | 'timestamp'>>) => {
    dispatch({ type: 'UPDATE_MESSAGE', id, updates });
  }, []);

  const deleteMessage = useCallback((id: string) => {
    dispatch({ type: 'DELETE_MESSAGE', id });
  }, []);

  const clearConversation = useCallback(() => {
    dispatch({ type: 'CLEAR_CONVERSATION' });
  }, []);

  // Tasks
  const addTask = useCallback((content: string, activeForm?: string) => {
    dispatch({ type: 'ADD_TASK', content, activeForm });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Omit<AgentTask, 'id' | 'createdAt'>>) => {
    dispatch({ type: 'UPDATE_TASK', id, updates });
  }, []);

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TASK', id });
  }, []);

  const setTaskStatus = useCallback((id: string, status: AgentTaskStatus) => {
    dispatch({ type: 'SET_TASK_STATUS', id, status });
  }, []);

  const clearCompletedTasks = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPLETED_TASKS' });
  }, []);

  const setTasks = useCallback((tasks: AgentTask[]) => {
    dispatch({ type: 'SET_TASKS', tasks });
  }, []);

  // Approvals
  const addApproval = useCallback((approval: Omit<AgentApprovalRequest, 'id' | 'createdAt' | 'status'>) => {
    dispatch({ type: 'ADD_APPROVAL', approval });
  }, []);

  const resolveApproval = useCallback((id: string, status: AgentApprovalStatus) => {
    dispatch({ type: 'RESOLVE_APPROVAL', id, status });
  }, []);

  const deleteApproval = useCallback((id: string) => {
    dispatch({ type: 'DELETE_APPROVAL', id });
  }, []);

  const approveRequest = useCallback((id: string) => {
    dispatch({ type: 'RESOLVE_APPROVAL', id, status: 'approved' });
  }, []);

  const rejectRequest = useCallback((id: string) => {
    dispatch({ type: 'RESOLVE_APPROVAL', id, status: 'rejected' });
  }, []);

  // Config
  const updateConfig = useCallback((config: Partial<AgentConfig>) => {
    dispatch({ type: 'UPDATE_CONFIG', config });
  }, []);

  const updateMetadata = useCallback((metadata: Partial<AgentMetadata>) => {
    dispatch({ type: 'UPDATE_METADATA', metadata });
  }, []);

  // UI State
  const setConnectionStatus = useCallback((status: AgentConnectionStatus) => {
    dispatch({ type: 'SET_CONNECTION_STATUS', status });
  }, []);

  const setActivityStatus = useCallback((status: AgentActivityStatus) => {
    dispatch({ type: 'SET_ACTIVITY_STATUS', status });
  }, []);

  const setError = useCallback((error: string | undefined) => {
    dispatch({ type: 'SET_ERROR', error });
  }, []);

  const toggleConfigPanel = useCallback(() => {
    dispatch({ type: 'TOGGLE_CONFIG_PANEL' });
  }, []);

  const setConfigPanelOpen = useCallback((isOpen: boolean) => {
    dispatch({ type: 'SET_CONFIG_PANEL_OPEN', isOpen });
  }, []);

  const setSelectedMessage = useCallback((messageId: string | undefined) => {
    dispatch({ type: 'SET_SELECTED_MESSAGE', messageId });
  }, []);

  const setGenerating = useCallback((isGenerating: boolean) => {
    dispatch({ type: 'SET_GENERATING', isGenerating });
  }, []);

  const setInputDraft = useCallback((draft: string) => {
    dispatch({ type: 'SET_INPUT_DRAFT', draft });
  }, []);

  // Serialization
  const getContent = useCallback(() => {
    return serializeAgentDocument(state.document);
  }, [state.document]);

  const markSaved = useCallback(() => {
    dispatch({ type: 'MARK_SAVED' });
  }, []);

  // Computed helpers
  const getPendingApprovals = useCallback((): AgentApprovalRequest[] => {
    return state.document.pendingApprovals.filter(a => a.status === 'pending');
  }, [state.document.pendingApprovals]);

  const getActiveTasks = useCallback((): AgentTask[] => {
    return state.document.tasks.filter(
      t => t.status === 'pending' || t.status === 'in_progress'
    );
  }, [state.document.tasks]);

  const getMessageById = useCallback((id: string): AgentMessage | undefined => {
    return state.document.conversation.find(m => m.id === id);
  }, [state.document.conversation]);

  // ============================================
  // Claude Bridge Methods
  // ============================================

  /**
   * Start a Claude Code session with the given prompt
   */
  const startClaudeSession = useCallback(async (prompt: string): Promise<void> => {
    const bridge = bridgeRef.current;
    if (!bridge) {
      throw new Error('Claude bridge not initialized');
    }

    // If already connected, stop the existing session
    if (bridge.isActive()) {
      await bridge.stop();
    }

    // Set connecting status
    dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connecting' });

    // Create a message ID for the streaming response
    const messageId = generateAgentId('msg');

    // Set up event handlers
    bridge.setHandlers({
      onMessage: (event: ClaudeMessageEvent) => {
        const text = extractMessageText(event);
        const thinking = extractThinkingText(event);

        if (event.partial) {
          // Update the streaming message
          dispatch({ type: 'UPDATE_STREAMING_MESSAGE', content: text, thinking: thinking ?? undefined });
        } else {
          // Final message - ensure content is complete
          dispatch({ type: 'UPDATE_STREAMING_MESSAGE', content: text, thinking: thinking ?? undefined });
        }
      },

      onPermissionRequest: (event: ClaudePermissionRequestEvent) => {
        // Convert Claude's permission request to our approval format
        const { approval, requestId } = convertPermissionToApproval(event);
        dispatch({
          type: 'ADD_APPROVAL_WITH_REQUEST_ID',
          approval: { ...approval, messageId },
          requestId,
        });
      },

      onError: (event: ClaudeErrorEvent) => {
        console.error('[AgentEditor] Claude error:', event.error);
        dispatch({ type: 'SET_ERROR', error: event.error.message });
        dispatch({ type: 'END_STREAMING' });
      },

      onCompletion: () => {
        dispatch({ type: 'END_STREAMING' });
      },

      onResult: () => {
        dispatch({ type: 'END_STREAMING' });
      },

      onExit: (code) => {
        console.log('[AgentEditor] Claude process exited with code:', code);
        dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
        dispatch({ type: 'END_STREAMING' });
        dispatch({ type: 'CLEAR_APPROVAL_MAP' });
      },

      onAnyEvent: (event) => {
        console.log('[AgentEditor] Claude event:', event.type, event);
      },
    });

    try {
      // Start streaming placeholder
      dispatch({ type: 'START_STREAMING', messageId });

      // Start the Claude session
      await bridge.start({
        workingDirectory: state.document.config.workingDirectory || process.cwd?.() || '.',
        prompt,
        model: state.document.config.model,
        systemPrompt: state.document.config.customSystemPrompt,
        maxTokens: state.document.config.maxTokens,
      });

      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
    } catch (error) {
      console.error('[AgentEditor] Failed to start Claude session:', error);
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'error' });
      dispatch({ type: 'SET_ERROR', error: error instanceof Error ? error.message : String(error) });
      dispatch({ type: 'END_STREAMING' });
      throw error;
    }
  }, [state.document.config]);

  /**
   * Stop the current Claude Code session
   */
  const stopClaudeSession = useCallback(async (): Promise<void> => {
    const bridge = bridgeRef.current;
    if (bridge?.isActive()) {
      await bridge.stop();
      dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
      dispatch({ type: 'END_STREAMING' });
      dispatch({ type: 'CLEAR_APPROVAL_MAP' });
    }
  }, []);

  /**
   * Send a message to Claude
   * Adds the user message and starts a Claude session
   */
  const sendToClaud = useCallback(async (prompt: string): Promise<void> => {
    // Add user message first
    dispatch({ type: 'ADD_MESSAGE', role: 'user', content: prompt });

    // Start Claude session with the prompt
    await startClaudeSession(prompt);
  }, [startClaudeSession]);

  /**
   * Respond to a permission request
   */
  const respondToPermission = useCallback(async (approvalId: string, granted: boolean): Promise<void> => {
    const bridge = bridgeRef.current;
    if (!bridge?.isActive()) {
      throw new Error('No active Claude session');
    }

    // Get the Claude request ID from our approval ID
    const requestId = state.approvalRequestMap.get(approvalId);
    if (!requestId) {
      throw new Error(`Unknown approval ID: ${approvalId}`);
    }

    // Send the response to Claude (using the Claude request ID)
    await bridge.respondToPermission(requestId, granted);

    // Update our approval status
    dispatch({
      type: 'RESOLVE_APPROVAL',
      id: approvalId,
      status: granted ? 'approved' : 'rejected',
    });
  }, [state.approvalRequestMap]);

  /**
   * Check if Claude is currently connected
   */
  const isClaudeConnected = useCallback((): boolean => {
    return bridgeRef.current?.isActive() ?? false;
  }, []);

  const value: AgentEditorContextType = {
    state,
    loadContent,
    loadDocument,
    addMessage,
    updateMessage,
    deleteMessage,
    clearConversation,
    addTask,
    updateTask,
    deleteTask,
    setTaskStatus,
    clearCompletedTasks,
    setTasks,
    addApproval,
    resolveApproval,
    deleteApproval,
    approveRequest,
    rejectRequest,
    updateConfig,
    updateMetadata,
    setConnectionStatus,
    setActivityStatus,
    setError,
    toggleConfigPanel,
    setConfigPanelOpen,
    setSelectedMessage,
    setGenerating,
    setInputDraft,
    getContent,
    markSaved,
    getPendingApprovals,
    getActiveTasks,
    getMessageById,
    // Claude bridge methods
    startClaudeSession,
    stopClaudeSession,
    sendToClaud,
    respondToPermission,
    isClaudeConnected,
  };

  return (
    <AgentEditorContext.Provider value={value}>
      {children}
    </AgentEditorContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useAgentEditor() {
  const context = useContext(AgentEditorContext);
  if (!context) {
    throw new Error('useAgentEditor must be used within an AgentEditorProvider');
  }
  return context;
}
