/**
 * @openbot/shared-types — Data Transfer Objects (DTOs)
 * Validation-ready shapes for service inputs.
 */

// ─── Pagination ─────────────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ─── Search ─────────────────────────────────────────────────

export interface SearchQuery extends PaginationQuery {
  q?: string;
  filters?: Record<string, string | number | boolean>;
}

// ─── User Update ────────────────────────────────────────────

export interface UpdateUserDto {
  name?: string;
  avatarUrl?: string;
  settings?: Record<string, unknown>;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

// ─── Conversation ───────────────────────────────────────────

export interface UpdateConversationDto {
  title?: string;
  isPinned?: boolean;
  isArchived?: boolean;
  modelConfig?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

// ─── Skill ──────────────────────────────────────────────────

export interface UpdateSkillDto {
  name?: string;
  description?: string;
  definition?: Record<string, unknown>;
  isPublic?: boolean;
  tags?: string[];
}

export interface ExecuteSkillDto {
  input?: Record<string, unknown>;
  dryRun?: boolean;
}

// ─── Memory ─────────────────────────────────────────────────

export interface CreateMemoryDto {
  content: string;
  category?: string;
  importance?: number;
}

// ─── Task Job ───────────────────────────────────────────────

export interface CreateTaskDto {
  type: string;
  payload: Record<string, unknown>;
  priority?: number;
  scheduledAt?: string;
  conversationId?: string;
}

// ─── Model Config ───────────────────────────────────────────

export interface ModelConfigDto {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}
