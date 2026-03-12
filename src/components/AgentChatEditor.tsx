'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { isTauri } from '@/lib/tauri';
import {
  AcpClient,
  type AcpSessionUpdate,
  type AcpToolCallInfo,
} from '@/lib/acpClient';
import {
  AgentChatMessage,
  AgentChatDocument,
  parseAgentChatDocument,
  serializeAgentChatDocument,
  createAgentChatDocument,
  generateMessageId,
} from '@/lib/agentChat';

// ============================================
// Task tracking types (from TodoWrite tool)
// ============================================
interface TaskItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

interface AgentChatEditorProps {
  initialContent?: string;
  onContentChange: (content: string) => void;
}

export default function AgentChatEditor({ initialContent, onContentChange }: AgentChatEditorProps) {
  const { workspace } = useWorkspace();

  const [doc, setDoc] = useState<AgentChatDocument>(() => {
    if (initialContent) {
      try {
        return parseAgentChatDocument(initialContent);
      } catch { /* fallthrough */ }
    }
    return createAgentChatDocument(workspace.currentWorkspace?.path);
  });

  const [messages, setMessages] = useState<AgentChatMessage[]>(doc.messages);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThought, setStreamingThought] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<Map<string, AcpToolCallInfo>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [stderrLog, setStderrLog] = useState('');
  const [agentName, setAgentName] = useState(doc.agentConfig.agentName || 'Claude Code');
  const [availableModes, setAvailableModes] = useState<Array<{ id: string; name: string }>>([]);
  const [currentMode, setCurrentMode] = useState<string | null>(null);
  const [cwdInput, setCwdInput] = useState(doc.agentConfig.cwd || workspace.currentWorkspace?.path || '');
  const [permissionMode, setPermissionMode] = useState<'auto-approve' | 'allowed-tools'>('auto-approve');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [fileChanges, setFileChanges] = useState<Map<string, { tool: string; status: string }>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const clientRef = useRef<AcpClient | null>(null);
  // Refs to accumulate streaming data (read at prompt completion)
  const streamContentRef = useRef('');
  const streamThoughtRef = useRef('');
  const streamToolCallsRef = useRef<Map<string, AcpToolCallInfo>>(new Map());

  const inTauri = isTauri();

  // Persist doc
  const persistDoc = useCallback((msgs: AgentChatMessage[]) => {
    const updated: AgentChatDocument = {
      ...doc,
      messages: msgs,
      updatedAt: new Date().toISOString(),
    };
    setDoc(updated);
    onContentChange(serializeAgentChatDocument(updated));
  }, [doc, onContentChange]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streamingThought, activeToolCalls]);

  // Focus input
  useEffect(() => {
    if (isConnected) inputRef.current?.focus();
  }, [isConnected]);

  // Connect to Claude Code
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

      // Session update handler — updates both React state (for UI) and refs (for final message)
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

              // Extract tasks from TodoWrite tool calls
              if (merged.title === 'TodoWrite' && merged.rawInput) {
                const inp = merged.rawInput as { todos?: TaskItem[] };
                if (inp.todos && Array.isArray(inp.todos)) {
                  setTasks(inp.todos);
                }
              }

              // Track file changes from Edit/Write/Read tools
              const toolName = merged.title;
              if (toolName && merged.rawInput) {
                const inp = merged.rawInput as Record<string, unknown>;
                const filePath = (inp.file_path || inp.path || inp.command) as string | undefined;
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

          case 'current_mode_update':
            if (update.currentModeId) {
              setCurrentMode(update.currentModeId);
            }
            break;

          case 'session_info_update':
            // Could update title
            break;
        }
      };

      // Error handler
      client.onError = (errMsg: string) => {
        setError(errMsg);
      };

      // Stderr handler (surface process output for debugging)
      client.onStderr = (text: string) => {
        setStderrLog(prev => prev + text);
      };

      // Log handler (connection diagnostics)
      client.onLog = (msg: string) => {
        setStderrLog(prev => prev + `[log] ${msg}\n`);
      };

      // Disconnect handler
      client.onDisconnect = () => {
        setIsConnected(false);
        setIsRunning(false);
      };

      const cwd = cwdInput.trim() || workspace.currentWorkspace?.path || '.';
      client.permissionMode = permissionMode;
      await client.connect(cwd);

      clientRef.current = client;
      setIsConnected(true);
      setAgentName(client.agentInfo?.name || 'Claude Code');

      if (client.availableModes.length > 0) {
        setAvailableModes(client.availableModes.map(m => ({ id: m.id, name: m.name })));
      }
      if (client.currentModeId) {
        setCurrentMode(client.currentModeId);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to connect';
      setError(errMsg);
    } finally {
      setIsConnecting(false);
    }
  }, [inTauri, cwdInput, permissionMode, workspace.currentWorkspace?.path]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  // Send prompt
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isRunning || !clientRef.current?.connected) return;

    setInput('');
    setError(null);
    setStreamingContent('');
    setStreamingThought('');
    setActiveToolCalls(new Map());
    // Reset accumulation refs
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
      const { resultText } = await clientRef.current.prompt(text);

      // Build final messages from accumulated streaming data (refs)
      const finalMessages: AgentChatMessage[] = [...newMessages];

      // Add thought if any
      if (streamThoughtRef.current) {
        finalMessages.push({
          id: generateMessageId(),
          role: 'thought',
          content: streamThoughtRef.current,
          timestamp: new Date().toISOString(),
        });
      }

      // Use streamed content if available, fall back to resultText
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
  }, [input, isRunning, messages, persistDoc]);

  const handleCancel = useCallback(async () => {
    await clientRef.current?.cancel();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleModeSwitch = useCallback(async (modeId: string) => {
    setCurrentMode(modeId);
    await clientRef.current?.setMode(modeId);
  }, []);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    persistDoc([]);
  }, [persistDoc]);

  // Not in Tauri
  if (!inTauri) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100%', gap: '16px',
        color: 'var(--text-tertiary)', padding: '40px',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p style={{ fontSize: '16px', fontWeight: 500 }}>Agent Chat requires Miku Desktop</p>
        <p style={{ fontSize: '13px', textAlign: 'center' }}>
          Connects to Claude Code running on your device. This feature requires the Miku desktop app (Tauri).
        </p>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--bg-primary)', color: 'var(--text-primary)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px', borderBottom: '1px solid var(--border-default)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-secondary)', flexShrink: 0, gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-accent)" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{agentName}</span>
          <span style={{
            fontSize: '10px', padding: '2px 6px',
            background: isConnected ? 'rgba(39, 174, 96, 0.1)' : 'rgba(231, 76, 60, 0.1)',
            border: `1px solid ${isConnected ? 'rgba(39, 174, 96, 0.3)' : 'rgba(231, 76, 60, 0.3)'}`,
            borderRadius: '6px',
            color: isConnected ? '#27ae60' : '#e74c3c',
            fontWeight: 500,
          }}>
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
          </span>
          <span style={{
            fontSize: '10px', padding: '2px 6px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '6px', color: 'rgb(99, 102, 241)', fontWeight: 500,
          }}>
            CLI
          </span>
          {isConnected && (
            <span style={{
              fontSize: '10px', padding: '2px 6px',
              background: permissionMode === 'auto-approve' ? 'rgba(245, 166, 35, 0.1)' : 'rgba(39, 174, 96, 0.1)',
              border: `1px solid ${permissionMode === 'auto-approve' ? 'rgba(245, 166, 35, 0.3)' : 'rgba(39, 174, 96, 0.3)'}`,
              borderRadius: '6px',
              color: permissionMode === 'auto-approve' ? '#f5a623' : '#27ae60',
              fontWeight: 500,
            }}>
              {permissionMode === 'auto-approve' ? 'Auto-approve' : 'Default perms'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {availableModes.length > 1 && (
            <select
              value={currentMode || ''}
              onChange={(e) => handleModeSwitch(e.target.value)}
              style={{
                padding: '4px 8px', fontSize: '12px',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)',
                borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none',
              }}
            >
              {availableModes.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          {!isConnected && !isConnecting && (
            <button onClick={handleConnect} style={{
              padding: '4px 10px', fontSize: '12px', background: 'var(--text-accent)',
              border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer',
            }}>
              Reconnect
            </button>
          )}
          {messages.length > 0 && (
            <button onClick={handleClearChat} disabled={isRunning} style={{
              padding: '4px 10px', fontSize: '12px', background: 'transparent',
              border: '1px solid var(--border-default)', borderRadius: '6px',
              color: 'var(--text-secondary)', cursor: isRunning ? 'default' : 'pointer',
              opacity: isRunning ? 0.5 : 1,
            }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
        display: 'flex', flexDirection: 'column', gap: '2px',
      }}>
        {/* Not connected - show connect prompt */}
        {messages.length === 0 && !isConnected && !isConnecting && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '16px', color: 'var(--text-tertiary)',
            padding: '40px',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>Claude Code Agent</p>
            <p style={{ fontSize: '13px', textAlign: 'center', maxWidth: '360px' }}>
              Connect to Claude Code running on your device. Uses your existing Claude Code login - no separate authentication needed.
            </p>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '6px',
              width: '100%', maxWidth: '420px',
            }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Working directory
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={cwdInput}
                  onChange={(e) => setCwdInput(e.target.value)}
                  placeholder="/path/to/project"
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: '13px',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
                    borderRadius: '8px', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)', outline: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--border-active, var(--text-accent))'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                />
                {inTauri && (
                  <button
                    onClick={async () => {
                      try {
                        const { open } = await import('@tauri-apps/plugin-dialog');
                        const selected = await open({ directory: true, title: 'Select working directory' });
                        if (selected) setCwdInput(selected as string);
                      } catch { /* user cancelled */ }
                    }}
                    style={{
                      padding: '8px 12px', background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-default)', borderRadius: '8px',
                      color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px',
                      flexShrink: 0,
                    }}
                    title="Browse..."
                  >
                    Browse
                  </button>
                )}
              </div>
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '6px',
              width: '100%', maxWidth: '420px',
            }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                Tool permissions
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setPermissionMode('auto-approve')}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: '13px',
                    background: permissionMode === 'auto-approve' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-primary)',
                    border: `1px solid ${permissionMode === 'auto-approve' ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-default)'}`,
                    borderRadius: '8px',
                    color: permissionMode === 'auto-approve' ? 'rgb(99, 102, 241)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: permissionMode === 'auto-approve' ? 600 : 400,
                  }}
                >
                  Auto-approve all
                </button>
                <button
                  onClick={() => setPermissionMode('allowed-tools')}
                  style={{
                    flex: 1, padding: '8px 12px', fontSize: '13px',
                    background: permissionMode === 'allowed-tools' ? 'rgba(245, 166, 35, 0.12)' : 'var(--bg-primary)',
                    border: `1px solid ${permissionMode === 'allowed-tools' ? 'rgba(245, 166, 35, 0.4)' : 'var(--border-default)'}`,
                    borderRadius: '8px',
                    color: permissionMode === 'allowed-tools' ? 'rgb(245, 166, 35)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: permissionMode === 'allowed-tools' ? 600 : 400,
                  }}
                >
                  Default permissions
                </button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>
                {permissionMode === 'auto-approve'
                  ? 'All tool calls (file edits, commands, etc.) will be auto-approved.'
                  : 'Uses Claude Code\'s default permission settings from your config.'}
              </p>
            </div>
            <button onClick={handleConnect} disabled={!cwdInput.trim()} style={{
              padding: '10px 24px', fontSize: '14px', fontWeight: 500,
              background: cwdInput.trim() ? 'var(--text-accent)' : 'var(--bg-tertiary)',
              border: 'none', borderRadius: '8px',
              color: cwdInput.trim() ? 'white' : 'var(--text-tertiary)',
              cursor: cwdInput.trim() ? 'pointer' : 'default',
            }}>
              Connect to Claude Code
            </button>
            {error && (
              <div style={{
                marginTop: '8px', padding: '10px 14px', maxWidth: '480px',
                background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.2)',
                borderRadius: '8px', color: '#e74c3c', fontSize: '13px',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {error}
              </div>
            )}
            {stderrLog && (
              <details style={{ marginTop: '4px', maxWidth: '480px', width: '100%' }}>
                <summary style={{ fontSize: '12px', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                  Process output
                </summary>
                <pre style={{
                  margin: '6px 0 0', padding: '8px', background: 'var(--bg-tertiary)',
                  borderRadius: '6px', fontSize: '11px', lineHeight: '1.4',
                  overflow: 'auto', maxHeight: '200px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {stderrLog}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Connected empty state */}
        {messages.length === 0 && !isRunning && isConnected && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '12px', color: 'var(--text-tertiary)',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>Connected to {agentName}</p>
            <p style={{ fontSize: '13px' }}>Type a message below to start working.</p>
          </div>
        )}

        {/* Connecting state */}
        {isConnecting && messages.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '12px', color: 'var(--text-tertiary)',
          }}>
            <Spinner size={24} />
            <p style={{ fontSize: '14px' }}>Connecting to Claude Code...</p>
            <p style={{ fontSize: '12px' }}>Verifying Claude Code installation...</p>
            {stderrLog && (
              <pre style={{
                marginTop: '8px', padding: '8px 12px', background: 'var(--bg-tertiary)',
                borderRadius: '6px', fontSize: '11px', lineHeight: '1.4',
                overflow: 'auto', maxHeight: '200px', maxWidth: '480px', width: '100%',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                color: 'var(--text-tertiary)',
              }}>
                {stderrLog}
              </pre>
            )}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} agentName={agentName} />
        ))}

        {/* Task panel (sticky) */}
        {tasks.length > 0 && (
          <div style={{ margin: '8px 0' }}>
            <TaskList tasks={tasks} />
          </div>
        )}

        {/* File changes summary */}
        {fileChanges.size > 0 && (
          <FileChangesSummary changes={fileChanges} />
        )}

        {/* Active tool calls */}
        {activeToolCalls.size > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {Array.from(activeToolCalls.values()).map((tc) => (
              <ToolCallBlock key={tc.toolCallId} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Streaming thought */}
        {streamingThought && (
          <div style={{
            padding: '8px 14px', fontSize: '13px', lineHeight: '1.5',
            color: 'var(--text-tertiary)', fontStyle: 'italic',
            borderLeft: '2px solid var(--border-default)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {streamingThought}
          </div>
        )}

        {/* Streaming content */}
        {streamingContent && (
          <div style={{
            padding: '10px 14px', fontSize: '14px', lineHeight: '1.6',
            borderLeft: '2px solid var(--text-accent)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 600, color: 'var(--text-accent)',
              marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em',
            }}>
              {agentName}
            </div>
            {streamingContent}
            <span style={{
              display: 'inline-block', width: '6px', height: '16px',
              background: 'var(--text-accent)', marginLeft: '2px',
              verticalAlign: 'text-bottom', animation: 'cursorBlink 1s step-end infinite',
            }} />
          </div>
        )}

        {/* Thinking indicator */}
        {isRunning && !streamingContent && activeToolCalls.size === 0 && !streamingThought && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '8px',
            padding: '10px 14px', color: 'var(--text-tertiary)', fontSize: '13px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Spinner />
              <span>{agentName} is thinking...</span>
            </div>
            {stderrLog && (
              <details style={{ marginTop: '2px' }}>
                <summary style={{ fontSize: '11px', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  Process output
                </summary>
                <pre style={{
                  margin: '4px 0 0', padding: '6px 8px', background: 'var(--bg-tertiary)',
                  borderRadius: '4px', fontSize: '10px', lineHeight: '1.4',
                  overflow: 'auto', maxHeight: '150px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {stderrLog}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            margin: '8px 0', padding: '10px 14px',
            background: 'rgba(231, 76, 60, 0.08)', border: '1px solid rgba(231, 76, 60, 0.2)',
            borderRadius: '8px', color: '#e74c3c', fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 20px 80px', borderTop: '1px solid var(--border-default)',
        background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? `Message ${agentName}...` : 'Waiting for connection...'}
            disabled={!isConnected || isRunning}
            rows={1}
            style={{
              flex: 1, resize: 'none', padding: '10px 14px',
              background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
              borderRadius: '10px', color: 'var(--text-primary)',
              fontSize: '14px', fontFamily: 'var(--font-sans)',
              lineHeight: '1.5', minHeight: '42px', maxHeight: '160px',
              outline: 'none', transition: 'border-color 0.15s ease',
            }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 160) + 'px';
            }}
            onFocus={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = 'var(--border-active, var(--text-accent))';
            }}
            onBlur={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = 'var(--border-default)';
            }}
          />
          {isRunning ? (
            <button onClick={handleCancel} style={{
              padding: '10px 16px', background: 'rgba(231, 76, 60, 0.08)',
              border: '1px solid rgba(231, 76, 60, 0.2)', borderRadius: '10px',
              color: '#e74c3c', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              Stop
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim() || !isConnected} style={{
              padding: '10px 16px',
              background: input.trim() && isConnected ? 'var(--text-accent)' : 'var(--bg-tertiary)',
              border: 'none', borderRadius: '10px',
              color: input.trim() && isConnected ? 'white' : 'var(--text-tertiary)',
              cursor: input.trim() && isConnected ? 'pointer' : 'default',
              fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}>
              Send
            </button>
          )}
        </div>
        <div style={{
          marginTop: '6px', fontSize: '11px', color: 'var(--text-tertiary)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Enter to send, Shift+Enter for new line</span>
          <span>{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function ChatMessage({ message, agentName }: { message: AgentChatMessage; agentName: string }) {
  const isUser = message.role === 'user';
  const isThought = message.role === 'thought';

  if (isThought) {
    return (
      <div style={{
        padding: '8px 14px', fontSize: '13px', lineHeight: '1.5',
        color: 'var(--text-tertiary)', fontStyle: 'italic',
        borderLeft: '2px solid var(--border-default)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {message.content}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {message.toolCalls?.map((tc) => (
        <ToolCallBlock key={tc.toolCallId} toolCall={tc} />
      ))}

      {message.content && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px',
          background: isUser ? 'var(--bg-tertiary)' : 'transparent',
          borderLeft: isUser ? 'none' : '2px solid var(--text-accent)',
          fontSize: '14px', lineHeight: '1.6',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          <div style={{
            fontSize: '11px', fontWeight: 600,
            color: isUser ? 'var(--text-secondary)' : 'var(--text-accent)',
            marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em',
          }}>
            {isUser ? 'You' : agentName}
          </div>
          {message.content}
        </div>
      )}
    </div>
  );
}

function ToolCallBlock({ toolCall }: { toolCall: AcpToolCallInfo }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = toolCall.title || '';
  const input = toolCall.rawInput as Record<string, unknown> | undefined;

  const statusIcon = toolCall.status === 'completed' ? '\u2713'
    : toolCall.status === 'failed' ? '\u2717'
    : toolCall.status === 'in_progress' ? '\u25CB'
    : '\u2026';

  const statusColor = toolCall.status === 'completed' ? 'var(--text-success, #27ae60)'
    : toolCall.status === 'failed' ? 'var(--text-danger, #e74c3c)'
    : 'var(--text-tertiary)';

  // Derive a human-readable summary line
  const summary = getToolSummary(toolName, input);
  // Tool category badge
  const badge = getToolBadge(toolName);

  // Auto-expand in-progress tool calls (except TodoWrite)
  const shouldAutoExpand = toolCall.status === 'in_progress' && toolName !== 'TodoWrite';

  return (
    <div style={{
      margin: '4px 0', border: '1px solid var(--border-default)',
      borderRadius: '6px', overflow: 'hidden', fontSize: '13px',
      background: 'var(--bg-secondary)',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '6px 10px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)', fontSize: '12px',
        }}
      >
        <span style={{ color: statusColor, fontWeight: 600, width: '14px', flexShrink: 0 }}>
          {toolCall.status === 'in_progress' ? <MiniSpinner /> : statusIcon}
        </span>
        <span style={{
          fontSize: '10px', padding: '1px 5px',
          background: badge.bg, borderRadius: '3px',
          color: badge.color, fontWeight: 500, flexShrink: 0,
        }}>
          {badge.label}
        </span>
        <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {summary}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', flexShrink: 0 }}>
          {expanded || shouldAutoExpand ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {(expanded || shouldAutoExpand) && (
        <div style={{
          borderTop: '1px solid var(--border-default)',
          padding: '8px 10px', background: 'var(--bg-primary)',
        }}>
          {/* Render tool-specific rich views */}
          <ToolCallBody toolCall={toolCall} />
        </div>
      )}
    </div>
  );
}

/** Rich body rendering for different tool types */
function ToolCallBody({ toolCall }: { toolCall: AcpToolCallInfo }) {
  const toolName = toolCall.title || '';
  const input = toolCall.rawInput as Record<string, unknown> | undefined;
  const output = toolCall.rawOutput;

  // Edit tool: show file path, old_string -> new_string diff
  if (toolName === 'Edit' && input) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <FilePathLabel path={input.file_path as string} />
        {input.old_string != null && (
          <DiffView
            oldStr={String(input.old_string)}
            newStr={String(input.new_string || '')}
          />
        )}
        {output != null && <ToolOutput output={output} />}
      </div>
    );
  }

  // Write tool: show file path and content
  if (toolName === 'Write' && input) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <FilePathLabel path={input.file_path as string} />
        {input.content != null && (
          <CodeBlock
            label="Content"
            code={String(input.content)}
            maxHeight={300}
            language={guessLanguage(String(input.file_path || ''))}
          />
        )}
        {output != null && <ToolOutput output={output} />}
      </div>
    );
  }

  // Read tool: show file path and output content
  if (toolName === 'Read' && input) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <FilePathLabel path={input.file_path as string} />
        {output != null && (
          <CodeBlock
            label="File content"
            code={extractTextOutput(output)}
            maxHeight={400}
            language={guessLanguage(String(input.file_path || ''))}
          />
        )}
      </div>
    );
  }

  // Bash tool: show command and output
  if (toolName === 'Bash' && input) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{
          padding: '6px 10px', background: 'rgba(0,0,0,0.15)',
          borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '12px',
          color: '#4ade80', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ color: 'var(--text-tertiary)', userSelect: 'none' }}>$</span>
          <span>{String(input.command || '')}</span>
        </div>
        {input.description && (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            {String(input.description)}
          </div>
        )}
        {output != null && (
          <CodeBlock label="Output" code={extractTextOutput(output)} maxHeight={300} />
        )}
      </div>
    );
  }

  // Grep/Glob search tools
  if ((toolName === 'Grep' || toolName === 'Glob') && input) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{
          padding: '4px 8px', background: 'var(--bg-tertiary)',
          borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)',
        }}>
          {toolName === 'Grep' ? `grep "${input.pattern || ''}"` : `glob "${input.pattern || ''}"`}
          {input.path ? ` in ${input.path}` : ''}
        </div>
        {output != null && (
          <CodeBlock label="Results" code={extractTextOutput(output)} maxHeight={300} />
        )}
      </div>
    );
  }

  // TodoWrite: show task list
  if (toolName === 'TodoWrite' && input) {
    const todos = (input.todos || []) as TaskItem[];
    return <TaskList tasks={todos} />;
  }

  // WebSearch / WebFetch
  if ((toolName === 'WebSearch' || toolName === 'WebFetch') && input) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{
          padding: '4px 8px', background: 'var(--bg-tertiary)',
          borderRadius: '4px', fontSize: '11px',
        }}>
          {toolName === 'WebSearch' ? `Search: "${input.query || ''}"` : `Fetch: ${input.url || ''}`}
        </div>
        {output != null && (
          <CodeBlock label="Result" code={extractTextOutput(output)} maxHeight={300} />
        )}
      </div>
    );
  }

  // Generic fallback
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {input != null && (
        <CodeBlock label="Input" code={formatUnknown(input)} maxHeight={200} />
      )}
      {output != null && (
        <CodeBlock label="Output" code={extractTextOutput(output)} maxHeight={300} />
      )}
    </div>
  );
}

/** Inline diff view for Edit tool */
function DiffView({ oldStr, newStr }: { oldStr: string; newStr: string }) {
  const oldLines = oldStr.split('\n');
  const newLines = newStr.split('\n');

  return (
    <div style={{
      borderRadius: '4px', overflow: 'hidden',
      border: '1px solid var(--border-default)', fontSize: '11px',
      fontFamily: 'var(--font-mono)', lineHeight: '1.5',
    }}>
      <div style={{
        padding: '4px 8px', background: 'var(--bg-tertiary)',
        fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', borderBottom: '1px solid var(--border-default)',
      }}>
        Changes
      </div>
      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
        {oldLines.map((line, i) => (
          <div key={`old-${i}`} style={{
            padding: '1px 8px', background: 'rgba(231, 76, 60, 0.08)',
            color: '#e74c3c', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            <span style={{ userSelect: 'none', color: 'rgba(231, 76, 60, 0.5)', marginRight: '8px' }}>-</span>
            {line}
          </div>
        ))}
        {newLines.map((line, i) => (
          <div key={`new-${i}`} style={{
            padding: '1px 8px', background: 'rgba(39, 174, 96, 0.08)',
            color: '#27ae60', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            <span style={{ userSelect: 'none', color: 'rgba(39, 174, 96, 0.5)', marginRight: '8px' }}>+</span>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

/** File path label with icon */
function FilePathLabel({ path }: { path?: string }) {
  if (!path) return null;
  const fileName = path.split('/').pop() || path;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', fontFamily: 'var(--font-mono)',
      color: 'var(--text-secondary)',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <span title={path} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {fileName}
      </span>
      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
        {path !== fileName ? path : ''}
      </span>
    </div>
  );
}

/** Reusable code block */
function CodeBlock({ label, code, maxHeight = 200, language }: {
  label?: string; code: string; maxHeight?: number; language?: string;
}) {
  return (
    <div>
      {label && (
        <div style={{
          fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)',
          marginBottom: '4px', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          {label}
          {language && (
            <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', opacity: 0.6, textTransform: 'lowercase' }}>
              {language}
            </span>
          )}
        </div>
      )}
      <pre style={{
        margin: 0, padding: '6px 8px', background: 'var(--bg-tertiary)',
        borderRadius: '4px', fontSize: '11px', lineHeight: '1.4',
        overflow: 'auto', maxHeight,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: 'var(--font-mono)',
      }}>
        {code}
      </pre>
    </div>
  );
}

/** Task list display (from TodoWrite) */
function TaskList({ tasks }: { tasks: TaskItem[] }) {
  if (!tasks.length) return null;

  const completed = tasks.filter(t => t.status === 'completed').length;
  const total = tasks.length;

  return (
    <div style={{
      borderRadius: '6px', border: '1px solid var(--border-default)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '6px 10px', background: 'var(--bg-tertiary)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <span>Tasks</span>
        <span style={{ color: 'var(--text-tertiary)' }}>{completed}/{total} done</span>
      </div>
      {/* Progress bar */}
      <div style={{
        height: '2px', background: 'var(--bg-tertiary)',
      }}>
        <div style={{
          height: '100%', width: `${total > 0 ? (completed / total) * 100 : 0}%`,
          background: '#27ae60', transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ padding: '4px 0' }}>
        {tasks.map((task, i) => (
          <div key={i} style={{
            padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '12px',
            opacity: task.status === 'completed' ? 0.6 : 1,
          }}>
            <span style={{
              width: '16px', height: '16px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '3px', fontSize: '10px',
              border: task.status === 'completed'
                ? '1px solid #27ae60'
                : task.status === 'in_progress'
                ? '1px solid var(--text-accent)'
                : '1px solid var(--border-default)',
              background: task.status === 'completed'
                ? 'rgba(39,174,96,0.15)'
                : task.status === 'in_progress'
                ? 'rgba(99,102,241,0.1)'
                : 'transparent',
              color: task.status === 'completed' ? '#27ae60' : task.status === 'in_progress' ? 'var(--text-accent)' : 'var(--text-tertiary)',
            }}>
              {task.status === 'completed' ? '\u2713' : task.status === 'in_progress' ? '\u25B6' : '\u25CB'}
            </span>
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

/** Tool output helper */
function ToolOutput({ output }: { output: unknown }) {
  const text = extractTextOutput(output);
  if (!text) return null;
  return <CodeBlock label="Output" code={text} maxHeight={200} />;
}

/** File changes summary panel */
function FileChangesSummary({ changes }: { changes: Map<string, { tool: string; status: string }> }) {
  const [expanded, setExpanded] = useState(true);
  const entries = Array.from(changes.entries());

  const editCount = entries.filter(([, v]) => v.tool === 'Edit' || v.tool === 'Write').length;
  const readCount = entries.filter(([, v]) => v.tool === 'Read').length;

  return (
    <div style={{
      margin: '8px 0', borderRadius: '6px',
      border: '1px solid var(--border-default)', overflow: 'hidden',
      background: 'var(--bg-secondary)',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', padding: '6px 10px', background: 'transparent',
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Files touched
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
          {editCount > 0 && <span style={{ color: '#f5a623' }}>{editCount} edited</span>}
          {editCount > 0 && readCount > 0 && ' \u00B7 '}
          {readCount > 0 && <span>{readCount} read</span>}
        </span>
      </button>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border-default)', padding: '4px 0',
        }}>
          {entries.map(([path, info]) => {
            const fileName = path.split('/').pop() || path;
            const isEdit = info.tool === 'Edit' || info.tool === 'Write';
            return (
              <div key={path} style={{
                padding: '3px 10px', display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '11px', fontFamily: 'var(--font-mono)',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: isEdit ? '#f5a623' : 'rgb(99, 102, 241)',
                }} />
                <span style={{
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: 'var(--text-secondary)',
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

function formatUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

/** Extract text from tool output (handles various formats from Claude CLI) */
function extractTextOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    return output
      .map(block => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object') {
          if ('text' in block) return String(block.text);
          if ('content' in block) return String(block.content);
        }
        return JSON.stringify(block, null, 2);
      })
      .join('\n');
  }
  if (output && typeof output === 'object') {
    const obj = output as Record<string, unknown>;
    if ('text' in obj) return String(obj.text);
    if ('content' in obj) return String(obj.content);
  }
  return JSON.stringify(output, null, 2);
}

/** Get a human-readable summary for a tool call */
function getToolSummary(toolName: string, input?: Record<string, unknown>): string {
  if (!input) return toolName;

  switch (toolName) {
    case 'Edit': {
      const fp = input.file_path as string;
      return fp ? `Edit ${fp.split('/').pop()}` : 'Edit file';
    }
    case 'Write': {
      const fp = input.file_path as string;
      return fp ? `Write ${fp.split('/').pop()}` : 'Write file';
    }
    case 'Read': {
      const fp = input.file_path as string;
      return fp ? `Read ${fp.split('/').pop()}` : 'Read file';
    }
    case 'Bash': {
      const cmd = String(input.command || '').slice(0, 60);
      return cmd ? `$ ${cmd}${String(input.command || '').length > 60 ? '...' : ''}` : 'Run command';
    }
    case 'Grep':
      return `Search for "${input.pattern || ''}"`;
    case 'Glob':
      return `Find files "${input.pattern || ''}"`;
    case 'TodoWrite':
      return 'Update tasks';
    case 'WebSearch':
      return `Search "${input.query || ''}"`;
    case 'WebFetch':
      return `Fetch ${input.url || ''}`;
    case 'NotebookEdit':
      return 'Edit notebook';
    default:
      return toolName;
  }
}

/** Get badge styling for tool category */
function getToolBadge(toolName: string): { label: string; bg: string; color: string } {
  switch (toolName) {
    case 'Edit':
    case 'Write':
    case 'NotebookEdit':
      return { label: 'Edit', bg: 'rgba(245, 166, 35, 0.12)', color: '#f5a623' };
    case 'Read':
      return { label: 'Read', bg: 'rgba(99, 102, 241, 0.1)', color: 'rgb(99, 102, 241)' };
    case 'Bash':
      return { label: 'Shell', bg: 'rgba(39, 174, 96, 0.1)', color: '#27ae60' };
    case 'Grep':
    case 'Glob':
      return { label: 'Search', bg: 'rgba(155, 89, 182, 0.1)', color: '#9b59b6' };
    case 'TodoWrite':
      return { label: 'Tasks', bg: 'rgba(52, 152, 219, 0.1)', color: '#3498db' };
    case 'WebSearch':
    case 'WebFetch':
      return { label: 'Web', bg: 'rgba(230, 126, 34, 0.1)', color: '#e67e22' };
    default:
      return { label: 'Tool', bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' };
  }
}

/** Guess language from file extension */
function guessLanguage(filePath: string): string | undefined {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', rb: 'ruby',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', css: 'css', scss: 'scss', html: 'html',
    sh: 'shell', bash: 'shell', zsh: 'shell',
  };
  return ext ? map[ext] : undefined;
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: '2px solid var(--border-default)',
      borderTopColor: 'var(--text-accent)',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  );
}

function MiniSpinner() {
  return (
    <span style={{
      display: 'inline-block', width: 12, height: 12,
      border: '1.5px solid var(--border-default)',
      borderTopColor: 'var(--text-accent)',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    }} />
  );
}
