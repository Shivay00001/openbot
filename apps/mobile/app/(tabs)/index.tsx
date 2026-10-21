/**
 * OpenBot Mobile — Chat Screen
 * Full chat interface with model selection, message thread, and Ollama/cloud inference.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '@/lib/theme';
import { chatWithOllama, checkOllamaHealth, type ChatMessageDTO, type OllamaModel } from '@/lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  model?: string;
  timestamp: number;
}

const MODELS = [
  { id: 'qwen2.5:0.5b', label: 'Qwen 2.5 (0.5B)', local: true },
  { id: 'deepseek-r1:1.5b', label: 'DeepSeek R1 (1.5B)', local: true },
  { id: 'llama3.2:1b', label: 'Llama 3.2 (1B)', local: true },
  { id: 'gpt-4o', label: 'GPT-4o (Cloud)', local: false },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Cloud)', local: false },
];

const QUICK_PROMPTS = [
  '💡 Explain quantum computing simply',
  '🐍 Write a Python fibonacci function',
  '📱 What can you do with my phone?',
  '🧠 How does your memory system work?',
];

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '👋 Hello! I am OpenBot, your universal autonomous AI agent.\n\n' +
        '• 📱 Agentic Phone Mode — full device automation\n' +
        '• 💻 Desktop "Own Computer" control\n' +
        '• 🧠 On-device local model inference (zero cloud)\n' +
        '• 🔑 Universal BYOK cloud routing\n\n' +
        'How can I help you today?',
      model: 'Local Agent',
      timestamp: Date.now() - 60000,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: OllamaModel[] }>({ available: false, models: [] });
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    checkOllamaHealth().then(setOllamaStatus);
  }, []);

  const handleSend = useCallback(
    async (text?: string) => {
      const msgText = (text || inputText).trim();
      if (!msgText || isLoading) return;

      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: msgText,
        model: selectedModel,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInputText('');
      setIsLoading(true);

      try {
        const history: ChatMessageDTO[] = messages.slice(-6).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Try local Ollama first
        let chosenModel = selectedModel;
        if (ollamaStatus.available && ollamaStatus.models.length > 0) {
          const found = ollamaStatus.models.find((m) => m.name.includes(selectedModel));
          chosenModel = found?.name || ollamaStatus.models[0].name;
        }

        const result = await chatWithOllama(chosenModel, history, msgText);

        const botMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: result.success
            ? result.content || 'I processed your request.'
            : `⚠️ ${result.error || 'Inference unavailable'}\n\nTo get started:\n• Pull a model: \`ollama pull qwen2.5:0.5b\`\n• Or add your cloud API key in Settings`,
          thinking: result.thinking || undefined,
          model: result.success ? `${chosenModel} (Local)` : selectedModel,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, botMsg]);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: `⚠️ Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputText, isLoading, selectedModel, messages, ollamaStatus],
  );

  const toggleThinking = (msgId: string) => {
    setExpandedThinking((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {/* Avatar */}
        <View style={[styles.avatar, isUser ? styles.avatarUser : styles.avatarBot]}>
          <Ionicons
            name={isUser ? 'person' : 'hardware-chip'}
            size={16}
            color={isUser ? '#fff' : '#000'}
          />
        </View>

        <View style={styles.messageBubbleWrap}>
          {/* Header */}
          <View style={styles.messageHeader}>
            <Text style={[styles.messageAuthor, { color: isUser ? Colors.accentBlue : Colors.accentCyan }]}>
              {isUser ? 'You' : 'OpenBot'}
            </Text>
            <Text style={styles.messageTime}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {!isUser && item.model && (
              <View style={styles.modelBadge}>
                <Text style={styles.modelBadgeText}>{item.model}</Text>
              </View>
            )}
          </View>

          {/* Thinking trace */}
          {item.thinking && (
            <TouchableOpacity
              onPress={() => toggleThinking(item.id)}
              style={styles.thinkingToggle}
            >
              <Ionicons name="sparkles" size={12} color={Colors.accentPurple} />
              <Text style={styles.thinkingToggleText}>
                Reasoning Trace ({expandedThinking[item.id] ? 'Hide' : 'Show'})
              </Text>
              <Ionicons
                name={expandedThinking[item.id] ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={Colors.accentPurple}
              />
            </TouchableOpacity>
          )}
          {item.thinking && expandedThinking[item.id] && (
            <View style={styles.thinkingContent}>
              <Text style={styles.thinkingText}>{item.thinking}</Text>
            </View>
          )}

          {/* Message body */}
          <View style={[styles.messageBubble, isUser ? styles.messageBubbleUser : styles.messageBubbleBot]}>
            <Text style={styles.messageText}>{item.content}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Model Picker Bar */}
      <View style={styles.modelBar}>
        <Ionicons name="hardware-chip-outline" size={16} color={Colors.accentCyan} />
        <Text style={styles.modelBarLabel}>Engine:</Text>
        <TouchableOpacity
          onPress={() => setShowModelPicker(!showModelPicker)}
          style={styles.modelSelector}
        >
          <Text style={styles.modelSelectorText}>
            {MODELS.find((m) => m.id === selectedModel)?.label || selectedModel}
          </Text>
          <Ionicons name="chevron-down" size={14} color={Colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: ollamaStatus.available ? Colors.accentEmerald : Colors.accentAmber }]} />
          <Text style={[styles.statusText, { color: ollamaStatus.available ? Colors.accentEmerald : Colors.accentAmber }]}>
            {ollamaStatus.available ? `${ollamaStatus.models.length} local` : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Model Picker Dropdown */}
      {showModelPicker && (
        <View style={styles.modelDropdown}>
          {MODELS.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => {
                setSelectedModel(m.id);
                setShowModelPicker(false);
              }}
              style={[styles.modelOption, selectedModel === m.id && styles.modelOptionActive]}
            >
              <Ionicons
                name={m.local ? 'hardware-chip' : 'cloud'}
                size={14}
                color={selectedModel === m.id ? Colors.accentCyan : Colors.textMuted}
              />
              <Text style={[styles.modelOptionText, selectedModel === m.id && { color: Colors.textPrimary }]}>
                {m.label}
              </Text>
              {selectedModel === m.id && <Ionicons name="checkmark" size={16} color={Colors.accentCyan} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Messages Thread */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />

      {/* Quick Prompts */}
      {messages.length <= 2 && (
        <FlatList
          data={QUICK_PROMPTS}
          horizontal
          keyExtractor={(_, i) => `qp-${i}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPromptsContainer}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleSend(item)} style={styles.quickPrompt}>
              <Text style={styles.quickPromptText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={Colors.accentCyan} />
          <Text style={styles.loadingText}>Processing with local inference engine...</Text>
        </View>
      )}

      {/* Input Composer */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.inputAction}>
          <Ionicons name="attach" size={22} color={Colors.textMuted} />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Give OpenBot a goal or question..."
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={4000}
          onSubmitEditing={() => handleSend()}
          blurOnSubmit
        />

        <TouchableOpacity style={styles.inputAction}>
          <Ionicons name="mic-outline" size={22} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleSend()}
          disabled={!inputText.trim() || isLoading}
          style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
        >
          <Ionicons name="send" size={18} color={inputText.trim() && !isLoading ? '#000' : Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  // Model bar
  modelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgGlass,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSubtle,
  },
  modelBarLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgTertiary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    flex: 1,
  },
  modelSelectorText: {
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  // Model dropdown
  modelDropdown: {
    backgroundColor: Colors.bgTertiary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: Spacing.xs,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  modelOptionActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
  },
  modelOptionText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    flex: 1,
  },
  // Messages
  messagesList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.xl,
  },
  messageRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUser: {
    backgroundColor: Colors.accentBlue,
  },
  avatarBot: {
    backgroundColor: Colors.accentCyan,
  },
  messageBubbleWrap: {
    flex: 1,
    gap: Spacing.sm,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageAuthor: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  messageTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  modelBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  modelBadgeText: {
    color: Colors.accentCyan,
    fontSize: 9,
    fontWeight: FontWeight.bold,
  },
  thinkingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  thinkingToggleText: {
    fontSize: FontSize.xs,
    color: Colors.accentPurple,
    fontWeight: FontWeight.semibold,
  },
  thinkingContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  thinkingText: {
    fontSize: FontSize.xs,
    color: '#e2e8f0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  messageBubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  messageBubbleUser: {
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  messageBubbleBot: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.borderSubtle,
  },
  messageText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  // Quick prompts
  quickPromptsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  quickPrompt: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: Radius.full,
  },
  quickPromptText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  // Loading
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  loadingText: {
    color: Colors.accentCyan,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: 'rgba(12, 15, 23, 0.95)',
  },
  inputAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    paddingVertical: 10,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.bgTertiary,
  },
});
