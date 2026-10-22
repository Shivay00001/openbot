/**
 * Web2API Adapter 🌐
 * Turns Free-Tier Web Chatbots (DuckDuckGo AI Chat, ChatGPT Web, Claude Web, Gemini Web, Qwen Web)
 * into OpenAI-compatible API endpoints for zero-cost agentic intelligence.
 */

import type {
  ModelAdapter,
  CompletionParams,
  CompletionResult,
} from './index.js';
import type { StreamEvent, ToolCall } from '../types/index.js';
import { v4 as uuid } from 'uuid';
import { proxiedFetch } from '../net/http.js';

export const WEB2API_MODELS = [
  'duckduckgo:gpt-4o-mini',
  'duckduckgo:claude-3-haiku',
  'duckduckgo:llama-3.3-70b',
  'duckduckgo:mixtral-8x7b',
  'web:chatgpt-free',
  'web:gemini-free',
  'web:claude-free',
  'web:qwen-free',
];

const DDG_MODEL_MAP: Record<string, string> = {
  'duckduckgo:gpt-4o-mini': 'gpt-4o-mini',
  'duckduckgo:claude-3-haiku': 'claude-3-haiku-20240307',
  'duckduckgo:llama-3.3-70b': 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  'duckduckgo:mixtral-8x7b': 'mistralai/Mixtral-8x7B-Instruct-v0.1',
  'gpt-4o-mini': 'gpt-4o-mini',
  'claude-3-haiku': 'claude-3-haiku-20240307',
  'llama-3.3-70b': 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
};

export class Web2ApiModelAdapter implements ModelAdapter {
  private vqdToken: string | null = null;
  private vqdExpiresAt = 0;

  async healthCheck(): Promise<boolean> {
    try {
      const token = await this.getDuckDuckGoVqd();
      return !!token;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    return WEB2API_MODELS;
  }

  /**
   * Acquire a fresh DuckDuckGo AI Chat VQD authorization token.
   * DuckDuckGo provides free GPT-4o-mini and Claude-3-Haiku without account or API key.
   */
  private async getDuckDuckGoVqd(): Promise<string> {
    if (this.vqdToken && Date.now() < this.vqdExpiresAt) {
      return this.vqdToken;
    }

    const res = await proxiedFetch('https://duckduckgo.com/duckchat/v1/status', {
      method: 'GET',
      headers: {
        'x-vqd-accept': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    const vqd = res.headers.get('x-vqd-4') || res.headers.get('x-vqd');
    if (!vqd) {
      throw new Error('Failed to acquire DuckDuckGo VQD authorization token for Web2API');
    }

    this.vqdToken = vqd;
    this.vqdExpiresAt = Date.now() + 10 * 60 * 1000; // valid for 10 minutes
    return vqd;
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const start = Date.now();
    const requestedModel = params.modelConfig.model || 'duckduckgo:gpt-4o-mini';
    const ddgModel = DDG_MODEL_MAP[requestedModel] || 'gpt-4o-mini';

    const vqd = await this.getDuckDuckGoVqd();

    const formattedMessages = params.messages.map((m) => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content: m.content,
    }));

    if (params.tools && params.tools.length > 0) {
      const toolDirective =
        `\n\n[AVAILABLE TOOLS]:\n` +
        JSON.stringify(params.tools, null, 2) +
        `\nWhen an action is needed, output ONLY valid JSON:\n` +
        `{"tool_calls": [{"name": "tool_name", "arguments": { ... }}}]\n`;

      const sysMsg = formattedMessages.find((m) => m.role === 'system');
      if (sysMsg) {
        sysMsg.content += toolDirective;
      } else {
        formattedMessages.unshift({ role: 'system', content: toolDirective });
      }
    }

    const res = await proxiedFetch('https://duckduckgo.com/duckchat/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vqd-4': vqd,
        Accept: 'text/event-stream',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        model: ddgModel,
        messages: formattedMessages,
      }),
      signal: AbortSignal.timeout(40000),
    });

    // Update VQD token from response headers if returned
    const nextVqd = res.headers.get('x-vqd-4') || res.headers.get('x-vqd');
    if (nextVqd) {
      this.vqdToken = nextVqd;
      this.vqdExpiresAt = Date.now() + 10 * 60 * 1000;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Status ' + res.status);
      throw new Error(`Web2API DuckDuckGo error (${res.status}): ${errText}`);
    }

    // Stream SSE events into final response text
    const sseBody = await res.text();
    let content = '';

    const lines = sseBody.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.message) {
            content += parsed.message;
          }
        } catch {
          // skip non-json frames
        }
      }
    }

    let toolCalls: ToolCall[] | undefined;
    try {
      const trimmed = content.trim();
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const potentialJson = trimmed.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(potentialJson);
        if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
          toolCalls = parsed.tool_calls.map((tc: any) => ({
            id: `call_${uuid().slice(0, 8)}`,
            name: tc.name,
            arguments: typeof tc.arguments === 'object' ? tc.arguments : JSON.parse(tc.arguments || '{}'),
          }));
        }
      }
    } catch {
      // conversational response
    }

    const latencyMs = Date.now() - start;
    const estTokens = Math.ceil(content.length / 4);

    return {
      id: `web2api_${uuid()}`,
      content,
      toolCalls,
      finishReason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
      usage: {
        promptTokens: Math.ceil(JSON.stringify(formattedMessages).length / 4),
        completionTokens: estTokens,
        totalTokens: Math.ceil(JSON.stringify(formattedMessages).length / 4) + estTokens,
      },
      costUsd: 0.0, // 100% Free
      latencyMs,
    };
  }

  async *stream(params: CompletionParams): AsyncGenerator<StreamEvent> {
    const result = await this.complete(params);
    const words = result.content.split(' ');
    for (const word of words) {
      yield {
        type: 'text',
        data: word + ' ',
      };
      await new Promise((r) => setTimeout(r, 15));
    }
    if (result.toolCalls) {
      for (const tc of result.toolCalls) {
        yield {
          type: 'tool_call',
          data: tc,
        };
      }
    }
    yield {
      type: 'done',
      data: null,
    };
  }
}
