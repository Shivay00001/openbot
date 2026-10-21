'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
  Cpu,
  Clock,
  Sparkles,
  Bot
} from 'lucide-react';
import type { ChatMessage } from '../lib/state';

export interface ConversationItem {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  updatedAt: number;
}

interface ConversationSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: ConversationItem[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  isZeroCloudActive: boolean;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  isOpen,
  onToggle,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  isZeroCloudActive,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Floating Toggle Button when closed */}
      {!isOpen && (
        <button
          onClick={onToggle}
          title="Open Conversation History"
          style={{
            position: 'absolute',
            left: '16px',
            top: '16px',
            zIndex: 40,
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-light)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Sidebar Container */}
      <aside
        style={{
          width: isOpen ? '280px' : '0px',
          height: 'calc(100vh - var(--header-height))',
          background: 'var(--bg-secondary)',
          borderRight: isOpen ? '1px solid var(--border-subtle)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          flexShrink: 0,
          position: 'relative',
          zIndex: 35,
        }}
      >
        {isOpen && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              width: '280px',
              padding: '16px',
              gap: '12px',
            }}
          >
            {/* Top Action Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Conversations</span>
              </div>
              <button
                onClick={onToggle}
                title="Collapse sidebar"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={onNewConversation}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 600,
              }}
            >
              <Plus size={16} />
              <span>New Conversation</span>
            </button>

            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
              }}
            >
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  width: '100%',
                }}
              />
            </div>

            {/* Conversation List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                marginRight: '-6px',
                paddingRight: '6px',
              }}
            >
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: '24px 12px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                  }}
                >
                  No conversation threads found.
                </div>
              ) : (
                filtered.map((conv) => {
                  const isActive = conv.id === activeConversationId;
                  return (
                    <div
                      key={conv.id}
                      onClick={() => onSelectConversation(conv.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: isActive
                          ? 'rgba(0, 242, 254, 0.1)'
                          : 'rgba(255, 255, 255, 0.02)',
                        border: isActive
                          ? '1px solid rgba(0, 242, 254, 0.3)'
                          : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? 'var(--accent-cyan)' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '180px',
                          }}
                        >
                          {conv.title}
                        </span>

                        {conversations.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conv.id);
                            }}
                            title="Delete thread"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '2px',
                              opacity: 0.6,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-rose)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Clock size={10} />
                        <span>{new Date(conv.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        <span>•</span>
                        <span>{conv.messages.length} msgs</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Status Card */}
            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Shield size={13} style={{ color: isZeroCloudActive ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }} />
                  <span>Privacy Mode</span>
                </div>
                <span
                  style={{
                    fontWeight: 600,
                    color: isZeroCloudActive ? 'var(--accent-emerald)' : 'var(--text-primary)',
                  }}
                >
                  {isZeroCloudActive ? 'Zero-Cloud' : 'BYOK Hybrid'}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Cpu size={13} style={{ color: 'var(--accent-cyan)' }} />
                  <span>Local Engine</span>
                </div>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  Ollama / GGUF
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};
