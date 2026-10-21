"use strict";
/**
 * OpenBot Agent Loop Engine
 * The core ReAct (Reason + Act) loop that powers autonomous task execution.
 *
 * Implements: Plan → Execute → Observe → Reflect → Repeat
 *
 * Inspired by: GrokBot (persistent execution), Manus (autonomous planning),
 * OpenAI Dot (always-on), Gemini Spark (proactive intelligence)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentLoop = void 0;
exports.createAgent = createAgent;
const uuid_1 = require("uuid");
const eventemitter3_1 = require("eventemitter3");
// ─── Default System Prompt ──────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `You are OpenBot, a powerful and versatile AI assistant. You are capable of:

1. **Conversational AI**: Natural, helpful dialogue with deep knowledge
2. **Task Execution**: Breaking down complex goals into actionable steps
3. **Tool Use**: Leveraging available tools to accomplish real-world tasks
4. **Creative Work**: Writing, coding, analysis, and content creation
5. **Research**: Finding and synthesizing information from the web

## Guidelines:
- Be concise but thorough. Prioritize accuracy over speed.
- When using tools, explain what you're doing and why.
- If a task requires multiple steps, create a plan first and confirm with the user.
- If you're unsure about something, say so honestly.
- For risky actions (file changes, terminal commands, purchases), always explain the implications first.
- Respect user privacy. Never store or share sensitive information.

## Tool Usage:
When you need to perform actions beyond conversation, use the available tools. Always:
1. Choose the most appropriate tool for the job
2. Explain what you're about to do
3. Execute the tool
4. Report the results clearly

Current date/time: ${new Date().toISOString()}`;
// ─── Agent Loop Engine ──────────────────────────────────────────
class AgentLoop extends eventemitter3_1.EventEmitter {
    config;
    modelRouter;
    toolRegistry;
    state;
    messages = [];
    abortController = null;
    constructor(config, modelRouter, toolRegistry) {
        super();
        this.config = {
            maxSteps: 25,
            maxTokensPerTurn: 8192,
            maxTotalTokens: 100000,
            autonomousMode: true,
            streaming: true,
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
            ...config,
            id: config.id || (0, uuid_1.v4)(),
        };
        this.modelRouter = modelRouter;
        this.toolRegistry = toolRegistry;
        this.state = {
            status: 'idle',
            stepsCompleted: 0,
            maxSteps: this.config.maxSteps,
            tokensUsed: 0,
            costUsd: 0,
        };
        // Initialize with system message
        this.messages.push({
            id: (0, uuid_1.v4)(),
            role: 'system',
            content: this.config.systemPrompt,
            createdAt: new Date(),
        });
    }
    /**
     * Get current agent state
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Get conversation messages
     */
    getMessages() {
        return [...this.messages];
    }
    /**
     * Load existing conversation messages
     */
    loadMessages(messages) {
        this.messages = [this.messages[0], ...messages]; // Keep system message
    }
    /**
     * Process a user message — the main entry point.
     * This starts the ReAct loop:
     * 1. Add user message
     * 2. Get model response
     * 3. If response contains tool calls → execute tools → loop back to 2
     * 4. If response is plain text → return to user
     */
    async processMessage(userMessage) {
        // Add user message
        const userMsg = {
            id: (0, uuid_1.v4)(),
            role: 'user',
            content: userMessage,
            createdAt: new Date(),
        };
        this.messages.push(userMsg);
        this.emitEvent({ type: 'message:new', data: userMsg });
        // Update state
        this.setStatus('thinking');
        this.abortController = new AbortController();
        try {
            // Enter the ReAct loop
            const response = await this.reactLoop();
            this.setStatus('idle');
            return response;
        }
        catch (error) {
            this.setStatus('error');
            const errorMsg = {
                id: (0, uuid_1.v4)(),
                role: 'assistant',
                content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
                metadata: { error: true },
                createdAt: new Date(),
            };
            this.messages.push(errorMsg);
            this.emitEvent({ type: 'message:new', data: errorMsg });
            return errorMsg;
        }
    }
    /**
     * The core ReAct loop
     */
    async reactLoop() {
        let stepCount = 0;
        const maxSteps = this.config.maxSteps;
        while (stepCount < maxSteps) {
            // Check abort
            if (this.abortController?.signal.aborted) {
                throw new Error('Agent execution was cancelled.');
            }
            stepCount++;
            this.state.stepsCompleted = stepCount;
            // Get model completion
            const tools = this.toolRegistry.getToolDefinitions();
            const completionParams = {
                messages: this.getContextWindow(),
                tools: tools.length > 0 ? tools : undefined,
                modelConfig: this.config.modelConfig,
            };
            let result;
            if (this.config.streaming) {
                result = await this.streamCompletion(completionParams);
            }
            else {
                result = await this.modelRouter.complete(completionParams);
            }
            // Track usage
            this.state.tokensUsed += result.usage.totalTokens;
            this.state.costUsd += result.costUsd;
            // Check if model wants to use tools
            if (result.toolCalls?.length) {
                // Add assistant message with tool calls
                const assistantMsg = {
                    id: (0, uuid_1.v4)(),
                    role: 'assistant',
                    content: result.content || '',
                    toolCalls: result.toolCalls,
                    createdAt: new Date(),
                };
                this.messages.push(assistantMsg);
                this.emitEvent({ type: 'message:new', data: assistantMsg });
                // Execute each tool call
                this.setStatus('executing');
                for (const toolCall of result.toolCalls) {
                    this.emitEvent({
                        type: 'tool:executing',
                        data: { toolName: toolCall.name, input: toolCall.arguments },
                    });
                    const toolResult = await this.executeTool(toolCall);
                    this.emitEvent({ type: 'tool:result', data: toolResult });
                    // Add tool result as a message
                    const toolMsg = {
                        id: (0, uuid_1.v4)(),
                        role: 'tool',
                        content: typeof toolResult.result === 'string'
                            ? toolResult.result
                            : JSON.stringify(toolResult.result, null, 2),
                        toolCallId: toolCall.id,
                        metadata: {
                            toolName: toolCall.name,
                            error: toolResult.error,
                            durationMs: toolResult.durationMs,
                        },
                        createdAt: new Date(),
                    };
                    this.messages.push(toolMsg);
                }
                // Continue the loop — model will see tool results and may call more tools
                this.setStatus('thinking');
                continue;
            }
            // No tool calls — this is the final response
            const finalMsg = {
                id: (0, uuid_1.v4)(),
                role: 'assistant',
                content: result.content,
                metadata: {
                    usage: result.usage,
                    costUsd: result.costUsd,
                    latencyMs: result.latencyMs,
                    stepsUsed: stepCount,
                },
                createdAt: new Date(),
            };
            this.messages.push(finalMsg);
            this.emitEvent({ type: 'message:new', data: finalMsg });
            return finalMsg;
        }
        // Hit max steps
        const limitMsg = {
            id: (0, uuid_1.v4)(),
            role: 'assistant',
            content: `I've reached the maximum number of steps (${maxSteps}). Here's what I've accomplished so far. Would you like me to continue?`,
            metadata: { maxStepsReached: true },
            createdAt: new Date(),
        };
        this.messages.push(limitMsg);
        this.emitEvent({ type: 'message:new', data: limitMsg });
        return limitMsg;
    }
    /**
     * Stream a completion and accumulate the result
     */
    async streamCompletion(params) {
        const streamId = (0, uuid_1.v4)();
        let fullContent = '';
        const toolCalls = [];
        const start = Date.now();
        const stream = this.modelRouter.stream(params);
        for await (const event of stream) {
            switch (event.type) {
                case 'text':
                    fullContent += event.data;
                    this.emitEvent({
                        type: 'message:stream',
                        data: { messageId: streamId, chunk: event.data, done: false },
                    });
                    break;
                case 'tool_call':
                    toolCalls.push(event.data);
                    break;
                case 'done':
                    this.emitEvent({
                        type: 'message:stream',
                        data: { messageId: streamId, chunk: '', done: true },
                    });
                    break;
            }
        }
        return {
            id: streamId,
            content: fullContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            costUsd: 0,
            latencyMs: Date.now() - start,
        };
    }
    /**
     * Execute a single tool call
     */
    async executeTool(toolCall) {
        const context = {
            userId: this.config.userId,
            conversationId: this.config.conversationId,
            permissions: [], // Will be populated from DB
            abortSignal: this.abortController?.signal,
        };
        const result = await this.toolRegistry.execute(toolCall.name, toolCall.arguments, context);
        result.toolCallId = toolCall.id;
        return result;
    }
    /**
     * Get the context window (limited messages to fit model context)
     */
    getContextWindow() {
        const maxMessages = 50; // Keep last N messages + system
        if (this.messages.length <= maxMessages) {
            return this.messages;
        }
        // Always include system message + recent messages
        return [
            this.messages[0], // system
            ...this.messages.slice(-maxMessages + 1),
        ];
    }
    /**
     * Cancel the current execution
     */
    cancel() {
        this.abortController?.abort();
        this.setStatus('idle');
    }
    /**
     * Reset the agent state
     */
    reset() {
        this.cancel();
        this.messages = [this.messages[0]]; // Keep system message
        this.state = {
            status: 'idle',
            stepsCompleted: 0,
            maxSteps: this.config.maxSteps,
            tokensUsed: 0,
            costUsd: 0,
        };
    }
    /**
     * Update model configuration at runtime
     */
    updateModelConfig(config) {
        this.config.modelConfig = { ...this.config.modelConfig, ...config };
    }
    /**
     * Update system prompt
     */
    updateSystemPrompt(prompt) {
        this.config.systemPrompt = prompt;
        if (this.messages.length > 0 && this.messages[0].role === 'system') {
            this.messages[0].content = prompt;
        }
    }
    // ─── Internal Helpers ───────────────────────────────────────────
    setStatus(status) {
        this.state.status = status;
        this.emitEvent({ type: 'agent:status', data: { ...this.state } });
    }
    emitEvent(event) {
        this.emit(event.type, event);
        this.emit('*', event); // Wildcard listener
    }
}
exports.AgentLoop = AgentLoop;
// ─── Agent Factory ──────────────────────────────────────────────
function createAgent(config, modelRouter, toolRegistry) {
    return new AgentLoop(config, modelRouter, toolRegistry);
}
//# sourceMappingURL=index.js.map