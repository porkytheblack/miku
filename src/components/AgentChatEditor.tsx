'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAIConfig } from '@/context/AIConfigContext';
import {
  AgentChatMessage,
  AgentChatDocument,
  AgentChatConfig,
  AgentChatService,
  AgentToolCall,
  SessionUpdate,
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
  const { config: aiConfig, getApiKeys } = useAIConfig();

  const [doc, setDoc] = useState<AgentChatDocument>(() => {
    if (initialContent) {
      try {
        return parseAgentChatDocument(initialContent);
      } catch { /* fallthrough */ }
    }
    const keys = getApiKeys();
    const defaultConfig: AgentChatConfig = {
      providerType: aiConfig?.provider || 'anthropic',
      model: aiConfig?.model || 'claude-sonnet-4-5-20250514',
      apiKey: aiConfig?.apiKey || keys[aiConfig?.provider || 'anthropic'] || '',
      baseUrl: aiConfig?.baseUrl,
      systemPrompt: 'You are a helpful AI coding assistant. You can read files, write files, search, and run commands to help the user.',
      agentName: 'Agent',
      permissions: { allowFileRead: true, allowFileWrite: true, allowTerminal: true },
    };
    return createAgentChatDocument(defaultConfig);
  });

  const [messages, setMessages] = useState<AgentChatMessage[]>(doc.messages);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<AgentToolCall[]>([]);
  const [pendingPermission, setPendingPermission] = useState<AgentToolCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<string | undefined>(doc.currentMode);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const serviceRef = useRef<AgentChatService | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const permissionResolverRef = useRef<((allowed: boolean) => void) | null>(null);

  // Create service
  useMemo(() => {
    try {
      const svc = new AgentChatService(doc.agentConfig);
      svc.loadHistory(messages);

      // Set permission resolver
      svc.setPermissionResolver(async (toolCall: AgentToolCall) => {
        return new Promise<boolean>((resolve) => {
          setPendingPermission(toolCall);
          permissionResolverRef.current = resolve;
        });
      });

      serviceRef.current = svc;
      return svc;
    } catch (e) {
      setError(`Failed to create agent: ${e instanceof Error ? e.message : 'Unknown error'}`);
      return null;
    }
  }, [doc.agentConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist
  const persistDoc = useCallback((msgs: AgentChatMessage[], mode?: string) => {
    const updated: AgentChatDocument = {
      ...doc,
      messages: msgs,
      currentMode: mode ?? currentMode,
      updatedAt: new Date().toISOString(),
    };
    setDoc(updated);
    onContentChange(serializeAgentChatDocument(updated));
  }, [doc, currentMode, onContentChange]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, activeToolCalls]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isRunning || !serviceRef.current) return;

    setInput('');
    setError(null);
    setStreamingContent('');
    setActiveToolCalls([]);

    const userMsg: AgentChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsRunning(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const stream = serviceRef.current.runPrompt(text, abortController.signal);
      let accumulatedContent = '';
      const toolCalls: AgentToolCall[] = [];

      for await (const update of stream) {
        if (abortController.signal.aborted) break;

        switch (update.type) {
          case 'message_chunk':
            accumulatedContent += update.content;
            setStreamingContent(accumulatedContent);
            break;

          case 'tool_call':
            toolCalls.push(update.toolCall);
            setActiveToolCalls([...toolCalls]);
            break;

          case 'tool_result': {
            const idx = toolCalls.findIndex(tc => tc.id === update.toolCallId);
            if (idx >= 0) {
              toolCalls[idx] = { ...toolCalls[idx], status: update.status, result: update.result };
              setActiveToolCalls([...toolCalls]);
            }
            break;
          }

          case 'permission_request':
            // Permission is handled by the resolver set on the service
            break;

          case 'error':
            setError(update.message);
            break;

          case 'done': {
            const finalMessages = [...newMessages, update.message];
            setMessages(finalMessages);
            persistDoc(finalMessages);
            break;
          }
        }
      }
    } catch (e) {
      if (!abortController.signal.aborted) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
      persistDoc(newMessages);
    } finally {
      setIsRunning(false);
      setStreamingContent('');
      setActiveToolCalls([]);
      abortControllerRef.current = null;
    }
  }, [input, isRunning, messages, persistDoc]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handlePermission = useCallback((allowed: boolean) => {
    if (permissionResolverRef.current) {
      permissionResolverRef.current(allowed);
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

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    const cleared: AgentChatDocument = {
      ...doc,
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    setDoc(cleared);
    onContentChange(serializeAgentChatDocument(cleared));
    serviceRef.current?.loadHistory([]);
  }, [doc, onContentChange]);

  const handleModeSwitch = useCallback((modeId: string) => {
    setCurrentMode(modeId);
    persistDoc(messages, modeId);
  }, [messages, persistDoc]);

  const agentName = doc.agentConfig.agentName || 'Agent';
  const hasApiKey = doc.agentConfig.apiKey.length > 0 ||
    doc.agentConfig.providerType === 'ollama' ||
    doc.agentConfig.providerType === 'lmstudio';
  const modes = doc.agentConfig.modes;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-accent)" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{agentName}</span>
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-default)',
            borderRadius: '10px',
            color: 'var(--text-tertiary)',
          }}>
            {doc.agentConfig.model}
          </span>
          <span style={{
            fontSize: '10px',
            padding: '2px 6px',
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '6px',
            color: 'rgb(99, 102, 241)',
            fontWeight: 500,
          }}>
            ACP
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mode selector */}
          {modes && modes.length > 1 && (
            <select
              value={currentMode || ''}
              onChange={(e) => handleModeSwitch(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {modes.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              disabled={isRunning}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                background: 'transparent',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                cursor: isRunning ? 'default' : 'pointer',
                opacity: isRunning ? 0.5 : 1,
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {/* Empty state */}
        {messages.length === 0 && !isRunning && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            color: 'var(--text-tertiary)',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p style={{ fontSize: '16px', fontWeight: 500 }}>Start a conversation with {agentName}</p>
            {!hasApiKey && (
              <p style={{ fontSize: '13px', color: 'var(--text-danger, #e74c3c)' }}>
                No API key configured. Set one in Settings or your .miku config file.
              </p>
            )}
            <div style={{ fontSize: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {doc.agentConfig.permissions?.allowFileRead && <CapabilityBadge label="Read Files" />}
              {doc.agentConfig.permissions?.allowFileWrite && <CapabilityBadge label="Write Files" />}
              {doc.agentConfig.permissions?.allowTerminal && <CapabilityBadge label="Terminal" />}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} agentName={agentName} />
        ))}

        {/* Active streaming + tool calls */}
        {isRunning && (streamingContent || activeToolCalls.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Tool calls shown inline */}
            {activeToolCalls.map((tc) => (
              <ToolCallBlock key={tc.id} toolCall={tc} />
            ))}
            {/* Streaming text */}
            {streamingContent && (
              <div style={{
                padding: '10px 14px',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {streamingContent}
                <span style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '16px',
                  background: 'var(--text-accent)',
                  marginLeft: '2px',
                  verticalAlign: 'text-bottom',
                  animation: 'cursorBlink 1s step-end infinite',
                }} />
              </div>
            )}
          </div>
        )}

        {/* Thinking indicator */}
        {isRunning && !streamingContent && activeToolCalls.length === 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            color: 'var(--text-tertiary)',
            fontSize: '13px',
          }}>
            <Spinner />
            <span>{agentName} is thinking...</span>
          </div>
        )}

        {/* Permission dialog */}
        {pendingPermission && (
          <PermissionDialog
            toolCall={pendingPermission}
            onAllow={() => handlePermission(true)}
            onDeny={() => handlePermission(false)}
          />
        )}

        {/* Error */}
        {error && (
          <div style={{
            margin: '8px 0',
            padding: '10px 14px',
            background: 'rgba(231, 76, 60, 0.08)',
            border: '1px solid rgba(231, 76, 60, 0.2)',
            borderRadius: '8px',
            color: 'var(--text-danger, #e74c3c)',
            fontSize: '13px',
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '12px 20px 16px',
        borderTop: '1px solid var(--border-default)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? `Message ${agentName}...` : 'Configure an API key first...'}
            disabled={!hasApiKey || isRunning}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              fontFamily: 'var(--font-sans)',
              lineHeight: '1.5',
              minHeight: '42px',
              maxHeight: '160px',
              outline: 'none',
              transition: 'border-color 0.15s ease',
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
            <button
              onClick={handleStop}
              style={{
                padding: '10px 16px',
                background: 'rgba(231, 76, 60, 0.08)',
                border: '1px solid rgba(231, 76, 60, 0.2)',
                borderRadius: '10px',
                color: '#e74c3c',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !hasApiKey}
              style={{
                padding: '10px 16px',
                background: input.trim() && hasApiKey ? 'var(--text-accent)' : 'var(--bg-tertiary)',
                border: 'none',
                borderRadius: '10px',
                color: input.trim() && hasApiKey ? 'white' : 'var(--text-tertiary)',
                cursor: input.trim() && hasApiKey ? 'pointer' : 'default',
                fontSize: '14px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              Send
            </button>
          )}
        </div>
        <div style={{
          marginTop: '6px',
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Enter to send, Shift+Enter for new line</span>
          <span>{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes cursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function ChatMessage({ message, agentName }: { message: AgentChatMessage; agentName: string }) {
  const isUser = message.role === 'user';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {/* Tool calls (shown before assistant text) */}
      {message.toolCalls?.map((tc) => (
        <ToolCallBlock key={tc.id} toolCall={tc} />
      ))}

      {/* Message content */}
      {message.content && (
        <div style={{
          padding: isUser ? '10px 14px' : '10px 14px',
          borderRadius: '8px',
          background: isUser ? 'var(--bg-tertiary)' : 'transparent',
          borderLeft: isUser ? 'none' : '2px solid var(--text-accent)',
          fontSize: '14px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: isUser ? 'var(--text-secondary)' : 'var(--text-accent)',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}>
            {isUser ? 'You' : agentName}
          </div>
          {message.content}
        </div>
      )}
    </div>
  );
}

function ToolCallBlock({ toolCall }: { toolCall: AgentToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = toolCall.status === 'completed' ? '\u2713'
    : toolCall.status === 'denied' ? '\u2717'
    : toolCall.status === 'running' ? '\u25CB'
    : '\u2026';

  const statusColor = toolCall.status === 'completed' ? 'var(--text-success, #27ae60)'
    : toolCall.status === 'denied' ? 'var(--text-danger, #e74c3c)'
    : 'var(--text-tertiary)';

  const kindLabel = {
    read: 'Read',
    edit: 'Write',
    search: 'Search',
    execute: 'Execute',
    other: 'Tool',
  }[toolCall.kind];

  // Format arguments for display
  const argSummary = formatToolArgs(toolCall.name, toolCall.arguments);

  return (
    <div style={{
      margin: '4px 0',
      border: '1px solid var(--border-default)',
      borderRadius: '6px',
      overflow: 'hidden',
      fontSize: '13px',
      background: 'var(--bg-secondary)',
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
        }}
      >
        <span style={{ color: statusColor, fontWeight: 600, width: '14px' }}>{statusIcon}</span>
        <span style={{
          fontSize: '10px',
          padding: '1px 5px',
          background: 'var(--bg-tertiary)',
          borderRadius: '3px',
          color: 'var(--text-tertiary)',
          fontWeight: 500,
        }}>
          {kindLabel}
        </span>
        <span style={{ fontWeight: 500 }}>{toolCall.name}</span>
        <span style={{ color: 'var(--text-tertiary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {argSummary}
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
          {expanded ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border-default)',
          padding: '8px 10px',
          background: 'var(--bg-primary)',
        }}>
          {/* Arguments */}
          <div style={{ marginBottom: toolCall.result ? '8px' : 0 }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Input
            </div>
            <pre style={{
              margin: 0,
              padding: '6px 8px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              fontSize: '11px',
              lineHeight: '1.4',
              overflow: 'auto',
              maxHeight: '200px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {toolCall.result && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Output
              </div>
              <pre style={{
                margin: 0,
                padding: '6px 8px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
                fontSize: '11px',
                lineHeight: '1.4',
                overflow: 'auto',
                maxHeight: '300px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PermissionDialog({
  toolCall,
  onAllow,
  onDeny,
}: {
  toolCall: AgentToolCall;
  onAllow: () => void;
  onDeny: () => void;
}) {
  return (
    <div style={{
      margin: '8px 0',
      padding: '12px 14px',
      border: '1px solid rgba(245, 166, 35, 0.4)',
      borderRadius: '8px',
      background: 'rgba(245, 166, 35, 0.06)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        fontSize: '13px',
        fontWeight: 600,
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
        <strong>{toolCall.name}</strong> wants to{' '}
        {toolCall.kind === 'edit' ? 'write a file' : 'run a command'}:
        <pre style={{
          margin: '6px 0 0',
          padding: '6px 8px',
          background: 'var(--bg-tertiary)',
          borderRadius: '4px',
          fontSize: '11px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {JSON.stringify(toolCall.arguments, null, 2)}
        </pre>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onAllow}
          style={{
            padding: '6px 14px',
            background: 'var(--text-accent)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Allow
        </button>
        <button
          onClick={onDeny}
          style={{
            padding: '6px 14px',
            background: 'transparent',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function CapabilityBadge({ label }: { label: string }) {
  return (
    <span style={{
      padding: '2px 8px',
      background: 'var(--bg-tertiary)',
      border: '1px solid var(--border-default)',
      borderRadius: '10px',
      fontSize: '11px',
      color: 'var(--text-tertiary)',
    }}>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: '14px',
      height: '14px',
      border: '2px solid var(--border-default)',
      borderTopColor: 'var(--text-accent)',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}

function formatToolArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'read_file':
      return args.path as string || '';
    case 'write_file':
      return args.path as string || '';
    case 'list_directory':
      return (args.path as string) || '.';
    case 'search_files':
      return `${args.pattern}${args.content ? ` (contains: ${args.content})` : ''}`;
    case 'run_command':
      return args.command as string || '';
    default:
      return Object.values(args).join(', ');
  }
}
