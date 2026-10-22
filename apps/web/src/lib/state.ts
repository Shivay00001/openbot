/**
 * OpenBot Client State & Mock Data Engine
 */

export type AppMode = 
  | 'chat'
  | 'edge-nodes'
  | 'phone'
  | 'desktop'
  | 'browser'
  | 'local-weights'
  | 'skills'
  | 'voice';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thinking?: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: unknown }>;
  model: string;
  timestamp: number;
}

export interface ApiKeyConfig {
  openai?: string;
  anthropic?: string;
  google?: string;
  xai?: string;
  deepseek?: string;
  mistral?: string;
  ollamaUrl?: string;
}

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content: `👋 Hello! I am **OpenBot**, your universal autonomous AI agent.

I am built to seamlessly operate across all platforms (web, phone, laptop, desktop) with:
- 📱 **Agentic Phone Mode**: Full smartphone control via accessibility & touch simulation
- 💻 **Agentic Desktop Mode**: "Own Computer" terminal, files, and mouse/keyboard automation
- 🌐 **Multi-Tab Browser Agent**: Autonomous web exploration, forms, and live multi-tab workspaces
- 🧠 **Integrated Local Weights**: Run Qwen 2.5, Llama 3.2, and DeepSeek-R1 100% on-device with zero cloud data leakage
- 🔑 **Universal BYOK**: Connect OpenAI, Anthropic, Gemini, Grok, or Ollama

How would you like to begin today?`,
    model: 'deepseek-r1-distill-qwen-1.5b-q4 (Local)',
    timestamp: Date.now() - 60000,
  },
];
