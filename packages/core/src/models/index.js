"use strict";
/**
 * OpenBot Model Router
 * Unified interface to all LLM providers — cloud and local.
 * Supports BYOK (Bring Your Own Key) for every provider.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PROVIDERS = exports.ModelRouter = exports.OpenAICompatibleAdapter = void 0;
const openai_1 = __importDefault(require("openai"));
const uuid_1 = require("uuid");
// ─── Cost Table (per 1M tokens) ─────────────────────────────────
const COST_TABLE = {
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10, output: 30 },
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
    'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
    'claude-opus-4-20250514': { input: 15, output: 75 },
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'gemini-2.5-pro': { input: 1.25, output: 10 },
    'grok-3': { input: 3, output: 15 },
    'mistral-large-latest': { input: 2, output: 6 },
    'mistral-small-latest': { input: 0.1, output: 0.3 },
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'command-r-plus': { input: 2.5, output: 10 },
    // Local models are free
    'ollama:*': { input: 0, output: 0 },
    'lmstudio:*': { input: 0, output: 0 },
};
function estimateCost(model, promptTokens, completionTokens) {
    const costs = COST_TABLE[model] || COST_TABLE[`${model.split(':')[0]}:*`] || { input: 0, output: 0 };
    return (promptTokens * costs.input + completionTokens * costs.output) / 1_000_000;
}
// ─── OpenAI-Compatible Adapter ──────────────────────────────────
// Works for: OpenAI, Anthropic (via proxy), xAI, Mistral, Ollama, LM Studio,
// DeepSeek, and any OpenAI-compatible endpoint.
class OpenAICompatibleAdapter {
    client;
    providerName;
    constructor(config) {
        this.providerName = config.provider;
        this.client = new openai_1.default({
            apiKey: config.apiKey || 'not-needed',
            baseURL: config.baseUrl || this.getDefaultBaseUrl(config.provider),
            dangerouslyAllowBrowser: false,
        });
    }
    getDefaultBaseUrl(provider) {
        switch (provider) {
            case 'openai': return 'https://api.openai.com/v1';
            case 'anthropic': return 'https://api.anthropic.com/v1';
            case 'google': return 'https://generativelanguage.googleapis.com/v1beta/openai';
            case 'xai': return 'https://api.x.ai/v1';
            case 'mistral': return 'https://api.mistral.ai/v1';
            case 'deepseek': return 'https://api.deepseek.com/v1';
            case 'cohere': return 'https://api.cohere.com/v2';
            case 'ollama': return 'http://localhost:11434/v1';
            case 'lmstudio': return 'http://localhost:1234/v1';
            case 'custom': return 'http://localhost:8080/v1';
            default: return 'http://localhost:11434/v1';
        }
    }
    formatMessages(messages) {
        return messages.map((msg) => {
            if (msg.role === 'tool' && msg.toolCallId) {
                return {
                    role: 'tool',
                    content: msg.content,
                    tool_call_id: msg.toolCallId,
                };
            }
            if (msg.role === 'assistant' && msg.toolCalls?.length) {
                return {
                    role: 'assistant',
                    content: msg.content || null,
                    tool_calls: msg.toolCalls.map((tc) => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.arguments),
                        },
                    })),
                };
            }
            return {
                role: msg.role,
                content: msg.content,
            };
        });
    }
    formatTools(tools) {
        if (!tools?.length)
            return undefined;
        return tools.map((tool) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
            },
        }));
    }
    async complete(params) {
        const start = Date.now();
        const response = await this.client.chat.completions.create({
            model: params.modelConfig.model,
            messages: this.formatMessages(params.messages),
            tools: this.formatTools(params.tools),
            temperature: params.modelConfig.temperature ?? 0.7,
            max_tokens: params.modelConfig.maxTokens ?? 4096,
            top_p: params.modelConfig.topP,
            frequency_penalty: params.modelConfig.frequencyPenalty,
            presence_penalty: params.modelConfig.presencePenalty,
            stop: params.stop || params.modelConfig.stop,
            ...(params.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        });
        const latencyMs = Date.now() - start;
        const choice = response.choices[0];
        const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        const toolCalls = choice.message.tool_calls?.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}'),
        }));
        return {
            id: response.id || (0, uuid_1.v4)(),
            content: choice.message.content || '',
            toolCalls,
            finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
            usage: {
                promptTokens: usage.prompt_tokens,
                completionTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
            },
            costUsd: estimateCost(params.modelConfig.model, usage.prompt_tokens, usage.completion_tokens),
            latencyMs,
        };
    }
    async *stream(params) {
        const response = await this.client.chat.completions.create({
            model: params.modelConfig.model,
            messages: this.formatMessages(params.messages),
            tools: this.formatTools(params.tools),
            temperature: params.modelConfig.temperature ?? 0.7,
            max_tokens: params.modelConfig.maxTokens ?? 4096,
            stream: true,
        });
        const toolCallAccumulator = {};
        for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;
            if (!delta)
                continue;
            // Text content
            if (delta.content) {
                yield { type: 'text', data: delta.content };
            }
            // Tool calls (streamed in parts)
            if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                    if (!toolCallAccumulator[tc.index]) {
                        toolCallAccumulator[tc.index] = { id: tc.id || '', name: '', args: '' };
                    }
                    const acc = toolCallAccumulator[tc.index];
                    if (tc.id)
                        acc.id = tc.id;
                    if (tc.function?.name)
                        acc.name = tc.function.name;
                    if (tc.function?.arguments)
                        acc.args += tc.function.arguments;
                }
            }
            // Check if done
            if (chunk.choices[0]?.finish_reason) {
                // Emit accumulated tool calls
                for (const [, acc] of Object.entries(toolCallAccumulator)) {
                    const toolCall = {
                        id: acc.id,
                        name: acc.name,
                        arguments: JSON.parse(acc.args || '{}'),
                    };
                    yield { type: 'tool_call', data: toolCall };
                }
                yield { type: 'done', data: null };
                return;
            }
        }
        yield { type: 'done', data: null };
    }
    async listModels() {
        try {
            const response = await this.client.models.list();
            const models = [];
            for await (const model of response) {
                models.push(model.id);
            }
            return models;
        }
        catch {
            return [];
        }
    }
    async healthCheck() {
        try {
            await this.client.models.list();
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.OpenAICompatibleAdapter = OpenAICompatibleAdapter;
// ─── Model Router ───────────────────────────────────────────────
class ModelRouter {
    adapters = new Map();
    providerConfigs = [];
    fallbackChain = [];
    constructor() { }
    /**
     * Register a model provider (BYOK)
     */
    registerProvider(config) {
        const key = this.getProviderKey(config);
        const adapter = new OpenAICompatibleAdapter({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            provider: config.provider,
        });
        this.adapters.set(key, adapter);
        this.providerConfigs.push(config);
    }
    /**
     * Set the fallback chain for automatic retries
     */
    setFallbackChain(chain) {
        this.fallbackChain = chain;
    }
    /**
     * Get the adapter for a model config
     */
    getAdapter(config) {
        const key = `${config.provider}:${config.baseUrl || 'default'}`;
        let adapter = this.adapters.get(key);
        if (!adapter) {
            // Auto-create adapter from config
            adapter = new OpenAICompatibleAdapter({
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                provider: config.provider,
            });
            this.adapters.set(key, adapter);
        }
        return adapter;
    }
    /**
     * Complete with automatic fallback
     */
    async complete(params) {
        const adapter = this.getAdapter(params.modelConfig);
        try {
            return await adapter.complete(params);
        }
        catch (error) {
            // Try fallback chain
            for (const fallbackConfig of this.fallbackChain) {
                if (fallbackConfig.model === params.modelConfig.model)
                    continue;
                try {
                    const fallbackAdapter = this.getAdapter(fallbackConfig);
                    return await fallbackAdapter.complete({ ...params, modelConfig: fallbackConfig });
                }
                catch {
                    continue;
                }
            }
            throw error;
        }
    }
    /**
     * Stream with automatic fallback
     */
    async *stream(params) {
        const adapter = this.getAdapter(params.modelConfig);
        try {
            yield* adapter.stream(params);
        }
        catch (error) {
            // Try fallback chain
            for (const fallbackConfig of this.fallbackChain) {
                if (fallbackConfig.model === params.modelConfig.model)
                    continue;
                try {
                    const fallbackAdapter = this.getAdapter(fallbackConfig);
                    yield* fallbackAdapter.stream({ ...params, modelConfig: fallbackConfig });
                    return;
                }
                catch {
                    continue;
                }
            }
            throw error;
        }
    }
    /**
     * List all registered providers and their status
     */
    async getProviderStatus() {
        const results = [];
        for (const config of this.providerConfigs) {
            const adapter = this.adapters.get(this.getProviderKey(config));
            const healthy = adapter ? await adapter.healthCheck() : false;
            results.push({ provider: config, healthy });
        }
        return results;
    }
    /**
     * Get all available models across all providers
     */
    async getAllModels() {
        const results = [];
        for (const config of this.providerConfigs) {
            const adapter = this.adapters.get(this.getProviderKey(config));
            const models = adapter ? await adapter.listModels() : [];
            results.push({ provider: config.provider, models });
        }
        return results;
    }
    getProviderKey(config) {
        return `${config.provider}:${config.baseUrl || 'default'}`;
    }
}
exports.ModelRouter = ModelRouter;
// ─── Default Provider Configs ───────────────────────────────────
exports.DEFAULT_PROVIDERS = [
    {
        provider: 'openai',
        displayName: 'OpenAI',
        icon: 'openai',
        isLocal: false,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'],
    },
    {
        provider: 'anthropic',
        displayName: 'Anthropic',
        icon: 'anthropic',
        isLocal: false,
        models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    },
    {
        provider: 'google',
        displayName: 'Google Gemini',
        icon: 'google',
        isLocal: false,
        models: ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    },
    {
        provider: 'xai',
        displayName: 'xAI Grok',
        icon: 'xai',
        isLocal: false,
        models: ['grok-3', 'grok-3-mini', 'grok-2'],
    },
    {
        provider: 'mistral',
        displayName: 'Mistral AI',
        icon: 'mistral',
        isLocal: false,
        models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
    },
    {
        provider: 'deepseek',
        displayName: 'DeepSeek',
        icon: 'deepseek',
        isLocal: false,
        models: ['deepseek-chat', 'deepseek-reasoner'],
    },
    {
        provider: 'ollama',
        displayName: 'Ollama (Local)',
        icon: 'ollama',
        isLocal: true,
        baseUrl: 'http://localhost:11434/v1',
        models: ['llama3.1:8b', 'llama3.1:70b', 'mistral:7b', 'qwen2.5-coder:7b', 'gemma3:4b'],
    },
    {
        provider: 'lmstudio',
        displayName: 'LM Studio (Local)',
        icon: 'lmstudio',
        isLocal: true,
        baseUrl: 'http://localhost:1234/v1',
        models: [],
    },
];
//# sourceMappingURL=index.js.map