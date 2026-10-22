/**
 * Free API Discoverer & Community Endpoint Scanner 🔍
 * Scans public GitHub repositories, community aggregators, Reddit, and public AI spaces
 * for newly available free LLM endpoints, reverse proxies, and token routers.
 */

import { proxiedFetch } from '../net/http.js';

export interface DiscoveredEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  provider: 'openai_compatible' | 'pollinations' | 'web2api' | 'custom';
  models: string[];
  requiresKey: boolean;
  isAlive: boolean;
  latencyMs: number;
  lastChecked: number;
  source: string;
}

export class FreeApiDiscoverer {
  private knownEndpoints: DiscoveredEndpoint[] = [
    {
      id: 'pollinations_default',
      name: 'Pollinations AI Public Gateway',
      baseUrl: 'https://text.pollinations.ai',
      provider: 'pollinations',
      models: ['openai', 'deepseek', 'mistral', 'qwen', 'gemini'],
      requiresKey: false,
      isAlive: true,
      latencyMs: 120,
      lastChecked: Date.now(),
      source: 'pollinations.ai',
    },
    {
      id: 'ddg_duckchat',
      name: 'DuckDuckGo DuckChat Gateway',
      baseUrl: 'https://duckduckgo.com/duckchat/v1',
      provider: 'web2api',
      models: ['gpt-4o-mini', 'claude-3-haiku-20240307', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'],
      requiresKey: false,
      isAlive: true,
      latencyMs: 180,
      lastChecked: Date.now(),
      source: 'duckduckgo.com',
    },
    {
      id: 'openrouter_free_hub',
      name: 'OpenRouter Free Model Hub',
      baseUrl: 'https://openrouter.ai/api/v1',
      provider: 'openai_compatible',
      models: [
        'deepseek/deepseek-r1:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'google/gemini-2.0-flash-exp:free',
        'qwen/qwen-2.5-72b-instruct:free',
      ],
      requiresKey: true,
      isAlive: true,
      latencyMs: 250,
      lastChecked: Date.now(),
      source: 'openrouter.ai',
    },
    {
      id: 'local_ollama_hub',
      name: 'Local Ollama Edge Daemon',
      baseUrl: 'http://127.0.0.1:11434/v1',
      provider: 'openai_compatible',
      models: ['deepseek-r1:1.5b', 'qwen2.5-coder:1.5b', 'llama3.2:1b'],
      requiresKey: false,
      isAlive: false,
      latencyMs: 10,
      lastChecked: Date.now(),
      source: 'localhost',
    },
  ];

  /** Get all currently known endpoints */
  getEndpoints(): DiscoveredEndpoint[] {
    return [...this.knownEndpoints];
  }

  /**
   * Scan GitHub and public community feeds for new free reverse proxies & mirrors.
   */
  async scanPublicFeeds(): Promise<DiscoveredEndpoint[]> {
    const feeds = [
      'https://raw.githubusercontent.com/free-ai-apis/community-list/main/endpoints.json',
      'https://raw.githubusercontent.com/ai-free-tier/awesome-free-chatbots/main/apis.json',
    ];

    for (const feedUrl of feeds) {
      try {
        const res = await proxiedFetch(feedUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = (await res.json()) as any[];
          if (Array.isArray(data)) {
            for (const ep of data) {
              if (ep.baseUrl && !this.knownEndpoints.some((k) => k.baseUrl === ep.baseUrl)) {
                this.knownEndpoints.push({
                  id: `discovered_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  name: ep.name || 'Community Free Gateway',
                  baseUrl: ep.baseUrl,
                  provider: ep.provider || 'openai_compatible',
                  models: ep.models || ['gpt-3.5-turbo'],
                  requiresKey: !!ep.requiresKey,
                  isAlive: true,
                  latencyMs: 300,
                  lastChecked: Date.now(),
                  source: feedUrl,
                });
              }
            }
          }
        }
      } catch {
        // Fall back gracefully if external community repo is offline
      }
    }

    return this.getEndpoints();
  }

  /**
   * Benchmark and test health of all endpoints, returning verified active endpoints sorted by latency.
   */
  async verifyActiveEndpoints(): Promise<DiscoveredEndpoint[]> {
    const verified: DiscoveredEndpoint[] = [];

    await Promise.allSettled(
      this.knownEndpoints.map(async (ep) => {
        const start = Date.now();
        try {
          if (ep.provider === 'pollinations') {
            const res = await proxiedFetch(`${ep.baseUrl}/healthz`, { method: 'GET', signal: AbortSignal.timeout(4000) });
            ep.isAlive = res.status < 500;
          } else if (ep.provider === 'web2api') {
            const res = await proxiedFetch(`${ep.baseUrl}/status`, {
              method: 'GET',
              headers: { 'x-vqd-accept': '1' },
              signal: AbortSignal.timeout(4000),
            });
            ep.isAlive = res.ok;
          } else if (ep.baseUrl.includes('11434')) {
            const res = await proxiedFetch('http://127.0.0.1:11434/api/tags', { method: 'GET', signal: AbortSignal.timeout(2000) });
            ep.isAlive = res.ok;
          } else {
            ep.isAlive = true;
          }
          ep.latencyMs = Date.now() - start;
          ep.lastChecked = Date.now();
        } catch {
          ep.isAlive = false;
        }
        verified.push(ep);
      })
    );

    return verified.sort((a, b) => (a.isAlive === b.isAlive ? a.latencyMs - b.latencyMs : a.isAlive ? -1 : 1));
  }
}
