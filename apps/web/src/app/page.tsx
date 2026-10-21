'use client';

import React, { useState } from 'react';
import { Header } from '../components/Header';
import { ChatView } from '../components/ChatView';
import { ConversationSidebar, type ConversationItem } from '../components/ConversationSidebar';
import { PhoneModeView } from '../components/PhoneModeView';
import { DesktopModeView } from '../components/DesktopModeView';
import { BrowserModeView } from '../components/BrowserModeView';
import { LocalWeightsView } from '../components/LocalWeightsView';
import { SkillStudioView } from '../components/SkillStudioView';
import { VoiceCallView } from '../components/VoiceCallView';
import { SettingsModal } from '../components/SettingsModal';
import { 
  type AppMode, 
  type ChatMessage, 
  type ApiKeyConfig, 
  INITIAL_CHAT_MESSAGES 
} from '../lib/state';

export default function OpenBotPage() {
  const [currentMode, setCurrentMode] = useState<AppMode>('chat');
  const [conversations, setConversations] = useState<ConversationItem[]>([
    {
      id: 'conv-1',
      title: 'Agent Initialization & Hardware',
      model: 'deepseek-r1-distill-qwen-1.5b-q4',
      messages: INITIAL_CHAT_MESSAGES,
      updatedAt: Date.now(),
    },
  ]);
  const [activeConversationId, setActiveConversationId] = useState<string>('conv-1');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [activeModel, setActiveModel] = useState<string>('deepseek-r1-distill-qwen-1.5b-q4');
  const [isZeroCloudActive, setIsZeroCloudActive] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig>({
    ollamaUrl: 'http://localhost:11434/v1',
  });

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || conversations[0];
  const messages = activeConversation ? activeConversation.messages : [];

  const handleSendMessage = async (text: string, model: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      model,
      timestamp: Date.now(),
    };

    // Optimistically update conversation
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConversationId) {
          const title = c.messages.length <= 1 ? (text.slice(0, 30) + '...') : c.title;
          return {
            ...c,
            title,
            messages: [...c.messages, userMsg],
            updatedAt: Date.now(),
          };
        }
        return c;
      })
    );

    // Send real POST request to /api/chat
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          model,
          isZeroCloud: isZeroCloudActive,
          apiKeys,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const botMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: data.content,
          thinking: data.thinking || undefined,
          toolCalls: data.toolCalls && data.toolCalls.length > 0 ? data.toolCalls : undefined,
          model: isZeroCloudActive ? `${model} (Zero-Cloud)` : model,
          timestamp: Date.now(),
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages: [...c.messages, botMsg], updatedAt: Date.now() }
              : c
          )
        );
      } else {
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: `⚠️ Error executing agent request: ${data.error || 'Unknown error'}`,
          model,
          timestamp: Date.now(),
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, messages: [...c.messages, errorMsg], updatedAt: Date.now() }
              : c
          )
        );
      }
    } catch (err: unknown) {
      const networkErrorMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `⚠️ Failed to reach OpenBot agent API: ${err instanceof Error ? err.message : 'Network error'}`,
        model,
        timestamp: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversationId
            ? { ...c, messages: [...c.messages, networkErrorMsg], updatedAt: Date.now() }
            : c
        )
      );
    }
  };

  const handleNewConversation = () => {
    const newId = `conv-${Date.now()}`;
    const newConv: ConversationItem = {
      id: newId,
      title: 'New Conversation',
      model: activeModel,
      messages: INITIAL_CHAT_MESSAGES,
      updatedAt: Date.now(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(newId);
  };

  const handleDeleteConversation = (id: string) => {
    if (conversations.length <= 1) return;
    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    if (activeConversationId === id) {
      setActiveConversationId(remaining[0].id);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hidden H1 for accessibility and SEO */}
      <h1 style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
        OpenBot — Universal Autonomous AI Agent & Cross-Platform Device Controller
      </h1>

      {/* Top Header */}
      <Header
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isZeroCloudActive={isZeroCloudActive}
        activeModelName={activeModel}
      />

      {/* Main Mode Viewport */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
        {currentMode === 'chat' && (
          <>
            <ConversationSidebar
              isOpen={isSidebarOpen}
              onToggle={() => setIsSidebarOpen((prev) => !prev)}
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelectConversation={setActiveConversationId}
              onNewConversation={handleNewConversation}
              onDeleteConversation={handleDeleteConversation}
              isZeroCloudActive={isZeroCloudActive}
            />
            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <ChatView
                messages={messages}
                onSendMessage={handleSendMessage}
                activeModel={activeModel}
                onSelectModel={setActiveModel}
              />
            </div>
          </>
        )}

        {currentMode === 'phone' && (
          <div style={{ flex: 1, position: 'relative' }}>
            <PhoneModeView />
          </div>
        )}

        {currentMode === 'desktop' && (
          <div style={{ flex: 1, position: 'relative' }}>
            <DesktopModeView />
          </div>
        )}

        {currentMode === 'browser' && (
          <div style={{ flex: 1, position: 'relative' }}>
            <BrowserModeView />
          </div>
        )}

        {currentMode === 'local-weights' && (
          <div style={{ flex: 1, position: 'relative' }}>
            <LocalWeightsView
              isZeroCloudActive={isZeroCloudActive}
              onToggleZeroCloud={setIsZeroCloudActive}
              onSetInstalledModel={(mId) => setActiveModel(mId)}
            />
          </div>
        )}

        {currentMode === 'skills' && (
          <div style={{ flex: 1, position: 'relative' }}>
            <SkillStudioView />
          </div>
        )}

        {currentMode === 'voice' && (
          <div style={{ flex: 1, position: 'relative' }}>
            <VoiceCallView />
          </div>
        )}
      </div>

      {/* BYOK Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeys={apiKeys}
        onSaveKeys={setApiKeys}
      />
    </main>
  );
}
