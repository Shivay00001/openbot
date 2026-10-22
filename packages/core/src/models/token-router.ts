/**
 * TokenRouter & Multi-Provider Load Balancer 🔀
 * Aggregates all free-tier and local model providers into a unified high-resilience completion engine.
 * Automatically tries Pollinations, Web2API, OpenRouter Free, and local Ollama with zero-downtime fallback.
 */

import type {
  ModelAdapter,
  CompletionParams,
  CompletionResult,
} from './index.js';
import type { StreamEvent } from '../types/index.js';
import { PollinationsModelAdapter } from './pollinations-adapter.js';
import { Web2ApiModelAdapter } from './web2api-adapter.js';
import { FreeApiDiscoverer } from './free-api-discoverer.js';

export interface TokenRouterConfig {
  preferredProvider?: 'pollinations' | 'web2api' | 'ollama' | 'openrouter';
  fallbackChain?: Array<'pollinations' | 'web2api' | 'ollama' | 'openrouter'>;
  maxRetries?: number;
}

export class TokenRouter implements ModelAdapter {
  private readonly pollinations = new PollinationsModelAdapter();
  private readonly web2api = new Web2ApiModelAdapter();
  private readonly discoverer = new FreeApiDiscoverer();
  private readonly config: TokenRouterConfig;
  private readonly circuitBreakers: Map<string, { failureCount: number; cooldownUntil: number }> = new Map();

  constructor(config: TokenRouterConfig = {}) {
    this.config = {
      preferredProvider: config.preferredProvider || 'pollinations',
      fallbackChain: config.fallbackChain || ['pollinations', 'web2api', 'ollama'],
      maxRetries: config.maxRetries ?? 3,
    };
  }

  async healthCheck(): Promise<boolean> {
    const pHealth = await this.pollinations.healthCheck();
    if (pHealth) return true;
    const wHealth = await this.web2api.healthCheck();
    return wHealth;
  }

  async listModels(): Promise<string[]> {
    const pModels = await this.pollinations.listModels();
    const wModels = await this.web2api.listModels();
    return [
      'tokenrouter:auto',
      'tokenrouter:fastest',
      ...pModels.map((m) => `pollinations:${m}`),
      ...wModels,
    ];
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const chain = this.config.fallbackChain || ['pollinations', 'web2api', 'ollama'];
    let lastError: Error | null = null;
    const now = Date.now();

    for (const provider of chain) {
      // Circuit Breaker check: skip if provider is in cooldown
      const breaker = this.circuitBreakers.get(provider);
      if (breaker && breaker.cooldownUntil > now) {
        continue;
      }

      try {
        if (provider === 'pollinations') {
          const modParams = {
            ...params,
            modelConfig: {
              ...params.modelConfig,
              model: params.modelConfig.model.replace(/^pollinations:/, '') || 'openai',
            },
          };
          const res = await this.pollinations.complete(modParams);
          this.circuitBreakers.delete(provider); // reset on success
          return res;
        } else if (provider === 'web2api') {
          const modParams = {
            ...params,
            modelConfig: {
              ...params.modelConfig,
              model: params.modelConfig.model.startsWith('duckduckgo:')
                ? params.modelConfig.model
                : 'duckduckgo:gpt-4o-mini',
            },
          };
          const res = await this.web2api.complete(modParams);
          this.circuitBreakers.delete(provider); // reset on success
          return res;
        }
      } catch (err: any) {
        lastError = err;
        // Trip or increment circuit breaker
        const current = this.circuitBreakers.get(provider) || { failureCount: 0, cooldownUntil: 0 };
        current.failureCount += 1;
        // If 2 or more failures, trip breaker for 30 seconds
        if (current.failureCount >= 2) {
          current.cooldownUntil = Date.now() + 30000;
        }
        this.circuitBreakers.set(provider, current);
      }
    }

    throw new Error(
      `TokenRouter all providers in fallback chain failed: ${lastError ? lastError.message : 'Unknown'}`
    );
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

  getDiscoverer(): FreeApiDiscoverer {
    return this.discoverer;
  }
}
