'use client';

/**
 * AgentChat Component
 *
 * EXPERIMENTAL: Chat interface for Claude Code integration.
 * Displays conversation history with markdown rendering support.
 *
 * Design principles:
 * - Clean, minimal chat interface with clear visual hierarchy
 * - User messages aligned right, assistant messages aligned left
 * - Subtle styling that doesn't compete with content
 * - Smooth animations for thinking states
 */

import { useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { useAgentEditor } from '@/context/AgentEditorContext';
import type { AgentMessage } from '@/types/agent';

// ============================================
// Message Bubble Component
// ============================================

interface MessageBubbleProps {
  message: AgentMessage;
  isSelected: boolean;
  onSelect: () => void;
}

function MessageBubble({ message, isSelected, onSelect }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Simple markdown rendering for code blocks and basic formatting
  const renderContent = (content: string) => {
    // Split by code blocks first
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      // Code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).split('\n');
        const language = lines[0]?.trim() || '';
        const code = language ? lines.slice(1).join('\n') : lines.join('\n');

        return (
          <pre
            key={index}
            style={{
              background: isUser ? 'rgba(255,255,255,0.1)' : 'var(--bg-tertiary)',
              padding: '12px 14px',
              borderRadius: '8px',
              overflow: 'auto',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              margin: '8px 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              border: isUser ? 'none' : '1px solid var(--border-primary)',
            }}
          >
            {language && (
              <div
                style={{
                  fontSize: '10px',
                  color: isUser ? 'rgba(255,255,255,0.6)' : 'var(--text-tertiary)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  fontWeight: 500,
                }}
              >
                {language}
              </div>
            )}
            <code style={{ color: isUser ? 'rgba(255,255,255,0.95)' : 'var(--text-primary)' }}>
              {code}
            </code>
          </pre>
        );
      }

      // Inline code
      const inlineCodeParts = part.split(/(`[^`]+`)/g);
      return (
        <span key={index}>
          {inlineCodeParts.map((codePart, codeIndex) => {
            if (codePart.startsWith('`') && codePart.endsWith('`')) {
              return (
                <code
                  key={codeIndex}
                  style={{
                    background: isUser ? 'rgba(255,255,255,0.15)' : 'var(--bg-tertiary)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.875em',
                    fontFamily: 'var(--font-mono)',
                    color: isUser ? 'rgba(255,255,255,0.95)' : 'var(--text-primary)',
                  }}
                >
                  {codePart.slice(1, -1)}
                </code>
              );
            }

            // Handle bold text
            const boldParts = codePart.split(/(\*\*[^*]+\*\*)/g);
            return boldParts.map((boldPart, boldIndex) => {
              if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
                return (
                  <strong key={`${codeIndex}-${boldIndex}`}>
                    {boldPart.slice(2, -2)}
                  </strong>
                );
              }
              return <span key={`${codeIndex}-${boldIndex}`}>{boldPart}</span>;
            });
          })}
        </span>
      );
    });
  };

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '16px',
        cursor: 'pointer',
        padding: '0 4px',
      }}
    >
      {/* Role label - smaller and more subtle */}
      <div
        style={{
          fontSize: '11px',
          color: 'var(--text-tertiary)',
          marginBottom: '4px',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        {isSystem ? 'System' : isUser ? 'You' : 'Claude'}
      </div>

      {/* Message bubble */}
      <div
        style={{
          maxWidth: '88%',
          padding: '12px 16px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser
            ? 'var(--accent-primary)'
            : isSystem
            ? 'var(--bg-tertiary)'
            : 'var(--bg-secondary)',
          color: isUser ? 'white' : 'var(--text-primary)',
          fontSize: '14px',
          lineHeight: 1.6,
          wordBreak: 'break-word',
          boxShadow: isSelected
            ? '0 0 0 2px var(--accent-primary), 0 2px 8px rgba(0,0,0,0.1)'
            : isUser
              ? '0 2px 8px rgba(0,0,0,0.15)'
              : '0 1px 3px rgba(0,0,0,0.05)',
          transition: 'box-shadow 0.15s ease, transform 0.1s ease',
          border: isUser ? 'none' : '1px solid var(--border-primary)',
        }}
      >
        {renderContent(message.content)}
      </div>

      {/* Timestamp */}
      <div
        style={{
          fontSize: '10px',
          color: 'var(--text-tertiary)',
          marginTop: '4px',
          opacity: 0.8,
        }}
      >
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      {/* Error indicator */}
      {message.metadata?.error && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--status-error)',
            marginTop: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '6px',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {message.metadata.error}
        </div>
      )}
    </div>
  );
}

// ============================================
// Thinking Indicator Component
// ============================================

function ThinkingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: '16px',
        padding: '0 4px',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '16px 16px 16px 4px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div className="thinking-dots">
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                animation: 'thinking-dot 1.4s infinite ease-in-out both',
                animationDelay: '0s',
              }}
            />
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                animation: 'thinking-dot 1.4s infinite ease-in-out both',
                animationDelay: '0.2s',
              }}
            />
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--accent-primary)',
                animation: 'thinking-dot 1.4s infinite ease-in-out both',
                animationDelay: '0.4s',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >
            Claude is thinking...
          </span>
        </div>
      </div>
      <style>{`
        .thinking-dots {
          display: flex;
          gap: 5px;
        }
        .thinking-dots span {
          display: inline-block;
        }
        @keyframes thinking-dot {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================
// Chat Input Component
// ============================================

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder?: string;
}

function ChatInput({ value, onChange, onSubmit, disabled, placeholder }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end',
        padding: '16px 20px',
        paddingBottom: '24px', // Extra bottom padding to avoid any UI overlap
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-primary)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder || 'Message Claude...'}
        rows={1}
        style={{
          flex: 1,
          padding: '12px 16px',
          borderRadius: '12px',
          border: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          minHeight: '44px',
          maxHeight: '180px',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--accent-primary)';
          e.target.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb), 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border-primary)';
          e.target.style.boxShadow = 'none';
        }}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        style={{
          padding: '12px',
          borderRadius: '12px',
          border: 'none',
          background: disabled || !value.trim() ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
          color: disabled || !value.trim() ? 'var(--text-tertiary)' : 'white',
          cursor: disabled || !value.trim() ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease, transform 0.1s ease, opacity 0.15s ease',
          minWidth: '44px',
          minHeight: '44px',
          opacity: disabled || !value.trim() ? 0.6 : 1,
        }}
        onMouseDown={(e) => {
          if (!disabled && value.trim()) {
            e.currentTarget.style.transform = 'scale(0.95)';
          }
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="Send message (Enter)"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
      </button>
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================

function EmptyState() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        color: 'var(--text-secondary)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          border: '1px solid var(--border-primary)',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--accent-primary)' }}
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      </div>
      <div
        style={{
          fontSize: '16px',
          fontWeight: 600,
          marginBottom: '8px',
          color: 'var(--text-primary)',
        }}
      >
        Start a conversation
      </div>
      <div
        style={{
          fontSize: '14px',
          textAlign: 'center',
          maxWidth: '280px',
          lineHeight: 1.5,
          color: 'var(--text-secondary)',
        }}
      >
        Ask Claude to help with your project. It can read files, write code, and run commands.
      </div>
    </div>
  );
}

// ============================================
// Connection Status Bar Component
// ============================================

interface ConnectionStatusBarProps {
  connectionStatus: string;
  isConnected: boolean;
  onStop: () => void;
}

function ConnectionStatusBar({ connectionStatus, isConnected, onStop }: ConnectionStatusBarProps) {
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'var(--status-success)';
      case 'connecting':
        return 'var(--status-warning)';
      case 'error':
        return 'var(--status-error)';
      default:
        return 'var(--text-tertiary)';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Ready';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        fontSize: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: getStatusColor(),
            boxShadow: connectionStatus === 'connected' ? `0 0 6px ${getStatusColor()}` : 'none',
          }}
        />
        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
          {getStatusText()}
        </span>
      </div>
      {isConnected && (
        <button
          onClick={onStop}
          style={{
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid var(--status-error)',
            background: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--status-error)',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
          >
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
          Stop
        </button>
      )}
    </div>
  );
}

// ============================================
// Main AgentChat Component
// ============================================

export default function AgentChat() {
  const {
    state,
    setSelectedMessage,
    setInputDraft,
    setError,
    sendToClaud,
    stopClaudeSession,
    isClaudeConnected,
  } = useAgentEditor();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use context draft directly as the source of truth for input value
  const localInput = state.ui.inputDraft;

  // Scroll to bottom when messages change or content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.document.conversation, state.ui.isGenerating]);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputDraft(value);
    },
    [setInputDraft]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = localInput.trim();
    if (!trimmed) return;

    // Clear input immediately for better UX
    setInputDraft('');

    try {
      // Send to Claude (this adds the user message and starts streaming)
      await sendToClaud(trimmed);
    } catch (error) {
      console.error('[AgentChat] Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    }
  }, [localInput, sendToClaud, setInputDraft, setError]);

  const handleStop = useCallback(async () => {
    try {
      await stopClaudeSession();
    } catch (error) {
      console.error('[AgentChat] Error stopping session:', error);
    }
  }, [stopClaudeSession]);

  const handleMessageSelect = useCallback(
    (messageId: string) => {
      setSelectedMessage(
        state.ui.selectedMessageId === messageId ? undefined : messageId
      );
    },
    [state.ui.selectedMessageId, setSelectedMessage]
  );

  const { conversation } = state.document;
  const { isGenerating, selectedMessageId, connectionStatus, error } = state.ui;
  const isConnected = isClaudeConnected();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Connection status bar */}
      <ConnectionStatusBar
        connectionStatus={connectionStatus}
        isConnected={isConnected}
        onStop={handleStop}
      />

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--status-error)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ flex: 1 }}>{error}</span>
        </div>
      )}

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px 16px',
        }}
      >
        {conversation.length === 0 && !isGenerating ? (
          <EmptyState />
        ) : (
          <>
            {conversation.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isSelected={selectedMessageId === message.id}
                onSelect={() => handleMessageSelect(message.id)}
              />
            ))}
            {isGenerating && conversation[conversation.length - 1]?.role !== 'assistant' && (
              <ThinkingIndicator />
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <ChatInput
        value={localInput}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        disabled={isGenerating || connectionStatus === 'connecting'}
        placeholder={
          connectionStatus === 'connecting'
            ? 'Connecting to Claude...'
            : 'Message Claude...'
        }
      />
    </div>
  );
}
