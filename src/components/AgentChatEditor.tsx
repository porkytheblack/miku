'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useRemote } from '@/context/RemoteContext';
import { isTauri } from '@/lib/tauri';
import {
  AcpClient,
  type AcpSessionUpdate,
  type AcpToolCallInfo,
  type PermissionMode,
} from '@/lib/acpClient';
import {
  AgentChatMessage,
  AgentChatDocument,
  parseAgentChatDocument,
  serializeAgentChatDocument,
  createAgentChatDocument,
  generateMessageId,
} from '@/lib/agentChat';

const MarkdownPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then(mod => mod.default),
  { ssr: false, loading: () => null }
);

// ============================================
// Constants
// ============================================
const PERMISSION_OPTIONS = [
  { value: 'auto-approve', label: 'Auto-approve', desc: 'All tools run automatically', color: '#f5a623' },
  { value: 'allowed-tools', label: 'Default perms', desc: 'Uses your Claude Code config', color: '#27ae60' },
  { value: 'plan', label: 'Plan mode', desc: 'Read-only, no edits', color: '#5b8def' },
] as const;

const MODEL_OPTIONS = [
  { value: '', label: 'Default model', desc: 'Use Claude Code default' },
  { value: 'claude-sonnet-4-20250514', label: 'Sonnet 4', desc: 'Fast and capable' },
  { value: 'claude-opus-4-20250514', label: 'Opus 4', desc: 'Most capable' },
  { value: 'claude-haiku-4-20250506', label: 'Haiku 4', desc: 'Fast and affordable' },
] as const;

// ============================================
// Types
// ============================================
interface TaskItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

interface PermissionRequest {
  id: string;
  toolCall: AcpToolCallInfo;
  resolve: (approved: boolean) => void;
}

interface AgentChatEditorProps {
  initialContent?: string;
  onContentChange: (content: string) => void;
}

// ============================================
// Main Component
// ============================================
export default function AgentChatEditor({ initialContent, onContentChange }: AgentChatEditorProps) {
  const { workspace } = useWorkspace();
  const { isActive: isRemoteActive, remote: remoteState, getAgentRelayRemote, getAgentRelayHost } = useRemote();

  // Remote guest mode: this chat is a relay viewer, not a local ACP session
  const isRemoteGuest = isRemoteActive && remoteState.role === 'guest';
  const isRemoteHost = isRemoteActive && remoteState.role === 'host';

  const [doc, setDoc] = useState<AgentChatDocument>(() => {
    if (initialContent) {
      try { return parseAgentChatDocument(initialContent); } catch { /* fallthrough */ }
    }
    return createAgentChatDocument(workspace.currentWorkspace?.path);
  });

  // Core state
  const [messages, setMessages] = useState<AgentChatMessage[]>(doc.messages);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(isRemoteGuest); // Guest starts "connected" via relay
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThought, setStreamingThought] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<Map<string, AcpToolCallInfo>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [stderrLog, setStderrLog] = useState('');
  const [agentName, setAgentName] = useState(isRemoteGuest ? 'Claude Code (Remote)' : (doc.agentConfig.agentName || 'Claude Code'));
  const [cwdInput, setCwdInput] = useState(doc.agentConfig.cwd || workspace.currentWorkspace?.path || '');
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('auto-approve');
  const [selectedModel, setSelectedModel] = useState('');

  // Enhanced state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [fileChanges, setFileChanges] = useState<Map<string, { tool: string; status: string }>>(new Map());
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const [showStderr, setShowStderr] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const clientRef = useRef<AcpClient | null>(null);
  const streamContentRef = useRef('');
  const streamThoughtRef = useRef('');
  const streamToolCallsRef = useRef<Map<string, AcpToolCallInfo>>(new Map());

  const inTauri = isTauri();

  // Persist doc
  const persistDoc = useCallback((msgs: AgentChatMessage[], configOverrides?: Partial<AgentChatDocument['agentConfig']>) => {
    const updated: AgentChatDocument = {
      ...doc,
      agentConfig: { ...doc.agentConfig, ...configOverrides },
      messages: msgs,
      updatedAt: new Date().toISOString(),
    };
    setDoc(updated);
    onContentChange(serializeAgentChatDocument(updated));
  }, [doc, onContentChange]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streamingThought, activeToolCalls, pendingPermission]);

  // Focus input
  useEffect(() => {
    if (isConnected && !pendingPermission) inputRef.current?.focus();
  }, [isConnected, pendingPermission]);

  // Connect
  const handleConnect = useCallback(async () => {
    if (!inTauri) {
      setError('Agent Chat requires the Miku desktop app (Tauri) to connect to Claude Code.');
      return;
    }

    setIsConnecting(true);
    setError(null);
    setStderrLog('');

    try {
      const client = new AcpClient();

      client.onSessionUpdate = (update: AcpSessionUpdate) => {
        switch (update.type) {
          case 'agent_message_chunk':
            if (update.text) {
              streamContentRef.current += update.text;
              setStreamingContent(prev => prev + update.text);
            }
            break;

          case 'agent_thought_chunk':
            if (update.text) {
              streamThoughtRef.current += update.text;
              setStreamingThought(prev => prev + update.text);
            }
            break;

          case 'tool_call':
            if (update.toolCall) {
              streamToolCallsRef.current.set(update.toolCall.toolCallId, update.toolCall);
              setActiveToolCalls(prev => {
                const next = new Map(prev);
                next.set(update.toolCall!.toolCallId, update.toolCall!);
                return next;
              });
            }
            break;

          case 'tool_call_update':
            if (update.toolCall) {
              const merged = { ...streamToolCallsRef.current.get(update.toolCall.toolCallId), ...update.toolCall };
              streamToolCallsRef.current.set(update.toolCall.toolCallId, merged);
              setActiveToolCalls(prev => {
                const next = new Map(prev);
                const ex = next.get(update.toolCall!.toolCallId);
                next.set(update.toolCall!.toolCallId, { ...ex, ...update.toolCall! });
                return next;
              });

              // Extract tasks
              if (merged.title === 'TodoWrite' && merged.rawInput) {
                const inp = merged.rawInput as { todos?: TaskItem[] };
                if (inp.todos && Array.isArray(inp.todos)) {
                  setTasks(inp.todos);
                }
              }

              // Track file changes
              const toolName = merged.title;
              if (toolName && merged.rawInput) {
                const inp = merged.rawInput as Record<string, unknown>;
                const filePath = (inp.file_path || inp.path) as string | undefined;
                if (filePath && ['Edit', 'Write', 'Read', 'NotebookEdit'].includes(toolName)) {
                  setFileChanges(prev => {
                    const next = new Map(prev);
                    next.set(filePath, { tool: toolName, status: merged.status || 'in_progress' });
                    return next;
                  });
                }
              }
            }
            break;
        }
      };

      client.onError = (errMsg: string) => setError(errMsg);
      client.onStderr = (text: string) => setStderrLog(prev => prev + text);
      client.onLog = (msg: string) => setStderrLog(prev => prev + `[log] ${msg}\n`);
      client.onDisconnect = () => {
        setIsConnected(false);
        setIsRunning(false);
      };

      const cwd = cwdInput.trim() || workspace.currentWorkspace?.path || '.';
      client.permissionMode = permissionMode;
      client.model = selectedModel;
      await client.connect(cwd);

      clientRef.current = client;
      setIsConnected(true);
      setAgentName(client.agentInfo?.name || 'Claude Code');

      // Persist the working directory so reopening this chat remembers it
      queueMicrotask(() => persistDoc(messages, { cwd }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  }, [inTauri, cwdInput, permissionMode, selectedModel, workspace.currentWorkspace?.path, messages, persistDoc]);

  // Cleanup
  useEffect(() => {
    return () => { clientRef.current?.disconnect(); };
  }, []);

  // Remote guest: wire up agent relay to receive events from host
  useEffect(() => {
    if (!isRemoteGuest) return;
    const relay = getAgentRelayRemote();
    if (!relay) return;

    relay.setHandlers({
      onAgentEvent: (update: AcpSessionUpdate) => {
        // Process session updates the same way as local AcpClient
        switch (update.type) {
          case 'agent_message_chunk':
            if (update.text) {
              streamContentRef.current += update.text;
              setStreamingContent(prev => prev + update.text);
            }
            break;
          case 'agent_thought_chunk':
            if (update.text) {
              streamThoughtRef.current += update.text;
              setStreamingThought(prev => prev + update.text);
            }
            break;
          case 'tool_call':
            if (update.toolCall) {
              streamToolCallsRef.current.set(update.toolCall.toolCallId, update.toolCall);
              setActiveToolCalls(prev => {
                const next = new Map(prev);
                next.set(update.toolCall!.toolCallId, update.toolCall!);
                return next;
              });
            }
            break;
          case 'tool_call_update':
            if (update.toolCall) {
              const merged = { ...streamToolCallsRef.current.get(update.toolCall.toolCallId), ...update.toolCall };
              streamToolCallsRef.current.set(update.toolCall.toolCallId, merged);
              setActiveToolCalls(prev => {
                const next = new Map(prev);
                const ex = next.get(update.toolCall!.toolCallId);
                next.set(update.toolCall!.toolCallId, { ...ex, ...update.toolCall! });
                return next;
              });
              if (merged.title === 'TodoWrite' && merged.rawInput) {
                const inp = merged.rawInput as { todos?: TaskItem[] };
                if (inp.todos && Array.isArray(inp.todos)) setTasks(inp.todos);
              }
            }
            break;
        }
      },
      onAgentStatus: (status, connectionStatus) => {
        setIsRunning(status === 'thinking' || status === 'working');
        setIsConnected(connectionStatus === 'connected');
      },
      onSessionState: (conversation) => {
        // Populate full chat history from host
        const chatMessages: AgentChatMessage[] = conversation.map(msg => ({
          id: generateMessageId(),
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: msg.timestamp ?? new Date().toISOString(),
        }));
        setMessages(chatMessages);
        setIsConnected(true);
      },
      onPermissionRequest: (request) => {
        const permId = request.toolCall?.toolCallId ?? generateMessageId();
        setPendingPermission({
          id: permId,
          toolCall: {
            toolCallId: permId,
            title: request.toolCall?.title ?? 'Tool',
            status: 'in_progress',
          },
          resolve: (approved) => {
            relay.respondToApproval(permId, approved);
            setPendingPermission(null);
          },
        });
      },
    });
  }, [isRemoteGuest, getAgentRelayRemote]);

  // Remote host: forward ACP session updates to connected remotes
  useEffect(() => {
    if (!isRemoteHost || !clientRef.current) return;
    const relay = getAgentRelayHost();
    if (!relay) return;

    const originalHandler = clientRef.current.onSessionUpdate;
    clientRef.current.onSessionUpdate = (update: AcpSessionUpdate) => {
      originalHandler?.(update);
      relay.relaySessionUpdate(update);
    };

    // Also set up handler for remote commands
    relay.setHandlers({
      onRemoteCommand: (prompt) => {
        if (clientRef.current?.connected) {
          clientRef.current.prompt(prompt);
        }
      },
    });
  }, [isRemoteHost, getAgentRelayHost, isConnected]);

  // Send prompt
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isRunning) return;

    // Remote guest: send command to host via relay
    if (isRemoteGuest) {
      const relay = getAgentRelayRemote();
      if (!relay) return;
      setInput('');

      const userMsg: AgentChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      relay.sendCommand(text);
      return;
    }

    if (!clientRef.current?.connected) return;

    setInput('');
    setError(null);
    setStreamingContent('');
    setStreamingThought('');
    setActiveToolCalls(new Map());
    setTasks([]);
    setFileChanges(new Map());
    streamContentRef.current = '';
    streamThoughtRef.current = '';
    streamToolCallsRef.current = new Map();

    const userMsg: AgentChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsRunning(true);

    try {
      // Sync current settings before each prompt
      clientRef.current.permissionMode = permissionMode;
      clientRef.current.model = selectedModel;
      const { resultText } = await clientRef.current.prompt(text);

      const finalMessages: AgentChatMessage[] = [...newMessages];

      if (streamThoughtRef.current) {
        finalMessages.push({
          id: generateMessageId(),
          role: 'thought',
          content: streamThoughtRef.current,
          timestamp: new Date().toISOString(),
        });
      }

      const content = streamContentRef.current || resultText || '';
      const toolCalls = streamToolCallsRef.current.size > 0
        ? Array.from(streamToolCallsRef.current.values())
        : undefined;

      finalMessages.push({
        id: generateMessageId(),
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        toolCalls,
      });

      setMessages(finalMessages);
      queueMicrotask(() => persistDoc(finalMessages));
    } catch (err) {
      if ((err as Error).message !== 'cancelled') {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
      queueMicrotask(() => persistDoc(newMessages));
    } finally {
      setIsRunning(false);
      setStreamingContent('');
      setStreamingThought('');
      setActiveToolCalls(new Map());
    }
  }, [input, isRunning, messages, persistDoc, permissionMode, selectedModel]);

  const handleCancel = useCallback(async () => {
    await clientRef.current?.cancel();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setTasks([]);
    setFileChanges(new Map());
    persistDoc([]);
  }, [persistDoc]);

  // Handle permission approval
  const handlePermissionApprove = useCallback(() => {
    if (pendingPermission) {
      pendingPermission.resolve(true);
      setPendingPermission(null);
    }
  }, [pendingPermission]);

  const handlePermissionDeny = useCallback(() => {
    if (pendingPermission) {
      pendingPermission.resolve(false);
      setPendingPermission(null);
    }
  }, [pendingPermission]);

  // Not in Tauri
  if (!inTauri) {
    return (
      <div style={S.centeredContainer}>
        <ChatIcon size={48} color="var(--text-tertiary)" opacity={0.4} />
        <p style={S.emptyTitle}>Agent Chat requires Miku Desktop</p>
        <p style={S.emptySubtitle}>
          Connects to Claude Code running on your device. This feature requires the Miku desktop app.
        </p>
      </div>
    );
  }

  return (
    <div style={S.root}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <ChatIcon size={18} color="var(--accent-primary)" />
          <span style={S.headerTitle}>{agentName}</span>
          <StatusBadge
            connected={isConnected}
            connecting={isConnecting}
          />
          {isRemoteActive && (
            <span style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: remoteState.role === 'guest' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              color: remoteState.role === 'guest' ? '#818cf8' : '#22c55e',
              fontWeight: 500,
            }}>
              {remoteState.role === 'guest' ? 'Remote' : 'Shared'}
            </span>
          )}
        </div>
        <div style={S.headerRight}>
          {isConnected && !isRemoteGuest && (
            <CwdBadge
              cwd={cwdInput}
              disabled={isRunning}
              onChangeCwd={async (newCwd) => {
                setCwdInput(newCwd);
                persistDoc(messages, { cwd: newCwd });
                // Reconnect with new cwd
                clientRef.current?.disconnect();
                setIsConnected(false);
                setTimeout(() => handleConnect(), 100);
              }}
              onBrowse={inTauri ? async () => {
                try {
                  const { open } = await import('@tauri-apps/plugin-dialog');
                  const selected = await open({ directory: true, title: 'Select working directory' });
                  if (selected) {
                    setCwdInput(selected as string);
                    persistDoc(messages, { cwd: selected as string });
                    clientRef.current?.disconnect();
                    setIsConnected(false);
                    setTimeout(() => handleConnect(), 100);
                  }
                } catch { /* cancelled */ }
              } : undefined}
            />
          )}
          {isConnected && !isRemoteGuest && (
            <HeaderDropdown
              label={PERMISSION_OPTIONS.find(o => o.value === permissionMode)?.label || 'Mode'}
              color={PERMISSION_OPTIONS.find(o => o.value === permissionMode)?.color || 'var(--text-secondary)'}
              disabled={isRunning}
            >
              {PERMISSION_OPTIONS.map(opt => (
                <DropdownItem
                  key={opt.value}
                  selected={permissionMode === opt.value}
                  onClick={() => setPermissionMode(opt.value as PermissionMode)}
                >
                  <span style={{ fontWeight: 500 }}>{opt.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{opt.desc}</span>
                </DropdownItem>
              ))}
            </HeaderDropdown>
          )}
          {isConnected && !isRemoteGuest && (
            <HeaderDropdown
              label={MODEL_OPTIONS.find(o => o.value === selectedModel)?.label || 'Default'}
              color="var(--text-secondary)"
              disabled={isRunning}
            >
              {MODEL_OPTIONS.map(opt => (
                <DropdownItem
                  key={opt.value}
                  selected={selectedModel === opt.value}
                  onClick={() => setSelectedModel(opt.value)}
                >
                  <span style={{ fontWeight: 500 }}>{opt.label}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{opt.desc}</span>
                </DropdownItem>
              ))}
            </HeaderDropdown>
          )}
          {!isConnected && !isConnecting && !isRemoteGuest && (
            <Button variant="primary" size="sm" onClick={handleConnect}>
              Reconnect
            </Button>
          )}
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearChat} disabled={isRunning}>
              Clear
            </Button>
          )}
          {stderrLog && (
            <Button variant="ghost" size="sm" onClick={() => setShowStderr(!showStderr)}>
              Logs
            </Button>
          )}
        </div>
      </header>

      {/* Stderr log panel */}
      {showStderr && stderrLog && (
        <div style={S.stderrPanel}>
          <div style={S.stderrHeader}>
            <span style={S.stderrTitle}>Process Output</span>
            <button onClick={() => setShowStderr(false)} style={S.stderrClose}>&times;</button>
          </div>
          <pre style={S.stderrContent}>{stderrLog}</pre>
        </div>
      )}

      {/* Messages area */}
      <div style={S.messagesArea}>
        {/* Connect screen — skipped for remote guests */}
        {messages.length === 0 && !isConnected && !isConnecting && !isRemoteGuest && (
          <ConnectScreen
            cwdInput={cwdInput}
            onCwdChange={setCwdInput}
            permissionMode={permissionMode}
            onPermissionModeChange={setPermissionMode}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onConnect={handleConnect}
            error={error}
            stderrLog={stderrLog}
            inTauri={inTauri}
          />
        )}

        {/* Connected empty */}
        {messages.length === 0 && !isRunning && isConnected && (
          <div style={S.centeredContainer}>
            <ChatIcon size={48} color="var(--text-tertiary)" opacity={0.4} />
            <p style={S.emptyTitle}>{isRemoteGuest ? 'Connected to Remote Agent' : `Connected to ${agentName}`}</p>
            <p style={S.emptySubtitle}>
              {isRemoteGuest
                ? 'Viewing the host\'s agent session. You can send commands below.'
                : 'Type a message below to start working.'}
            </p>
          </div>
        )}

        {/* Connecting */}
        {isConnecting && messages.length === 0 && (
          <div style={S.centeredContainer}>
            <Spinner size={24} />
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' as unknown as number }}>
              Connecting to Claude Code...
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} agentName={agentName} />
        ))}

        {/* Live streaming section */}
        {isRunning && (
          <div style={S.streamingSection}>
            {/* Tasks panel */}
            {tasks.length > 0 && (
              <TaskPanel tasks={tasks} />
            )}

            {/* File changes */}
            {fileChanges.size > 0 && (
              <FileChangesPanel changes={fileChanges} />
            )}

            {/* Active tool calls */}
            {activeToolCalls.size > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Array.from(activeToolCalls.values()).map((tc) => (
                  <ToolCallBlock key={tc.toolCallId} toolCall={tc} />
                ))}
              </div>
            )}

            {/* Permission approval modal */}
            {pendingPermission && (
              <PermissionApprovalCard
                toolCall={pendingPermission.toolCall}
                onApprove={handlePermissionApprove}
                onDeny={handlePermissionDeny}
              />
            )}

            {/* Streaming thought */}
            {streamingThought && (
              <div style={S.thoughtBlock}>
                <div style={S.thoughtLabel}>Thinking</div>
                {streamingThought}
              </div>
            )}

            {/* Streaming content */}
            {streamingContent && (
              <div style={S.streamBlock}>
                <div style={S.streamLabel}>{agentName}</div>
                <div className="agent-chat-markdown" style={S.streamContent}>
                  <MarkdownPreview
                    source={streamingContent}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)',
                      lineHeight: 'var(--leading-relaxed)',
                      fontFamily: 'var(--font-sans)',
                    }}
                  />
                  <span style={S.cursor} />
                </div>
              </div>
            )}

            {/* Thinking indicator (no output yet) */}
            {!streamingContent && activeToolCalls.size === 0 && !streamingThought && (
              <div style={S.thinkingIndicator}>
                <Spinner size={14} />
                <span>{agentName} is thinking...</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && !isConnecting && isConnected && (
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {isConnected && (
        <div style={S.inputArea}>
          <div style={S.inputRow}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${agentName}...`}
              disabled={isRunning || !!pendingPermission}
              rows={1}
              style={S.textarea}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 160) + 'px';
              }}
            />
            {isRunning ? (
              <Button variant="danger" onClick={handleCancel}>Stop</Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSend}
                disabled={!input.trim() || !!pendingPermission}
              >
                Send
              </Button>
            )}
          </div>
          <div style={S.inputHint}>
            <span>Enter to send, Shift+Enter for new line</span>
            <span>{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

        /* Markdown styling for agent chat messages */
        .agent-chat-markdown .wmde-markdown {
          background: transparent !important;
          font-family: var(--font-sans) !important;
        }
        .agent-chat-markdown .wmde-markdown h1,
        .agent-chat-markdown .wmde-markdown h2,
        .agent-chat-markdown .wmde-markdown h3,
        .agent-chat-markdown .wmde-markdown h4,
        .agent-chat-markdown .wmde-markdown h5,
        .agent-chat-markdown .wmde-markdown h6 {
          color: var(--text-primary);
          border-bottom-color: var(--border-default);
          margin-top: 1em;
          margin-bottom: 0.5em;
          line-height: 1.4;
        }
        .agent-chat-markdown .wmde-markdown h1 { font-size: 1.25em; }
        .agent-chat-markdown .wmde-markdown h2 { font-size: 1.15em; }
        .agent-chat-markdown .wmde-markdown h3 { font-size: 1.05em; }
        .agent-chat-markdown .wmde-markdown p {
          color: var(--text-primary);
          margin: 0.5em 0;
        }
        .agent-chat-markdown .wmde-markdown li {
          color: var(--text-primary);
        }
        .agent-chat-markdown .wmde-markdown ul,
        .agent-chat-markdown .wmde-markdown ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
        }
        .agent-chat-markdown .wmde-markdown a {
          color: var(--accent-primary);
          text-decoration: none;
        }
        .agent-chat-markdown .wmde-markdown a:hover {
          text-decoration: underline;
        }
        .agent-chat-markdown .wmde-markdown code {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          padding: 1px 4px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono);
          font-size: 0.88em;
        }
        .agent-chat-markdown .wmde-markdown pre {
          background: var(--bg-tertiary) !important;
          border-radius: var(--radius-md);
          padding: var(--space-3) !important;
          margin: 0.5em 0;
          overflow-x: auto;
        }
        .agent-chat-markdown .wmde-markdown pre code {
          background: transparent;
          padding: 0;
          font-size: 12px;
          line-height: 1.5;
        }
        .agent-chat-markdown .wmde-markdown blockquote {
          border-left: 3px solid var(--border-default);
          color: var(--text-secondary);
          margin: 0.5em 0;
          padding: 0.25em 1em;
        }
        .agent-chat-markdown .wmde-markdown table {
          border-collapse: collapse;
          margin: 0.5em 0;
          width: 100%;
        }
        .agent-chat-markdown .wmde-markdown table th,
        .agent-chat-markdown .wmde-markdown table td {
          border: 1px solid var(--border-default);
          padding: var(--space-1) var(--space-2);
          font-size: 0.9em;
        }
        .agent-chat-markdown .wmde-markdown table th {
          background: var(--bg-tertiary);
          font-weight: 600;
        }
        .agent-chat-markdown .wmde-markdown hr {
          background-color: var(--border-default);
          border: none;
          height: 1px;
          margin: 1em 0;
        }
        .agent-chat-markdown .wmde-markdown img {
          max-width: 100%;
          border-radius: var(--radius-md);
        }
        .agent-chat-markdown .wmde-markdown strong {
          color: var(--text-primary);
          font-weight: 600;
        }
        .agent-chat-markdown .wmde-markdown em {
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}

// ============================================
// Connect Screen
// ============================================
function ConnectScreen({
  cwdInput, onCwdChange, permissionMode, onPermissionModeChange,
  selectedModel, onModelChange,
  onConnect, error, stderrLog, inTauri,
}: {
  cwdInput: string;
  onCwdChange: (v: string) => void;
  permissionMode: PermissionMode;
  onPermissionModeChange: (v: PermissionMode) => void;
  selectedModel: string;
  onModelChange: (v: string) => void;
  onConnect: () => void;
  error: string | null;
  stderrLog: string;
  inTauri: boolean;
}) {
  return (
    <div style={S.centeredContainer}>
      <div style={S.connectCard}>
        <div style={S.connectHeader}>
          <ChatIcon size={32} color="var(--accent-primary)" />
          <h2 style={S.connectTitle}>Claude Code Agent</h2>
          <p style={S.connectSubtitle}>
            Connect to Claude Code on your device. Uses your existing login.
          </p>
        </div>

        {/* Working directory */}
        <div style={S.formGroup}>
          <label style={S.formLabel}>Working directory</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={cwdInput}
              onChange={(e) => onCwdChange(e.target.value)}
              placeholder="/path/to/project"
              style={S.formInput}
              onKeyDown={(e) => { if (e.key === 'Enter') onConnect(); }}
            />
            {inTauri && (
              <Button variant="secondary" onClick={async () => {
                try {
                  const { open } = await import('@tauri-apps/plugin-dialog');
                  const selected = await open({ directory: true, title: 'Select working directory' });
                  if (selected) onCwdChange(selected as string);
                } catch { /* cancelled */ }
              }}>
                Browse
              </Button>
            )}
          </div>
        </div>

        {/* Permission mode */}
        <div style={S.formGroup}>
          <label style={S.formLabel}>Tool permissions</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PERMISSION_OPTIONS.map(opt => (
              <OptionButton
                key={opt.value}
                selected={permissionMode === opt.value}
                onClick={() => onPermissionModeChange(opt.value as PermissionMode)}
                color={opt.color}
              >
                <div style={S.optionTitle}>{opt.label}</div>
                <div style={S.optionDesc}>{opt.desc}</div>
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Model selection */}
        <div style={S.formGroup}>
          <label style={S.formLabel}>Model</label>
          <select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            style={{
              ...S.formInput,
              cursor: 'pointer',
              appearance: 'none' as const,
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              paddingRight: '30px',
            }}
          >
            {MODEL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.desc}
              </option>
            ))}
          </select>
        </div>

        {/* Connect button */}
        <Button
          variant="primary"
          size="lg"
          onClick={onConnect}
          disabled={!cwdInput.trim()}
          fullWidth
        >
          Connect to Claude Code
        </Button>

        {/* Error */}
        {error && <ErrorBanner message={error} />}

        {/* Stderr */}
        {stderrLog && (
          <details style={{ width: '100%' }}>
            <summary style={S.detailsSummary}>Process output</summary>
            <pre style={S.detailsPre}>{stderrLog}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

// ============================================
// Chat Message
// ============================================
function ChatMessage({ message, agentName }: { message: AgentChatMessage; agentName: string }) {
  const isUser = message.role === 'user';
  const isThought = message.role === 'thought';

  if (isThought) {
    return (
      <div style={{
        ...S.messageContainer,
        animation: 'fadeIn var(--duration-normal) var(--easing-out)',
      }}>
        <div style={S.thoughtBlock}>
          <div style={S.thoughtLabel}>Thinking</div>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      ...S.messageContainer,
      animation: 'fadeIn var(--duration-normal) var(--easing-out)',
    }}>
      {/* Tool calls above the message */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
          {message.toolCalls.map((tc) => (
            <ToolCallBlock key={tc.toolCallId} toolCall={tc} />
          ))}
        </div>
      )}

      {message.content && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          background: isUser ? 'var(--bg-tertiary)' : 'transparent',
          borderLeft: isUser ? 'none' : '2px solid var(--accent-primary)',
        }}>
          <div style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: isUser ? 'var(--text-secondary)' : 'var(--accent-primary)',
            marginBottom: 'var(--space-1)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.04em',
          }}>
            {isUser ? 'You' : agentName}
          </div>
          {isUser ? (
            <div style={{
              fontSize: 'var(--text-sm)',
              lineHeight: 'var(--leading-relaxed)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--text-primary)',
            }}>
              {message.content}
            </div>
          ) : (
            <div className="agent-chat-markdown">
              <MarkdownPreview
                source={message.content}
                style={{
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)',
                  lineHeight: 'var(--leading-relaxed)',
                  fontFamily: 'var(--font-sans)',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Tool Call Block (Rich Rendering)
// ============================================
function ToolCallBlock({ toolCall }: { toolCall: AcpToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = toolCall.title || '';
  const input = toolCall.rawInput as Record<string, unknown> | undefined;
  const summary = getToolSummary(toolName, input);
  const badge = getToolBadge(toolName);
  const isInProgress = toolCall.status === 'in_progress';
  const shouldAutoExpand = isInProgress && toolName !== 'TodoWrite';

  return (
    <div style={{
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
      animation: 'fadeIn var(--duration-fast) var(--easing-out)',
    }}>
      <button onClick={() => setExpanded(!expanded)} style={S.toolCallHeader}>
        <span style={{
          width: '16px', height: '16px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isInProgress ? (
            <MiniSpinner />
          ) : toolCall.status === 'completed' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : toolCall.status === 'failed' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-tertiary)' }} />
          )}
        </span>
        <span style={{
          fontSize: '10px', padding: '1px 6px',
          background: badge.bg, borderRadius: 'var(--radius-sm)',
          color: badge.color, fontWeight: 500, flexShrink: 0,
        }}>
          {badge.label}
        </span>
        <span style={{
          fontWeight: 500, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: '12px',
        }}>
          {summary}
        </span>
        <ChevronIcon expanded={expanded || shouldAutoExpand} />
      </button>

      {(expanded || shouldAutoExpand) && (
        <div style={{
          borderTop: '1px solid var(--border-default)',
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--bg-primary)',
        }}>
          <ToolCallBody toolCall={toolCall} />
        </div>
      )}
    </div>
  );
}

// ============================================
// Tool Call Body (tool-specific rendering)
// ============================================
function ToolCallBody({ toolCall }: { toolCall: AcpToolCallInfo }) {
  const toolName = toolCall.title || '';
  const input = toolCall.rawInput as Record<string, unknown> | undefined;
  const output = toolCall.rawOutput;

  if (toolName === 'Edit' && input) {
    return (
      <div style={S.toolBodyStack}>
        <FilePathLabel path={input.file_path as string} />
        {input.old_string != null && (
          <DiffView oldStr={String(input.old_string)} newStr={String(input.new_string || '')} />
        )}
        {output != null && <OutputBlock output={output} />}
      </div>
    );
  }

  if (toolName === 'Write' && input) {
    return (
      <div style={S.toolBodyStack}>
        <FilePathLabel path={input.file_path as string} />
        {input.content != null && (
          <CodeBlock label="Content" code={String(input.content)} maxHeight={300}
            language={guessLang(String(input.file_path || ''))} />
        )}
        {output != null && <OutputBlock output={output} />}
      </div>
    );
  }

  if (toolName === 'Read' && input) {
    return (
      <div style={S.toolBodyStack}>
        <FilePathLabel path={input.file_path as string} />
        {output != null && (
          <CodeBlock label="File content" code={extractText(output)} maxHeight={400}
            language={guessLang(String(input.file_path || ''))} />
        )}
      </div>
    );
  }

  if (toolName === 'Bash' && input) {
    return (
      <div style={S.toolBodyStack}>
        <div style={S.bashCommand}>
          <span style={{ color: 'var(--text-tertiary)', userSelect: 'none' }}>$</span>
          <span style={{ color: '#4ade80' }}>{String(input.command || '')}</span>
        </div>
        {input.description && (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            {String(input.description)}
          </div>
        )}
        {output != null && <CodeBlock label="Output" code={extractText(output)} maxHeight={300} />}
      </div>
    );
  }

  if ((toolName === 'Grep' || toolName === 'Glob') && input) {
    return (
      <div style={S.toolBodyStack}>
        <div style={S.searchQuery}>
          {toolName === 'Grep' ? `grep "${input.pattern || ''}"` : `glob "${input.pattern || ''}"`}
          {input.path ? ` in ${input.path}` : ''}
        </div>
        {output != null && <CodeBlock label="Results" code={extractText(output)} maxHeight={300} />}
      </div>
    );
  }

  if (toolName === 'TodoWrite' && input) {
    return <TaskPanel tasks={(input.todos || []) as TaskItem[]} />;
  }

  if ((toolName === 'WebSearch' || toolName === 'WebFetch') && input) {
    return (
      <div style={S.toolBodyStack}>
        <div style={S.searchQuery}>
          {toolName === 'WebSearch' ? `Search: "${input.query || ''}"` : `Fetch: ${input.url || ''}`}
        </div>
        {output != null && <CodeBlock label="Result" code={extractText(output)} maxHeight={300} />}
      </div>
    );
  }

  // Fallback
  return (
    <div style={S.toolBodyStack}>
      {input != null && <CodeBlock label="Input" code={formatJson(input)} maxHeight={200} />}
      {output != null && <CodeBlock label="Output" code={extractText(output)} maxHeight={300} />}
    </div>
  );
}

// ============================================
// Permission Approval Card
// ============================================
function PermissionApprovalCard({
  toolCall, onApprove, onDeny,
}: {
  toolCall: AcpToolCallInfo;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const toolName = toolCall.title || 'Tool';
  const input = toolCall.rawInput as Record<string, unknown> | undefined;
  const badge = getToolBadge(toolName);
  const summary = getToolSummary(toolName, input);

  // Determine risk level
  const isHighRisk = ['Bash', 'Write', 'Edit', 'NotebookEdit'].includes(toolName);

  return (
    <div style={{
      border: `2px solid ${isHighRisk ? 'rgba(245, 166, 35, 0.4)' : 'rgba(99, 102, 241, 0.3)'}`,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      background: isHighRisk ? 'rgba(245, 166, 35, 0.04)' : 'rgba(99, 102, 241, 0.03)',
      animation: 'slideIn var(--duration-normal) var(--easing-out)',
    }}>
      {/* Header */}
      <div style={{
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        borderBottom: '1px solid var(--border-default)',
        background: isHighRisk ? 'rgba(245, 166, 35, 0.06)' : 'rgba(99, 102, 241, 0.04)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={isHighRisk ? '#f5a623' : 'rgb(99, 102, 241)'} strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span style={{
          fontWeight: 600, fontSize: 'var(--text-sm)',
          color: isHighRisk ? '#f5a623' : 'rgb(99, 102, 241)',
        }}>
          Permission Required
        </span>
      </div>

      {/* Tool info */}
      <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <span style={{
            fontSize: '10px', padding: '2px 6px',
            background: badge.bg, borderRadius: 'var(--radius-sm)',
            color: badge.color, fontWeight: 500,
          }}>
            {badge.label}
          </span>
          <span style={{
            fontWeight: 500, fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
          }}>
            {summary}
          </span>
        </div>

        {/* Show tool details */}
        {input && (
          <div style={{
            marginBottom: 'var(--space-3)',
            maxHeight: '200px', overflow: 'auto',
          }}>
            <ToolCallBody toolCall={toolCall} />
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'flex', gap: 'var(--space-2)',
          justifyContent: 'flex-end',
        }}>
          <Button variant="ghost" onClick={onDeny}>
            Deny
          </Button>
          <Button variant="primary" onClick={onApprove}>
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Task Panel
// ============================================
function TaskPanel({ tasks }: { tasks: TaskItem[] }) {
  if (!tasks.length) return null;

  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      overflow: 'hidden',
      background: 'var(--bg-secondary)',
    }}>
      <div style={S.panelHeader}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          Tasks
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: '11px' }}>
          {completed}/{total}
        </span>
      </div>
      {/* Progress */}
      <div style={{ height: '2px', background: 'var(--bg-tertiary)' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: pct === 100 ? '#27ae60' : 'var(--accent-primary)',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ padding: 'var(--space-1) 0' }}>
        {tasks.map((task, i) => (
          <div key={i} style={{
            padding: 'var(--space-1) var(--space-3)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            fontSize: '12px',
            opacity: task.status === 'completed' ? 0.6 : 1,
          }}>
            <TaskStatusIcon status={task.status} />
            <span style={{
              textDecoration: task.status === 'completed' ? 'line-through' : 'none',
              color: task.status === 'in_progress' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}>
              {task.status === 'in_progress' ? task.activeForm : task.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskStatusIcon({ status }: { status: string }) {
  const size = 14;
  if (status === 'completed') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2.5">
        <rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(39,174,96,0.12)" stroke="#27ae60" />
        <polyline points="17 8 10 16 7 13" />
      </svg>
    );
  }
  if (status === 'in_progress') {
    return (
      <div style={{
        width: size, height: size, borderRadius: '3px',
        border: '2px solid var(--accent-primary)',
        background: 'rgba(217, 119, 87, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'pulse 2s ease-in-out infinite',
      }}>
        <div style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'var(--accent-primary)',
        }} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '3px',
      border: '1.5px solid var(--border-default)',
    }} />
  );
}

// ============================================
// File Changes Panel
// ============================================
function FileChangesPanel({ changes }: { changes: Map<string, { tool: string; status: string }> }) {
  const [expanded, setExpanded] = useState(true);
  const entries = Array.from(changes.entries());
  const editCount = entries.filter(([, v]) => v.tool === 'Edit' || v.tool === 'Write').length;
  const readCount = entries.filter(([, v]) => v.tool === 'Read').length;

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-default)',
      overflow: 'hidden', background: 'var(--bg-secondary)',
    }}>
      <button onClick={() => setExpanded(!expanded)} style={S.panelHeaderBtn}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Files
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {editCount > 0 && <span style={{ color: '#f5a623' }}>{editCount} edited</span>}
          {editCount > 0 && readCount > 0 && <span>&middot;</span>}
          {readCount > 0 && <span>{readCount} read</span>}
          <ChevronIcon expanded={expanded} />
        </span>
      </button>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-default)', padding: 'var(--space-1) 0' }}>
          {entries.map(([path, info]) => {
            const fileName = path.split('/').pop() || path;
            const isEdit = info.tool === 'Edit' || info.tool === 'Write';
            return (
              <div key={path} style={{
                padding: '3px var(--space-3)',
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                fontSize: '11px', fontFamily: 'var(--font-mono)',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: isEdit ? '#f5a623' : 'rgb(99, 102, 241)',
                }} />
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: 'var(--text-secondary)', flex: 1,
                }} title={path}>
                  {fileName}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {info.tool}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// Diff View
// ============================================
function DiffView({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  return (
    <div style={{
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
      border: '1px solid var(--border-default)',
      fontSize: '11px', fontFamily: 'var(--font-mono)', lineHeight: '1.5',
    }}>
      <div style={{
        padding: '3px 8px', background: 'var(--bg-tertiary)',
        fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)',
        textTransform: 'uppercase' as const, borderBottom: '1px solid var(--border-default)',
      }}>
        Changes
      </div>
      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
        {oldLines.map((line, i) => (
          <div key={`r-${i}`} style={{
            padding: '0 8px', background: 'rgba(231, 76, 60, 0.06)',
            color: '#e74c3c', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            <span style={{ userSelect: 'none', color: 'rgba(231, 76, 60, 0.4)', marginRight: '8px' }}>-</span>
            {line}
          </div>
        ))}
        {newLines.map((line, i) => (
          <div key={`a-${i}`} style={{
            padding: '0 8px', background: 'rgba(39, 174, 96, 0.06)',
            color: '#27ae60', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            <span style={{ userSelect: 'none', color: 'rgba(39, 174, 96, 0.4)', marginRight: '8px' }}>+</span>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Shared Components
// ============================================
function FilePathLabel({ path }: { path?: string }) {
  if (!path) return null;
  const fileName = path.split('/').pop() || path;
  const dir = path.substring(0, path.length - fileName.length);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      {dir && <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{dir}</span>}
      <span style={{ fontWeight: 500 }}>{fileName}</span>
    </div>
  );
}

function CodeBlock({ label, code, maxHeight = 200, language }: {
  label?: string; code: string; maxHeight?: number; language?: string;
}) {
  return (
    <div>
      {label && (
        <div style={{
          fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)',
          marginBottom: '3px', textTransform: 'uppercase' as const,
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          {label}
          {language && <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'lowercase' as const }}>{language}</span>}
        </div>
      )}
      <pre style={{
        margin: 0, padding: '6px 8px',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '11px', lineHeight: '1.4',
        overflow: 'auto', maxHeight,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'var(--font-mono)',
      }}>
        {code}
      </pre>
    </div>
  );
}

function OutputBlock({ output }: { output: unknown }) {
  const text = extractText(output);
  if (!text) return null;
  return <CodeBlock label="Output" code={text} maxHeight={200} />;
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div style={{
      padding: 'var(--space-3) var(--space-4)',
      background: 'rgba(231, 76, 60, 0.06)',
      border: '1px solid rgba(231, 76, 60, 0.2)',
      borderRadius: 'var(--radius-md)',
      color: '#e74c3c', fontSize: 'var(--text-sm)',
      display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)',
      animation: 'fadeIn var(--duration-normal) var(--easing-out)',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <span style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', color: '#e74c3c',
          cursor: 'pointer', padding: '0', fontSize: '16px', lineHeight: 1,
        }}>&times;</button>
      )}
    </div>
  );
}

function Button({ children, variant = 'primary', size = 'md', onClick, disabled, fullWidth }: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 500, cursor: disabled ? 'default' : 'pointer',
    borderRadius: 'var(--radius-md)',
    transition: 'all var(--duration-fast) var(--easing-default)',
    opacity: disabled ? 0.5 : 1,
    fontFamily: 'inherit',
    width: fullWidth ? '100%' : undefined,
  };

  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { padding: '4px 10px', fontSize: '12px' },
    md: { padding: '8px 16px', fontSize: '13px' },
    lg: { padding: '10px 24px', fontSize: '14px' },
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--accent-primary)', color: 'white', border: 'none',
    },
    secondary: {
      background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
      border: '1px solid var(--border-default)',
    },
    ghost: {
      background: 'transparent', color: 'var(--text-secondary)',
      border: '1px solid var(--border-default)',
    },
    danger: {
      background: 'rgba(231, 76, 60, 0.08)', color: '#e74c3c',
      border: '1px solid rgba(231, 76, 60, 0.2)',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...baseStyle, ...sizeStyles[size], ...variantStyles[variant] }}
    >
      {children}
    </button>
  );
}

function OptionButton({ children, selected, onClick, color }: {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: 'var(--space-3)', textAlign: 'left',
      background: selected ? `color-mix(in srgb, ${color} 8%, transparent)` : 'var(--bg-primary)',
      border: `1.5px solid ${selected ? color : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)', cursor: 'pointer',
      transition: 'all var(--duration-fast) var(--easing-default)',
    }}>
      {children}
    </button>
  );
}

function StatusBadge({ connected, connecting }: { connected: boolean; connecting: boolean }) {
  const color = connected ? '#27ae60' : connecting ? 'var(--accent-primary)' : '#e74c3c';
  const label = connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected';
  return (
    <span style={{
      fontSize: '10px', padding: '2px 8px',
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      borderRadius: 'var(--radius-full)', color, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: '4px',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color,
        animation: connecting ? 'pulse 1.5s ease-in-out infinite' : undefined,
      }} />
      {label}
    </span>
  );
}

function CwdBadge({ cwd, disabled, onChangeCwd, onBrowse }: {
  cwd: string;
  disabled?: boolean;
  onChangeCwd: (newCwd: string) => void;
  onBrowse?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(cwd);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setValue(cwd);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, cwd]);

  const shortPath = cwd ? (cwd.split('/').pop() || cwd) : 'No directory';

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && value.trim()) {
              setEditing(false);
              if (value.trim() !== cwd) onChangeCwd(value.trim());
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={() => setEditing(false)}
          style={{
            fontSize: '10px', padding: '2px 6px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            width: '200px',
            outline: 'none',
          }}
        />
        {onBrowse && (
          <button
            onMouseDown={e => { e.preventDefault(); onBrowse(); setEditing(false); }}
            style={{
              fontSize: '10px', padding: '2px 6px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ...
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => !disabled && setEditing(true)}
      title={cwd || 'Click to set working directory'}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        fontSize: '10px', padding: '2px 8px',
        background: 'rgba(130, 130, 130, 0.08)',
        border: '1px solid rgba(130, 130, 130, 0.25)',
        borderRadius: 'var(--radius-full)',
        color: 'var(--text-secondary)',
        fontWeight: 500,
        fontFamily: 'var(--font-mono)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        whiteSpace: 'nowrap',
        maxWidth: '150px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
      </svg>
      {shortPath}
    </button>
  );
}

function HeaderDropdown({ label, color, disabled, children }: {
  label: string;
  color: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '10px', padding: '2px 8px',
          background: color.startsWith('#') ? `${color}14` : 'transparent',
          border: `1px solid ${color.startsWith('#') ? `${color}40` : 'var(--border-primary)'}`,
          borderRadius: 'var(--radius-full)',
          color,
          fontWeight: 500,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
        }}
      >
        {label}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '4px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 100, minWidth: '180px',
            padding: '4px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ selected, onClick, children }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: '1px',
        width: '100%', padding: '6px 10px',
        background: selected ? 'var(--bg-tertiary)' : 'transparent',
        border: 'none', borderRadius: 'var(--radius-sm)',
        cursor: 'pointer', textAlign: 'left',
        color: 'var(--text-primary)',
        fontFamily: 'inherit',
        fontSize: '12px',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget.style.background = 'var(--bg-secondary)'); }}
      onMouseLeave={e => { if (!selected) (e.currentTarget.style.background = 'transparent'); }}
    >
      {children}
    </button>
  );
}

function ChatIcon({ size = 18, color = 'currentColor', opacity = 1 }: {
  size?: number; color?: string; opacity?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" opacity={opacity}>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="var(--text-tertiary)" strokeWidth="2.5"
      style={{
        transition: 'transform var(--duration-fast) var(--easing-default)',
        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
        flexShrink: 0,
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '2px solid var(--border-default)',
      borderTopColor: 'var(--accent-primary)',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  );
}

function MiniSpinner() {
  return (
    <span style={{
      display: 'inline-block', width: 12, height: 12,
      border: '1.5px solid var(--border-default)',
      borderTopColor: 'var(--accent-primary)',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  );
}

// ============================================
// Helpers
// ============================================
function formatJson(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function extractText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    return output.map(b => {
      if (typeof b === 'string') return b;
      if (b && typeof b === 'object') {
        if ('text' in b) return String(b.text);
        if ('content' in b) return String(b.content);
      }
      return JSON.stringify(b, null, 2);
    }).join('\n');
  }
  if (output && typeof output === 'object') {
    const o = output as Record<string, unknown>;
    if ('text' in o) return String(o.text);
    if ('content' in o) return String(o.content);
  }
  return JSON.stringify(output, null, 2);
}

function getToolSummary(toolName: string, input?: Record<string, unknown>): string {
  if (!input) return toolName;
  switch (toolName) {
    case 'Edit': return `Edit ${(input.file_path as string)?.split('/').pop() || 'file'}`;
    case 'Write': return `Write ${(input.file_path as string)?.split('/').pop() || 'file'}`;
    case 'Read': return `Read ${(input.file_path as string)?.split('/').pop() || 'file'}`;
    case 'Bash': {
      const cmd = String(input.command || '').slice(0, 60);
      return cmd ? `$ ${cmd}${String(input.command || '').length > 60 ? '...' : ''}` : 'Run command';
    }
    case 'Grep': return `Search "${input.pattern || ''}"`;
    case 'Glob': return `Find "${input.pattern || ''}"`;
    case 'TodoWrite': return 'Update tasks';
    case 'WebSearch': return `Search "${input.query || ''}"`;
    case 'WebFetch': return `Fetch ${input.url || ''}`;
    case 'NotebookEdit': return 'Edit notebook';
    default: return toolName;
  }
}

function getToolBadge(toolName: string): { label: string; bg: string; color: string } {
  switch (toolName) {
    case 'Edit': case 'Write': case 'NotebookEdit':
      return { label: 'Edit', bg: 'rgba(245, 166, 35, 0.1)', color: '#f5a623' };
    case 'Read':
      return { label: 'Read', bg: 'rgba(99, 102, 241, 0.08)', color: 'rgb(99, 102, 241)' };
    case 'Bash':
      return { label: 'Shell', bg: 'rgba(39, 174, 96, 0.08)', color: '#27ae60' };
    case 'Grep': case 'Glob':
      return { label: 'Search', bg: 'rgba(155, 89, 182, 0.08)', color: '#9b59b6' };
    case 'TodoWrite':
      return { label: 'Tasks', bg: 'rgba(52, 152, 219, 0.08)', color: '#3498db' };
    case 'WebSearch': case 'WebFetch':
      return { label: 'Web', bg: 'rgba(230, 126, 34, 0.08)', color: '#e67e22' };
    default:
      return { label: 'Tool', bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' };
  }
}

function guessLang(filePath: string): string | undefined {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const m: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', rb: 'ruby',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', css: 'css', scss: 'scss', html: 'html',
    sh: 'shell', bash: 'shell', zsh: 'shell',
  };
  return ext ? m[ext] : undefined;
}

// ============================================
// Style constants
// ============================================
const S: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: 'var(--bg-primary)', color: 'var(--text-primary)',
  },
  header: {
    padding: 'var(--space-2) var(--space-5)',
    borderBottom: '1px solid var(--border-default)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--bg-secondary)', flexShrink: 0,
  },
  headerLeft: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
  },
  headerTitle: {
    fontWeight: 600, fontSize: 'var(--text-sm)',
  },
  messagesArea: {
    flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-5)',
    display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
  },
  centeredContainer: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 'var(--space-3)', padding: 'var(--space-10)',
    color: 'var(--text-tertiary)',
  },
  emptyTitle: {
    fontSize: 'var(--text-base)', fontWeight: 500, margin: 0,
    color: 'var(--text-secondary)',
  },
  emptySubtitle: {
    fontSize: 'var(--text-sm)', textAlign: 'center', margin: 0,
    maxWidth: '360px', lineHeight: 'var(--leading-relaxed)',
  },
  connectCard: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 'var(--space-5)',
    width: '100%', maxWidth: '440px',
    padding: 'var(--space-6)',
    background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-default)',
    boxShadow: 'var(--shadow-md)',
  },
  connectHeader: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 'var(--space-2)',
    textAlign: 'center',
  },
  connectTitle: {
    fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0,
    color: 'var(--text-primary)',
  },
  connectSubtitle: {
    fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)',
    margin: 0, maxWidth: '320px',
    lineHeight: 'var(--leading-relaxed)',
  },
  formGroup: {
    display: 'flex', flexDirection: 'column',
    gap: 'var(--space-2)', width: '100%',
  },
  formLabel: {
    fontSize: 'var(--text-xs)', fontWeight: 500,
    color: 'var(--text-secondary)',
  },
  formInput: {
    flex: 1, padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-sm)',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  optionTitle: {
    fontSize: 'var(--text-sm)', fontWeight: 500,
    color: 'var(--text-primary)',
  },
  optionDesc: {
    fontSize: '11px', color: 'var(--text-tertiary)',
    marginTop: '2px',
  },
  messageContainer: {
    display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
  },
  toolCallHeader: {
    width: '100%', display: 'flex', alignItems: 'center',
    gap: 'var(--space-2)', padding: '6px var(--space-3)',
    background: 'transparent', border: 'none',
    cursor: 'pointer', textAlign: 'left',
    color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
    fontSize: '12px',
  },
  toolBodyStack: {
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  bashCommand: {
    padding: '6px var(--space-3)',
    background: 'rgba(0,0,0,0.12)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)', fontSize: '12px',
    display: 'flex', alignItems: 'center', gap: '8px',
  },
  searchQuery: {
    padding: '4px var(--space-2)',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '11px', fontFamily: 'var(--font-mono)',
  },
  panelHeader: {
    padding: '6px var(--space-3)',
    background: 'var(--bg-tertiary)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-default)',
  },
  panelHeaderBtn: {
    width: '100%', padding: '6px var(--space-3)',
    background: 'transparent', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    cursor: 'pointer', fontSize: '11px', fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  streamingSection: {
    display: 'flex', flexDirection: 'column',
    gap: 'var(--space-2)',
    animation: 'fadeIn var(--duration-normal) var(--easing-out)',
  },
  thoughtBlock: {
    padding: 'var(--space-2) var(--space-3)',
    fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)',
    color: 'var(--text-tertiary)', fontStyle: 'italic',
    borderLeft: '2px solid var(--border-default)',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  thoughtLabel: {
    fontSize: '10px', fontWeight: 600,
    color: 'var(--text-tertiary)', textTransform: 'uppercase',
    letterSpacing: '0.06em', marginBottom: 'var(--space-1)',
  },
  streamBlock: {
    padding: 'var(--space-3) var(--space-4)',
    borderLeft: '2px solid var(--accent-primary)',
  },
  streamLabel: {
    fontSize: 'var(--text-xs)', fontWeight: 600,
    color: 'var(--accent-primary)',
    marginBottom: 'var(--space-1)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  streamContent: {
    fontSize: 'var(--text-sm)',
    lineHeight: 'var(--leading-relaxed)',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  },
  cursor: {
    display: 'inline-block', width: '6px', height: '16px',
    background: 'var(--accent-primary)', marginLeft: '2px',
    verticalAlign: 'text-bottom',
    animation: 'cursorBlink 1s step-end infinite',
  },
  thinkingIndicator: {
    display: 'flex', alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-4)',
    color: 'var(--text-tertiary)',
    fontSize: 'var(--text-sm)',
  },
  inputArea: {
    padding: 'var(--space-3) var(--space-5)',
    paddingBottom: '80px',
    borderTop: '1px solid var(--border-default)',
    background: 'var(--bg-secondary)', flexShrink: 0,
  },
  inputRow: {
    display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end',
  },
  textarea: {
    flex: 1, resize: 'none',
    padding: 'var(--space-2) var(--space-3)',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-sans)',
    lineHeight: 'var(--leading-normal)',
    minHeight: '40px', maxHeight: '160px',
    outline: 'none',
    transition: 'border-color var(--duration-fast) var(--easing-default)',
  },
  inputHint: {
    marginTop: 'var(--space-1)', fontSize: '11px',
    color: 'var(--text-tertiary)',
    display: 'flex', justifyContent: 'space-between',
  },
  stderrPanel: {
    borderBottom: '1px solid var(--border-default)',
    background: 'var(--bg-tertiary)', maxHeight: '200px',
    display: 'flex', flexDirection: 'column',
  },
  stderrHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '4px var(--space-3)',
    borderBottom: '1px solid var(--border-default)',
  },
  stderrTitle: {
    fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
  },
  stderrClose: {
    background: 'none', border: 'none', color: 'var(--text-tertiary)',
    cursor: 'pointer', fontSize: '16px', padding: '0 4px',
  },
  stderrContent: {
    margin: 0, padding: 'var(--space-2) var(--space-3)',
    fontSize: '10px', lineHeight: '1.4', overflow: 'auto', flex: 1,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
  },
  detailsSummary: {
    fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer',
  },
  detailsPre: {
    margin: '6px 0 0', padding: 'var(--space-2)',
    background: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '11px', lineHeight: '1.4',
    overflow: 'auto', maxHeight: '200px',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    fontFamily: 'var(--font-mono)',
  },
};
