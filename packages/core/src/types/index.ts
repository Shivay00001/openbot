/**
 * OpenBot Core Types
 * The foundational type system for the entire platform.
 */

// ─── Model Provider Types ───────────────────────────────────────

export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'mistral'
  | 'cohere'
  | 'deepseek'
  | 'ollama'
  | 'lmstudio'
  | 'pollinations'
  | 'web2api'
  | 'tokenrouter'
  | 'openrouter'
  | 'custom';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  /** For local models — context window size */
  contextLength?: number;
}

export interface ModelProviderConfig {
  provider: ModelProvider;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  isLocal: boolean;
  /** Display name for UI */
  displayName: string;
  /** Provider icon identifier */
  icon: string;
}

// ─── Message Types ──────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  /** Tool call results or metadata */
  metadata?: Record<string, unknown>;
  /** Tool calls requested by the assistant */
  toolCalls?: ToolCall[];
  /** If this is a tool response, the tool call ID it responds to */
  toolCallId?: string;
  /** Timestamp */
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
  /** Duration in milliseconds */
  durationMs?: number;
}

// ─── Conversation Types ─────────────────────────────────────────

export type ConversationMode = 'chat' | 'agent' | 'phone' | 'voice';

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  mode: ConversationMode;
  modelConfig: ModelConfig;
  messages: Message[];
  settings: ConversationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationSettings {
  /** System prompt */
  systemPrompt?: string;
  /** Persona/character name */
  persona?: string;
  /** Max context messages to include */
  maxContextMessages?: number;
  /** Enable web search */
  webSearchEnabled?: boolean;
  /** Enable code execution */
  codeExecutionEnabled?: boolean;
  /** Enable file access */
  fileAccessEnabled?: boolean;
  /** Enable browser control */
  browserControlEnabled?: boolean;
  /** Enable phone/desktop control */
  deviceControlEnabled?: boolean;
}

// ─── Agent / Task Types ─────────────────────────────────────────

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting_approval' | 'paused' | 'done' | 'error';
export type TaskStatus = 'pending' | 'planning' | 'running' | 'paused' | 'waiting_approval' | 'done' | 'failed' | 'cancelled';

export interface AgentState {
  status: AgentStatus;
  currentTask?: Task;
  /** Steps completed in current task */
  stepsCompleted: number;
  /** Maximum steps allowed */
  maxSteps: number;
  /** Total tokens used */
  tokensUsed: number;
  /** Total cost (USD) */
  costUsd: number;
}

export interface Task {
  id: string;
  agentId: string;
  conversationId: string;
  objective: string;
  status: TaskStatus;
  plan: TaskStep[];
  currentStepIndex: number;
  result?: TaskResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskStep {
  id: string;
  index: number;
  description: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: unknown;
  status: TaskStatus;
  /** Reasoning for this step */
  reasoning?: string;
  durationMs?: number;
}

export interface TaskResult {
  summary: string;
  outputs: TaskOutput[];
  metadata?: Record<string, unknown>;
}

export interface TaskOutput {
  type: 'text' | 'file' | 'image' | 'code' | 'url' | 'data';
  content: string;
  mimeType?: string;
  filename?: string;
}

// ─── Tool Types ─────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  /** JSON Schema for parameters */
  parameters: Record<string, unknown>;
  /** Whether this tool requires user approval before execution */
  requiresApproval: boolean;
  /** Whether this tool is available in the current environment */
  isAvailable: boolean;
  /** Permission level needed */
  permissionLevel: PermissionLevel;
}

export type ToolCategory =
  | 'search'
  | 'browser'
  | 'filesystem'
  | 'terminal'
  | 'communication'
  | 'media'
  | 'device'
  | 'code'
  | 'data'
  | 'integration'
  | 'utility';

export type PermissionLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface ToolExecutionContext {
  userId: string;
  conversationId: string;
  taskId?: string;
  /** Approved permissions for this session */
  permissions: Permission[];
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

// ─── Permission Types ───────────────────────────────────────────

export type PermissionAction = 'allow_once' | 'always_allow' | 'deny' | 'ask';

export interface Permission {
  id: string;
  userId: string;
  toolName: string;
  action: PermissionAction;
  /** Optional scope restriction */
  scope?: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  stepId: string;
  toolName: string;
  description: string;
  /** What the tool will do */
  action: string;
  /** Potential risks */
  risks: string[];
  /** Request timestamp */
  createdAt: Date;
}

// ─── Skill Types ────────────────────────────────────────────────

export interface Skill {
  id: string;
  userId: string;
  name: string;
  description: string;
  /** Skill definition */
  definition: SkillDefinition;
  /** Whether shared with community */
  isPublic: boolean;
  /** Tags for discovery */
  tags: string[];
  /** Usage count */
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillDefinition {
  /** Trigger conditions */
  triggers?: SkillTrigger[];
  /** Steps to execute */
  steps: SkillStep[];
  /** Input schema */
  inputSchema?: Record<string, unknown>;
  /** Output schema */
  outputSchema?: Record<string, unknown>;
}

export interface SkillTrigger {
  type: 'cron' | 'event' | 'keyword' | 'manual';
  value: string;
}

export interface SkillStep {
  type: 'prompt' | 'tool' | 'condition' | 'loop';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  condition?: string;
}

// ─── Memory Types ───────────────────────────────────────────────

export interface Memory {
  id: string;
  userId: string;
  content: string;
  category: MemoryCategory;
  /** Vector embedding for semantic search */
  embedding?: number[];
  /** Importance score 0-1 */
  importance: number;
  /** Source of the memory */
  source: string;
  createdAt: Date;
}

export type MemoryCategory =
  | 'fact'           // User stated facts
  | 'preference'     // User preferences
  | 'instruction'    // Standing instructions
  | 'context'        // Contextual information
  | 'task_outcome'   // Past task results
  | 'skill_learned'; // Learned patterns

// ─── Event Types ────────────────────────────────────────────────

export type OpenBotEvent =
  | { type: 'message:new'; data: Message }
  | { type: 'message:stream'; data: { messageId: string; chunk: string; done: boolean } }
  | { type: 'agent:status'; data: AgentState }
  | { type: 'task:created'; data: Task }
  | { type: 'task:step'; data: { taskId: string; step: TaskStep } }
  | { type: 'task:complete'; data: { taskId: string; result: TaskResult } }
  | { type: 'task:error'; data: { taskId: string; error: string } }
  | { type: 'approval:request'; data: ApprovalRequest }
  | { type: 'approval:response'; data: { requestId: string; action: PermissionAction } }
  | { type: 'tool:executing'; data: { toolName: string; input: Record<string, unknown> } }
  | { type: 'tool:result'; data: ToolResult }
  | { type: 'error'; data: { code: string; message: string } };

// ─── User Types ─────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  /** Default model configuration */
  defaultModel: ModelConfig;
  /** Configured model providers (BYOK) */
  providers: ModelProviderConfig[];
  /** Default system prompt */
  defaultSystemPrompt?: string;
  /** Theme preference */
  theme: 'light' | 'dark' | 'system';
  /** Voice settings */
  voice?: {
    enabled: boolean;
    ttsModel?: string;
    sttModel?: string;
    wakeWord?: string;
  };
  /** Privacy settings */
  privacy: {
    saveConversations: boolean;
    saveMemory: boolean;
    analyticsEnabled: boolean;
  };
}

// ─── API Response Types ─────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

// ─── Streaming Types ────────────────────────────────────────────

export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'thinking' | 'done' | 'error';
  data: string | ToolCall | ToolResult | null;
}

export type StreamCallback = (event: StreamEvent) => void;
