'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  ChevronDown, 
  Cpu, 
  Terminal, 
  Wrench, 
  CheckCircle, 
  Paperclip, 
  Mic, 
  Eye, 
  Layers
} from 'lucide-react';
import type { ChatMessage } from '../lib/state';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatViewProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, selectedModel: string) => void;
  activeModel: string;
  onSelectModel: (model: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  activeModel,
  onSelectModel,
}) => {
  const [inputText, setInputText] = useState('');
  const [showThinkingMap, setShowThinkingMap] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const availableModels = [
    { id: 'deepseek-r1-distill-qwen-1.5b-q4', name: 'DeepSeek R1 Distill (1.5B Local GGUF)', category: 'Local Weights' },
    { id: 'qwen2.5-coder-1.5b-q4', name: 'Qwen 2.5 Coder (1.5B Local GGUF)', category: 'Local Weights' },
    { id: 'llama-3.2-1b-instruct-q4', name: 'Llama 3.2 Instruct (1B Local WebGPU)', category: 'Local Weights' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4 (BYOK Cloud)', category: 'Frontier Cloud' },
    { id: 'gpt-4o', name: 'GPT-4o Omnimodel (BYOK Cloud)', category: 'Frontier Cloud' },
    { id: 'grok-3', name: 'xAI Grok 3 (BYOK Cloud)', category: 'Frontier Cloud' },
    { id: 'gemini-2.5-pro', name: 'Google Gemini 2.5 Pro (BYOK Cloud)', category: 'Frontier Cloud' },
  ];

  const quickPrompts = [
    '📱 Open Agentic Phone Mode & order an Uber',
    '🧠 Download DeepSeek R1 local weights for offline work',
    '💻 Execute terminal script to audit open git ports',
    '🌐 Multi-tab research on competitive agent platforms',
  ];

  const toggleThinking = (msgId: string) => {
    setShowThinkingMap((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), activeModel);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      id="openbot-chat-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - var(--header-height))',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
        padding: '16px 24px',
        gap: '16px',
      }}
    >
      {/* Top Model Picker Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-glass)',
          padding: '10px 18px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Cpu size={18} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Inference Engine:</span>
          <select
            id="chat-model-selector"
            value={activeModel}
            onChange={(e) => onSelectModel(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              cursor: 'pointer',
            }}
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                [{m.category}] {m.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-emerald">
            <CheckCircle size={11} /> ReAct Loop Ready
          </span>
          <span className="badge badge-purple">
            <Layers size={11} /> Autonomous Sandbox
          </span>
        </div>
      </div>

      {/* Messages Thread */}
      <div
        id="chat-messages-thread"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          paddingRight: '6px',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className="animate-fade-in"
              style={{
                display: 'flex',
                gap: '14px',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: isUser ? '80%' : '90%',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isUser
                    ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                    : 'var(--gradient-brand)',
                  color: isUser ? '#fff' : '#000',
                  boxShadow: isUser ? 'none' : '0 0 12px rgba(0, 242, 254, 0.3)',
                }}
              >
                {isUser ? <User size={18} /> : <Bot size={18} />}
              </div>

              {/* Message Bubble */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: isUser ? 'var(--accent-blue)' : 'var(--accent-cyan)' }}>
                    {isUser ? 'You' : 'OpenBot Assistant'}
                  </span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {!isUser && (
                    <span className="badge badge-cyan" style={{ fontSize: '10px' }}>
                      {msg.model}
                    </span>
                  )}
                </div>

                {/* DeepSeek R1 Thinking block if present */}
                {msg.thinking && (
                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      fontSize: '12px',
                    }}
                  >
                    <button
                      onClick={() => toggleThinking(msg.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#c084fc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '12px',
                        padding: 0,
                      }}
                    >
                      <Sparkles size={14} />
                      <span>Deep Reasoning Trace ({showThinkingMap[msg.id] ? 'Hide' : 'Show'})</span>
                      <ChevronDown
                        size={14}
                        style={{
                          transform: showThinkingMap[msg.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    </button>
                    {showThinkingMap[msg.id] && (
                      <div
                        style={{
                          marginTop: '8px',
                          color: '#e2e8f0',
                          fontFamily: 'var(--font-mono)',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.5',
                          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                          paddingTop: '8px',
                        }}
                      >
                        {msg.thinking}
                      </div>
                    )}
                  </div>
                )}

                {/* Main Content Body */}
                <div
                  className="glass-panel"
                  style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: isUser
                      ? '1px solid rgba(59, 130, 246, 0.3)'
                      : '1px solid var(--border-subtle)',
                    background: isUser
                      ? 'rgba(30, 58, 138, 0.25)'
                      : 'var(--bg-card)',
                    fontSize: '14px',
                    lineHeight: '1.6',
                  }}
                >
                  <MarkdownRenderer content={msg.content} />
                </div>

                {/* Tool calls card if present */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {msg.toolCalls.map((tc, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(0, 242, 254, 0.05)',
                          border: '1px solid rgba(0, 242, 254, 0.2)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '8px 12px',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <Wrench size={13} style={{ color: 'var(--accent-cyan)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>Tool Executed:</span>
                        <code style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>{tc.name}</code>
                        <span style={{ color: 'var(--text-muted)' }}>({JSON.stringify(tc.args)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => onSendMessage(prompt, activeModel)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Composer Box */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 16px',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(12, 15, 23, 0.85)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <button className="btn-icon" title="Attach file or screenshot" style={{ border: 'none' }}>
          <Paperclip size={18} />
        </button>

        <input
          id="chat-input-field"
          type="text"
          placeholder="Give OpenBot a goal or question (e.g. 'Audit my desktop project' or 'Control my phone to order food')..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            fontSize: '14px',
            color: 'var(--text-primary)',
            padding: '8px 0',
          }}
        />

        <button className="btn-icon" title="Voice dictation" style={{ border: 'none' }}>
          <Mic size={18} />
        </button>

        <button
          id="btn-send-chat"
          onClick={handleSend}
          className="btn btn-primary"
          style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)' }}
        >
          <span>Send</span>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
};
