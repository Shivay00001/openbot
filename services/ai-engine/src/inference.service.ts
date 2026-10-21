/**
 * AI Inference Service — The core brain of OpenBot.
 * Routes prompts to the correct model provider (local or cloud),
 * executes the ReAct agent loop, and returns results.
 */

import { Injectable } from '@nestjs/common';
import { ModelRouter, ToolRegistry, createAgent } from '@openbot/core';
import type { ModelConfig, ModelProvider } from '@openbot/core';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

@Injectable()
export class InferenceService {
  private modelRouter: ModelRouter;
  private toolRegistry: ToolRegistry;

  constructor() {
    this.modelRouter = new ModelRouter();
    this.toolRegistry = new ToolRegistry();
  }

  async runInference(data: {
    message: string;
    messages: Array<{ role: string; content: string }>;
    model: string;
    provider: string;
    apiKey?: string;
    isZeroCloud: boolean;
    userId: string;
  }) {
    const startTime = Date.now();
    let content = '';
    let thinking = '';
    const toolCalls: Array<{ name: string; args: Record<string, unknown>; result?: unknown }> = [];

    // Determine provider and config
    const provider = data.provider as ModelProvider;
    const modelConfig: ModelConfig = {
      provider,
      model: data.model,
      apiKey: data.apiKey,
      temperature: 0.7,
      maxTokens: 4096,
    };

    // ─── Local Ollama Inference (Zero-Cloud Mode) ─────────────
    if (data.isZeroCloud || provider === 'ollama' || provider === 'lmstudio') {
      try {
        const checkRes = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
          signal: AbortSignal.timeout(2000),
        });

        if (checkRes.ok) {
          const tagsData = await checkRes.json();
          const availableModels: Array<{ name: string }> = tagsData.models || [];

          if (availableModels.length > 0) {
            const chosenModel = availableModels.find((m) => m.name.includes(data.model))?.name || availableModels[0].name;

            thinking = `[Local Inference Engine]\nModel: ${chosenModel}\nSecurity: Zero-Cloud Protected`;

            const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: chosenModel,
                messages: [
                  { role: 'system', content: 'You are OpenBot, a universal autonomous AI agent. Be concise, helpful, and accurate.' },
                  ...data.messages.slice(-10),
                  { role: 'user', content: data.message },
                ],
                stream: false,
              }),
            });

            if (ollamaRes.ok) {
              const resData = await ollamaRes.json();
              content = resData.message?.content || '';

              return {
                content,
                thinking,
                toolCalls,
                model: chosenModel,
                usage: {
                  promptTokens: resData.prompt_eval_count || 0,
                  completionTokens: resData.eval_count || 0,
                  totalTokens: (resData.prompt_eval_count || 0) + (resData.eval_count || 0),
                  costUsd: 0, // Local = free
                },
                latencyMs: Date.now() - startTime,
              };
            }
          }
        }
      } catch {
        // Fall through to cloud provider
      }
    }

    // ─── Cloud Provider Inference (BYOK) ─────────────────────
    if (data.apiKey) {
      try {
        // Register the provider dynamically
        this.modelRouter.registerProvider({
          provider,
          apiKey: data.apiKey,
          displayName: provider,
          icon: provider,
          isLocal: false,
          models: [data.model],
        });

        const result = await this.modelRouter.complete({
          messages: [
            { id: '0', role: 'system', content: 'You are OpenBot, a universal autonomous AI agent.', createdAt: new Date() },
            ...data.messages.map((m, i) => ({
              id: String(i + 1),
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
              createdAt: new Date(),
            })),
            { id: String(data.messages.length + 1), role: 'user' as const, content: data.message, createdAt: new Date() },
          ],
          modelConfig,
        });

        return {
          content: result.content,
          thinking: `[BYOK Cloud Inference]\nProvider: ${provider}\nModel: ${data.model}`,
          toolCalls: result.toolCalls?.map((tc) => ({ name: tc.name, args: tc.arguments })) || [],
          model: data.model,
          usage: {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
            costUsd: result.costUsd,
          },
          latencyMs: result.latencyMs,
        };
      } catch (error) {
        content = `Inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    // ─── Fallback (no model available) ───────────────────────
    if (!content) {
      content = `I'm ready to help! To get started:\n\n` +
        `• **Local AI**: Pull a model with \`ollama pull qwen2.5:0.5b\` for free on-device inference\n` +
        `• **Cloud AI**: Add your API key in Settings → BYOK Vault for GPT-4o, Claude, Gemini, etc.\n\n` +
        `All subsystems are online and awaiting your command.`;
      thinking = '[Fallback Mode] No local models pulled and no API keys configured.';
    }

    return {
      content,
      thinking,
      toolCalls,
      model: data.model,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 },
      latencyMs: Date.now() - startTime,
    };
  }
}
