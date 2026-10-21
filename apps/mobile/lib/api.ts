/**
 * OpenBot Mobile — API Client
 * Communicates with the API Gateway and local Ollama daemon.
 */

const API_BASE = __DEV__ ? 'http://10.0.2.2:4000' : 'https://api.openbot.dev';
const OLLAMA_BASE = 'http://10.0.2.2:11434';

export interface ChatMessageDTO {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface ChatResponse {
  success: boolean;
  content?: string;
  thinking?: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: unknown }>;
  model?: string;
  latencyMs?: number;
  error?: string;
}

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface OllamaStatus {
  available: boolean;
  models: OllamaModel[];
}

// ─── Ollama Local Inference ────────────────────────────────

export async function checkOllamaHealth(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return { available: true, models: data.models || [] };
    }
    return { available: false, models: [] };
  } catch {
    return { available: false, models: [] };
  }
}

export async function chatWithOllama(
  model: string,
  messages: ChatMessageDTO[],
  message: string,
): Promise<ChatResponse> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are OpenBot, a universal autonomous AI agent. Be concise, helpful, and accurate.' },
          ...messages.slice(-8),
          { role: 'user', content: message },
        ],
        stream: false,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        content: data.message?.content || '',
        thinking: `[Local Inference] Model: ${model} | Zero-Cloud Protected`,
        model,
        latencyMs: data.total_duration ? Math.round(data.total_duration / 1_000_000) : 0,
      };
    }
    return { success: false, error: 'Ollama inference failed' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function pullOllamaModel(modelName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: false }),
    });
    if (res.ok) {
      return { success: true };
    }
    return { success: false, error: 'Pull failed' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

// ─── Cloud API Gateway ─────────────────────────────────────

export async function chatWithGateway(
  message: string,
  messages: ChatMessageDTO[],
  model: string,
  provider: string,
  apiKey: string,
): Promise<ChatResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        messages,
        model,
        provider,
        apiKey,
        isZeroCloud: false,
      }),
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

// ─── Health Check ──────────────────────────────────────────

export async function checkGatewayHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
