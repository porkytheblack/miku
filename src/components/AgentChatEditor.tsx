'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { isTauri } from '@/lib/tauri';
import {
  AcpClient,
  AcpSessionUpdate,
  AcpPermissionRequest,
  AcpToolCallInfo,
} from '@/lib/acpClient';
import {
  AgentChatMessage,
  AgentChatDocument,
  parseAgentChatDocument,
  serializeAgentChatDocument,
  createAgentChatDocument,
  generateMessageId,
} from '@/lib/agentChat';

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
  const [pendingPermission, setPendingPermission] = useState<AcpPermissionRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stderrLog, setStderrLog] = useState('');
  const [agentName, setAgentName] = useState(doc.agentConfig.agentName || 'Claude Code');
  const [availableModes, setAvailableModes] = useState<Array<{ id: string; name: string }>>([]);
  const [currentMode, setCurrentMode] = useState<string | null>(null);
  const [cwdInput, setCwdInput] = useState(doc.agentConfig.cwd || workspace.currentWorkspace?.path || '');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const clientRef = useRef<AcpClient | null>(null);
  const permissionResolverRef = useRef<((result: { optionId: string } | 'cancelled') => void) | null>(null);

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
      setError('ACP requires the Miku desktop app (Tauri) to connect to Claude Code.');
      return;
    }

    setIsConnecting(true);
    setError(null);
    setStderrLog('');

    try {
      const client = new AcpClient();

      // Session update handler
      client.onSessionUpdate = (update: AcpSessionUpdate) => {
        switch (update.type) {
          case 'agent_message_chunk':
            if (update.text) {
              setStreamingContent(prev => prev + update.text);
            }
            break;

          case 'agent_thought_chunk':
            if (update.text) {
              setStreamingThought(prev => prev + update.text);
            }
            break;

          case 'tool_call':
            if (update.toolCall) {
              setActiveToolCalls(prev => {
                const next = new Map(prev);
                next.set(update.toolCall!.toolCallId, update.toolCall!);
                return next;
              });
            }
            break;

          case 'tool_call_update':
            if (update.toolCall) {
              setActiveToolCalls(prev => {
                const next = new Map(prev);
                const existing = next.get(update.toolCall!.toolCallId);
                next.set(update.toolCall!.toolCallId, { ...existing, ...update.toolCall! });
                return next;
              });
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

      // Permission handler
      client.onPermissionRequest = async (req: AcpPermissionRequest) => {
        return new Promise((resolve) => {
          setPendingPermission(req);
          permissionResolverRef.current = resolve;
        });
      };

      // Error handler
      client.onError = (errMsg: string) => {
        setError(errMsg);
      };

      // Stderr handler (surface process output for debugging)
      client.onStderr = (text: string) => {
        setStderrLog(prev => prev + text);
      };

      // Disconnect handler
      client.onDisconnect = () => {
        setIsConnected(false);
        setIsRunning(false);
      };

      const cwd = cwdInput.trim() || workspace.currentWorkspace?.path || '.';
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
  }, [inTauri, cwdInput, workspace.currentWorkspace?.path]);

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
      const result = await clientRef.current.prompt(text);

      // Build assistant message from accumulated streaming content
      setStreamingContent(prev => {
        setStreamingThought(thought => {
          setActiveToolCalls(toolCalls => {
            const assistantMsg: AgentChatMessage = {
              id: generateMessageId(),
              role: 'assistant',
              content: prev,
              timestamp: new Date().toISOString(),
              toolCalls: toolCalls.size > 0 ? Array.from(toolCalls.values()) : undefined,
            };

            const finalMessages: AgentChatMessage[] = [...newMessages];

            // Add thought message if any
            if (thought) {
              finalMessages.push({
                id: generateMessageId(),
                role: 'thought',
                content: thought,
                timestamp: new Date().toISOString(),
              });
            }

            finalMessages.push(assistantMsg);
            setMessages(finalMessages);
            persistDoc(finalMessages);
            return new Map();
          });
          return '';
        });
        return '';
      });
    } catch (err) {
      if ((err as Error).message !== 'cancelled') {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
      persistDoc(newMessages);
    } finally {
      setIsRunning(false);
      setStreamingContent('');
      setStreamingThought('');
    }
  }, [input, isRunning, messages, persistDoc]);

  const handleCancel = useCallback(async () => {
    await clientRef.current?.cancel();
  }, []);

  const handlePermission = useCallback((optionId: string | null) => {
    if (permissionResolverRef.current) {
      permissionResolverRef.current(optionId ? { optionId } : 'cancelled');
      permissionResolverRef.current = null;
    }
    setPendingPermission(null);
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
          ACP connects to Claude Code running on your device. This feature requires the Miku desktop app (Tauri).
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
            ACP
          </span>
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
            <p style={{ fontSize: '12px' }}>Spawning claude process via ACP</p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} agentName={agentName} />
        ))}

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
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 14px', color: 'var(--text-tertiary)', fontSize: '13px',
          }}>
            <Spinner />
            <span>{agentName} is thinking...</span>
          </div>
        )}

        {/* Permission dialog */}
        {pendingPermission && (
          <PermissionDialog
            request={pendingPermission}
            onSelect={(optionId) => handlePermission(optionId)}
            onCancel={() => handlePermission(null)}
          />
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

  const statusIcon = toolCall.status === 'completed' ? '\u2713'
    : toolCall.status === 'failed' ? '\u2717'
    : toolCall.status === 'in_progress' ? '\u25CB'
    : '\u2026';

  const statusColor = toolCall.status === 'completed' ? 'var(--text-success, #27ae60)'
    : toolCall.status === 'failed' ? 'var(--text-danger, #e74c3c)'
    : 'var(--text-tertiary)';

  const kindLabel = toolCall.kind ? {
    read: 'Read', edit: 'Write', delete: 'Delete', move: 'Move',
    search: 'Search', execute: 'Execute', think: 'Think',
    fetch: 'Fetch', switch_mode: 'Mode', other: 'Tool',
  }[toolCall.kind] || 'Tool' : 'Tool';

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
        <span style={{ color: statusColor, fontWeight: 600, width: '14px' }}>{statusIcon}</span>
        <span style={{
          fontSize: '10px', padding: '1px 5px', background: 'var(--bg-tertiary)',
          borderRadius: '3px', color: 'var(--text-tertiary)', fontWeight: 500,
        }}>
          {kindLabel}
        </span>
        <span style={{ fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {toolCall.title}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border-default)',
          padding: '8px 10px', background: 'var(--bg-primary)',
        }}>
          {toolCall.rawInput != null && (
            <div style={{ marginBottom: toolCall.rawOutput != null ? '8px' : 0 }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Input
              </div>
              <pre style={{
                margin: 0, padding: '6px 8px', background: 'var(--bg-tertiary)',
                borderRadius: '4px', fontSize: '11px', lineHeight: '1.4',
                overflow: 'auto', maxHeight: '200px',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {formatUnknown(toolCall.rawInput)}
              </pre>
            </div>
          )}

          {toolCall.rawOutput != null && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Output
              </div>
              <pre style={{
                margin: 0, padding: '6px 8px', background: 'var(--bg-tertiary)',
                borderRadius: '4px', fontSize: '11px', lineHeight: '1.4',
                overflow: 'auto', maxHeight: '300px',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {formatUnknown(toolCall.rawOutput)}
              </pre>
            </div>
          )}

          {toolCall.content && toolCall.content.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Content
              </div>
              {toolCall.content.map((c, i) => (
                <pre key={i} style={{
                  margin: 0, padding: '6px 8px', background: 'var(--bg-tertiary)',
                  borderRadius: '4px', fontSize: '11px', lineHeight: '1.4',
                  overflow: 'auto', maxHeight: '300px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {JSON.stringify(c, null, 2)}
                </pre>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PermissionDialog({
  request,
  onSelect,
  onCancel,
}: {
  request: AcpPermissionRequest;
  onSelect: (optionId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div style={{
      margin: '8px 0', padding: '12px 14px',
      border: '1px solid rgba(245, 166, 35, 0.4)',
      borderRadius: '8px', background: 'rgba(245, 166, 35, 0.06)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: '8px', fontSize: '13px', fontWeight: 600,
        color: 'var(--text-warning, #f5a623)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Permission Required
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        <strong>{request.toolCall.title}</strong>
        {request.toolCall.rawInput != null && (
          <pre style={{
            margin: '6px 0 0', padding: '6px 8px', background: 'var(--bg-tertiary)',
            borderRadius: '4px', fontSize: '11px',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {formatUnknown(request.toolCall.rawInput)}
          </pre>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {request.options.map((opt) => (
          <button
            key={opt.optionId}
            onClick={() => onSelect(opt.optionId)}
            style={{
              padding: '6px 14px',
              background: opt.kind === 'allow_once' || opt.kind === 'allow_always'
                ? 'var(--text-accent)' : 'transparent',
              border: opt.kind === 'allow_once' || opt.kind === 'allow_always'
                ? 'none' : '1px solid var(--border-default)',
              borderRadius: '6px',
              color: opt.kind === 'allow_once' || opt.kind === 'allow_always'
                ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '13px', fontWeight: 500,
            }}
          >
            {opt.name}
          </button>
        ))}
        <button
          onClick={onCancel}
          style={{
            padding: '6px 14px', background: 'transparent',
            border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: '6px',
            color: '#e74c3c', cursor: 'pointer', fontSize: '13px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
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
