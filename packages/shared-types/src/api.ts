/**
 * @openbot/shared-types — API Contracts
 * HTTP endpoint request/response shapes shared between services and clients.
 */

// ─── Generic API Wrapper ────────────────────────────────────

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
    cursor?: string;
  };
}

// ─── Auth ───────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

// ─── Conversations ──────────────────────────────────────────

export interface CreateConversationRequest {
  title?: string;
  mode?: string;
  modelConfig?: Record<string, unknown>;
}

export interface ConversationSummary {
  id: string;
  title: string;
  mode: string;
  messageCount: number;
  lastMessagePreview: string | null;
  updatedAt: string;
}

// ─── Chat / Inference ───────────────────────────────────────

export interface ChatRequest {
  conversationId: string;
  message: string;
  model?: string;
  provider?: string;
  isZeroCloud?: boolean;
  streaming?: boolean;
  tools?: string[];
}

export interface ChatResponse {
  messageId: string;
  role: 'assistant';
  content: string;
  thinking?: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: unknown }>;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
  };
  latencyMs: number;
}

// ─── BYOK API Keys ──────────────────────────────────────────

export interface SaveApiKeyRequest {
  provider: string;
  apiKey: string;
  label?: string;
  baseUrl?: string;
}

export interface ApiKeyInfo {
  id: string;
  provider: string;
  label: string | null;
  baseUrl: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  maskedKey: string; // last 4 chars only
}

// ─── Skills ─────────────────────────────────────────────────

export interface CreateSkillRequest {
  name: string;
  description?: string;
  definition: Record<string, unknown>;
  isPublic?: boolean;
  tags?: string[];
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  tags: string[];
  usageCount: number;
  createdAt: string;
}

// ─── Billing & Usage ────────────────────────────────────────

export interface BillingInfo {
  plan: string;
  tokensUsed: number;
  tokenLimit: number;
  percentUsed: number;
  resetDate: string;
}

export interface UsageSummary {
  totalTokens: number;
  totalCostUsd: number;
  byProvider: Array<{
    provider: string;
    tokens: number;
    costUsd: number;
    requestCount: number;
  }>;
  period: { start: string; end: string };
}

// ─── Voice Calls ────────────────────────────────────────────

export interface StartCallRequest {
  recipientNumber: string;
  purpose: string;
  instructions: string;
  persona?: string;
}

export interface CallStatus {
  callId: string;
  status: string;
  durationSeconds: number;
  transcript: Array<{ speaker: string; text: string; timestamp: number }>;
  outcome?: {
    success: boolean;
    summary: string;
    appointmentTime?: string;
    confirmationCode?: string;
  };
}

// ─── Models ─────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  provider: string;
  displayName: string;
  isLocal: boolean;
  contextLength: number;
  costPer1MInput: number;
  costPer1MOutput: number;
}

export interface ProviderStatus {
  provider: string;
  displayName: string;
  isHealthy: boolean;
  modelCount: number;
  isLocal: boolean;
}
