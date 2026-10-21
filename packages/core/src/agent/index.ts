/**
 * OpenBot Agent Loop Engine
 * The core ReAct (Reason + Act) loop that powers autonomous task execution.
 * 
 * Implements: Plan → Execute → Observe → Reflect → Repeat
 * 
 * Inspired by: GrokBot (persistent execution), Manus (autonomous planning),
 * OpenAI Dot (always-on), Gemini Spark (proactive intelligence)
 */

import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'eventemitter3';
import type { ModelRouter, CompletionParams, CompletionResult } from '../models/index.js';
import type { ToolRegistry } from '../tools/index.js';
import { setDefaultContentGenerator } from '../tools/index.js';
import type {
  Message,
  ToolCall,
  ToolResult,
  ModelConfig,
  AgentState,
  AgentStatus,
  Task,
  TaskStep,
  TaskStatus,
  TaskResult,
  TaskOutput,
  OpenBotEvent,
  ToolDefinition,
  StreamEvent,
  ToolExecutionContext,
  Permission,
} from '../types/index.js';

// ─── Agent Configuration ────────────────────────────────────────

export interface AgentConfig {
  /** Agent identifier */
  id?: string;
  /** Display name */
  name?: string;
  /** System prompt defining agent behavior */
  systemPrompt?: string;
  /** Model configuration */
  modelConfig: ModelConfig;
  /** Maximum steps per task (prevents infinite loops) */
  maxSteps?: number;
  /** Maximum tokens per conversation turn */
  maxTokensPerTurn?: number;
  /** Maximum total tokens per task */
  maxTotalTokens?: number;
  /** Whether to enable autonomous mode (agent can plan and execute multi-step tasks) */
  autonomousMode?: boolean;
  /** Enable streaming responses */
  streaming?: boolean;
  /** Zero-Cloud mode: block all non-local model calls for this agent */
  zeroCloud?: boolean;
  /** User ID for permission checks */
  userId: string;
  /** Conversation ID */
  conversationId: string;
}

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

export class AgentLoop extends EventEmitter<Record<string, [OpenBotEvent]>> {
  private config: AgentConfig;
  private modelRouter: ModelRouter;
  private toolRegistry: ToolRegistry;
  private state: AgentState;
  private messages: Message[] = [];
  private abortController: AbortController | null = null;

  constructor(
    config: AgentConfig,
    modelRouter: ModelRouter,
    toolRegistry: ToolRegistry
  ) {
    super();
    this.config = {
      maxSteps: 25,
      maxTokensPerTurn: 8192,
      maxTotalTokens: 100000,
      autonomousMode: true,
      streaming: true,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      ...config,
      id: config.id || uuid(),
    };
    this.modelRouter = modelRouter;
    this.toolRegistry = toolRegistry;

    // Zero-Cloud mode: enforce local-only model calls on the shared router.
    if (this.config.zeroCloud) {
      this.modelRouter.setZeroCloudMode(true);
    }

    // Wire the generate_content tool to this agent's model router.
    setDefaultContentGenerator(async ({ prompt, format, maxLength }) => {
      const messages: Message[] = [
        {
          id: uuid(),
          role: 'user',
          content:
            prompt +
            (format ? `\n\nFormat: ${format}` : '') +
            (maxLength ? `\nKeep it under roughly ${maxLength} characters.` : ''),
          createdAt: new Date(),
        },
      ];
      const result = await this.modelRouter.complete({
        messages,
        modelConfig: this.config.modelConfig,
      });
      return result.content;
    });

    this.state = {
      status: 'idle',
      stepsCompleted: 0,
      maxSteps: this.config.maxSteps!,
      tokensUsed: 0,
      costUsd: 0,
    };

    // Initialize with system message
    this.messages.push({
      id: uuid(),
      role: 'system',
      content: this.config.systemPrompt!,
      createdAt: new Date(),
    });
  }

  /**
   * Get current agent state
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Get conversation messages
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Load existing conversation messages
   */
  loadMessages(messages: Message[]): void {
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
  async processMessage(userMessage: string): Promise<Message> {
    // Add user message
    const userMsg: Message = {
      id: uuid(),
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
    } catch (error) {
      this.setStatus('error');
      const errorMsg: Message = {
        id: uuid(),
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
  private async reactLoop(): Promise<Message> {
    let stepCount = 0;
    const maxSteps = this.config.maxSteps!;

    while (stepCount < maxSteps) {
      // Check abort
      if (this.abortController?.signal.aborted) {
        throw new Error('Agent execution was cancelled.');
      }

      stepCount++;
      this.state.stepsCompleted = stepCount;

      // Get model completion
      const tools = this.toolRegistry.getToolDefinitions();
      const completionParams: CompletionParams = {
        messages: this.getContextWindow(),
        tools: tools.length > 0 ? tools : undefined,
        modelConfig: this.config.modelConfig,
      };

      let result: CompletionResult;

      if (this.config.streaming) {
        result = await this.streamCompletion(completionParams);
      } else {
        result = await this.modelRouter.complete(completionParams);
      }

      // Track usage
      this.state.tokensUsed += result.usage.totalTokens;
      this.state.costUsd += result.costUsd;

      // Check if model wants to use tools
      if (result.toolCalls?.length) {
        // Add assistant message with tool calls
        const assistantMsg: Message = {
          id: uuid(),
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
          const toolMsg: Message = {
            id: uuid(),
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
      const finalMsg: Message = {
        id: uuid(),
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
    const limitMsg: Message = {
      id: uuid(),
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
  private async streamCompletion(params: CompletionParams): Promise<CompletionResult> {
    const streamId = uuid();
    let fullContent = '';
    const toolCalls: ToolCall[] = [];
    const start = Date.now();

    const stream = this.modelRouter.stream(params);

    for await (const event of stream) {
      switch (event.type) {
        case 'text':
          fullContent += event.data as string;
          this.emitEvent({
            type: 'message:stream',
            data: { messageId: streamId, chunk: event.data as string, done: false },
          });
          break;

        case 'tool_call':
          toolCalls.push(event.data as ToolCall);
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
  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const context: ToolExecutionContext = {
      userId: this.config.userId,
      conversationId: this.config.conversationId,
      permissions: [], // Will be populated from DB
      abortSignal: this.abortController?.signal,
    };

    const result = await this.toolRegistry.execute(
      toolCall.name,
      toolCall.arguments,
      context
    );

    result.toolCallId = toolCall.id;
    return result;
  }

  /**
   * Get the context window (limited messages to fit model context)
   */
  private getContextWindow(): Message[] {
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
  cancel(): void {
    this.abortController?.abort();
    this.setStatus('idle');
  }

  /**
   * Reset the agent state
   */
  reset(): void {
    this.cancel();
    this.messages = [this.messages[0]]; // Keep system message
    this.state = {
      status: 'idle',
      stepsCompleted: 0,
      maxSteps: this.config.maxSteps!,
      tokensUsed: 0,
      costUsd: 0,
    };
  }

  /**
   * Update model configuration at runtime
   */
  updateModelConfig(config: Partial<ModelConfig>): void {
    this.config.modelConfig = { ...this.config.modelConfig, ...config };
  }

  /**
   * Update system prompt
   */
  updateSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      this.messages[0].content = prompt;
    }
  }

  // ─── Internal Helpers ───────────────────────────────────────────

  private setStatus(status: AgentStatus): void {
    this.state.status = status;
    this.emitEvent({ type: 'agent:status', data: { ...this.state } });
  }

  private emitEvent(event: OpenBotEvent): void {
    this.emit(event.type, event);
    this.emit('*', event); // Wildcard listener
  }
}

// ─── Agent Factory ──────────────────────────────────────────────

export function createAgent(
  config: AgentConfig,
  modelRouter: ModelRouter,
  toolRegistry: ToolRegistry
): AgentLoop {
  return new AgentLoop(config, modelRouter, toolRegistry);
}
