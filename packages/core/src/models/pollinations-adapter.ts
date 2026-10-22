/**
 * Pollinations.ai Free Text API Adapter 🌸
 * 100% Free, Unlimited, No-API-Key-Required LLM Provider.
 * Supports OpenAI, DeepSeek, Mistral, Qwen, Gemini, and Claude-hybrid models.
 */

import type {
  ModelAdapter,
  CompletionParams,
  CompletionResult,
} from './index.js';
import type { StreamEvent, ToolCall } from '../types/index.js';
import { v4 as uuid } from 'uuid';
import { proxiedFetch } from '../net/http.js';

export const POLLINATIONS_MODELS = [
  'openai',
  'deepseek',
  'deepseek-r1',
  'mistral',
  'qwen',
  'gemini',
  'claude-hybrid',
  'searchgpt',
];

export class PollinationsModelAdapter implements ModelAdapter {
  private readonly baseUrl: string;

  constructor(baseUrl = 'https://text.pollinations.ai') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await proxiedFetch(`${this.baseUrl}/healthz`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      return res.status < 500;
    } catch {
      // Fallback ping: try a minimal prompt
      try {
        const testRes = await proxiedFetch(`${this.baseUrl}/ping?model=openai`, {
          method: 'GET',
          signal: AbortSignal.timeout(8000),
        });
        return testRes.ok;
      } catch {
        return false;
      }
    }
  }

  async listModels(): Promise<string[]> {
    return POLLINATIONS_MODELS;
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const start = Date.now();
    const model = params.modelConfig.model || 'openai';

    // Format conversation history for Pollinations
    const formattedMessages = params.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // If tools are provided, prepend tool definitions to system prompt so free model can output JSON tool calls
    if (params.tools && params.tools.length > 0) {
      const toolSystemPrompt =
        `\n\nYou have access to the following tools to control laptop, phone, and browser:\n` +
        JSON.stringify(params.tools, null, 2) +
        `\nIf you need to call a tool, reply ONLY with a JSON object in this format:\n` +
        `{"tool_calls": [{"name": "tool_name", "arguments": { ... }}]}\n` +
        `If no tool call is needed, provide your normal conversational answer.`;

      const sysIndex = formattedMessages.findIndex((m) => m.role === 'system');
      if (sysIndex >= 0) {
        formattedMessages[sysIndex].content += toolSystemPrompt;
      } else {
        formattedMessages.unshift({
          role: 'system',
          content: toolSystemPrompt,
        });
      }
    }

    const payload = {
      messages: formattedMessages,
      model,
      temperature: params.modelConfig.temperature ?? 0.7,
      jsonMode: params.jsonMode ?? false,
      seed: Math.floor(Math.random() * 1000000),
    };

    const res = await proxiedFetch(`${this.baseUrl}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/plain, application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Pollinations API error (${res.status}): ${errorText}`);
    }

    const rawContent = await res.text();
    let content = rawContent;
    let toolCalls: ToolCall[] | undefined;

    // Parse potential tool calls from the free model's output
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
      // Content is plain conversational text
    }

    const latencyMs = Date.now() - start;
    const estTokens = Math.ceil(content.length / 4);

    return {
      id: `pollinations_${uuid()}`,
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
      await new Promise((r) => setTimeout(r, 20));
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
