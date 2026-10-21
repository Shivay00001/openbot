/**
 * @openbot/shared-types — Real-Time Event Types
 * WebSocket event contracts shared between realtime-server and all clients.
 */

// ─── Client → Server Events ────────────────────────────────

export interface ClientToServerEvents {
  /** Join a conversation room for real-time updates */
  'conversation:join': (data: { conversationId: string }) => void;
  /** Leave a conversation room */
  'conversation:leave': (data: { conversationId: string }) => void;
  /** Send a chat message */
  'chat:send': (data: { conversationId: string; message: string; model?: string }) => void;
  /** Cancel an in-progress agent execution */
  'agent:cancel': (data: { conversationId: string }) => void;
  /** Respond to an approval request */
  'approval:respond': (data: { requestId: string; action: string }) => void;
  /** Phone mode: send a gesture command */
  'phone:gesture': (data: { deviceId: string; gesture: string; params: Record<string, unknown> }) => void;
  /** Artemis mobile workflow command */
  'artemis:workflow': (data: { goal: string; deviceType?: string }) => void;
  /** Desktop mode: send a command */
  'desktop:command': (data: { command: string; args: Record<string, unknown> }) => void;
  /** Browser mode: navigate or interact */
  'browser:action': (data: { tabId: string; action: string; params: Record<string, unknown> }) => void;
  /** Voice: start/stop listening */
  'voice:control': (data: { action: 'start' | 'stop' | 'mute' | 'unmute' }) => void;
  /** vFlow: voice command dispatch */
  'vflow:command': (data: { utterance: string; options?: Record<string, unknown> }) => void;
  /** Episodic memory query */
  'episodic:query': (data: { goal: string; userId: string }) => void;
}

// ─── Server → Client Events ────────────────────────────────

export interface ServerToClientEvents {
  /** Streaming text chunk */
  'message:stream': (data: { messageId: string; chunk: string; done: boolean }) => void;
  /** Complete new message */
  'message:new': (data: { id: string; role: string; content: string; metadata?: Record<string, unknown> }) => void;
  /** Agent status update */
  'agent:status': (data: { status: string; stepsCompleted: number; tokensUsed: number; costUsd: number }) => void;
  /** Tool is being executed */
  'tool:executing': (data: { toolName: string; input: Record<string, unknown> }) => void;
  /** Tool result */
  'tool:result': (data: { toolName: string; result: unknown; error?: string; durationMs: number }) => void;
  /** Approval required for a tool execution */
  'approval:request': (data: { requestId: string; toolName: string; description: string; risks: string[] }) => void;
  /** Phone screen state update */
  'phone:screen': (data: { screenshot: string; elements: unknown[]; activeApp: string }) => void;
  /** Desktop screen state update */
  'desktop:screen': (data: { screenshot: string; windows: unknown[]; activeProcess: string }) => void;
  /** Browser tab update */
  'browser:update': (data: { tabId: string; url: string; title: string; screenshot?: string }) => void;
  /** Voice transcript update */
  'voice:transcript': (data: { speaker: string; text: string; isFinal: boolean }) => void;
  /** Task job status update */
  'task:update': (data: { taskId: string; status: string; progress?: number; result?: unknown }) => void;
  /** Error event */
  'error': (data: { code: string; message: string }) => void;
}

// ─── Inter-Service Events (Redis Pub/Sub) ───────────────────

export interface InternalEvents {
  /** AI Engine completed inference */
  'inference:complete': { conversationId: string; messageId: string; content: string; usage: Record<string, number> };
  /** Task Runner job update */
  'job:update': { jobId: string; status: string; result?: unknown; error?: string };
  /** Voice call status change */
  'call:status': { callId: string; status: string; transcript?: Array<{ speaker: string; text: string }> };
  /** User quota exceeded */
  'billing:quota_exceeded': { userId: string; plan: string; tokensUsed: number; tokenLimit: number };
}
