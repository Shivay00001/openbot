/**
 * OpenBot Memory System
 * Long-term context management with semantic search.
 * 
 * Provides:
 * - Conversation memory (per-thread history)
 * - Semantic memory (vector embeddings for similarity search)
 * - User preference learning
 * - Cross-session context retention
 */

import { v4 as uuid } from 'uuid';
import type { Memory, MemoryCategory, Message } from '../types/index.js';

export * from './types.js';
export { EpisodicMemoryEngine } from './episodic-memory.js';
export { IndexedDBMemoryStore } from './indexeddb-store.js';
export { DiskMemoryStore } from './disk-store.js';
export { CloudPrismaMemoryStore } from './cloud-prisma-store.js';
export type { PrismaDatabaseClient } from './cloud-prisma-store.js';
export { ReinforcementLearningEngine } from './reinforcement-engine.js';

// ─── Memory Store Interface ─────────────────────────────────────

export interface MemoryStore {
  /** Save a memory */
  save(memory: Memory): Promise<void>;
  /** Search memories by semantic similarity */
  search(query: string, userId: string, limit?: number): Promise<Memory[]>;
  /** Get memories by category */
  getByCategory(userId: string, category: MemoryCategory, limit?: number): Promise<Memory[]>;
  /** Delete a memory */
  delete(id: string): Promise<void>;
  /** Get all memories for a user */
  getAll(userId: string, limit?: number): Promise<Memory[]>;
}

// ─── In-Memory Store (Development) ──────────────────────────────

export class InMemoryStore implements MemoryStore {
  private memories: Map<string, Memory> = new Map();

  async save(memory: Memory): Promise<void> {
    this.memories.set(memory.id, memory);
  }

  async search(query: string, userId: string, limit = 10): Promise<Memory[]> {
    const queryLower = query.toLowerCase();
    const userMemories = Array.from(this.memories.values())
      .filter((m) => m.userId === userId);

    // Simple keyword matching (replace with vector search in production)
    const scored = userMemories.map((m) => {
      const content = m.content.toLowerCase();
      const words = queryLower.split(/\s+/);
      const matchCount = words.filter((w) => content.includes(w)).length;
      const score = matchCount / words.length;
      return { memory: m, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.memory);
  }

  async getByCategory(userId: string, category: MemoryCategory, limit = 20): Promise<Memory[]> {
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId && m.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.memories.delete(id);
  }

  async getAll(userId: string, limit = 100): Promise<Memory[]> {
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

// ─── Memory Manager ─────────────────────────────────────────────

export class MemoryManager {
  private store: MemoryStore;

  constructor(store?: MemoryStore) {
    this.store = store || new InMemoryStore();
  }

  /**
   * Extract and save important information from a conversation
   */
  async extractAndSave(userId: string, messages: Message[]): Promise<Memory[]> {
    const extracted: Memory[] = [];

    for (const msg of messages) {
      if (msg.role !== 'user') continue;

      const content = msg.content.toLowerCase();

      // Detect preferences
      if (this.isPreference(content)) {
        const memory: Memory = {
          id: uuid(),
          userId,
          content: msg.content,
          category: 'preference',
          importance: 0.7,
          source: 'conversation',
          createdAt: new Date(),
        };
        await this.store.save(memory);
        extracted.push(memory);
      }

      // Detect facts about the user
      if (this.isFact(content)) {
        const memory: Memory = {
          id: uuid(),
          userId,
          content: msg.content,
          category: 'fact',
          importance: 0.8,
          source: 'conversation',
          createdAt: new Date(),
        };
        await this.store.save(memory);
        extracted.push(memory);
      }

      // Detect standing instructions
      if (this.isInstruction(content)) {
        const memory: Memory = {
          id: uuid(),
          userId,
          content: msg.content,
          category: 'instruction',
          importance: 0.9,
          source: 'conversation',
          createdAt: new Date(),
        };
        await this.store.save(memory);
        extracted.push(memory);
      }
    }

    return extracted;
  }

  /**
   * Build a context string from relevant memories
   */
  async buildContext(userId: string, query: string): Promise<string> {
    const [relevant, instructions, preferences] = await Promise.all([
      this.store.search(query, userId, 5),
      this.store.getByCategory(userId, 'instruction', 5),
      this.store.getByCategory(userId, 'preference', 5),
    ]);

    const parts: string[] = [];

    if (instructions.length > 0) {
      parts.push('## Standing Instructions');
      instructions.forEach((m) => parts.push(`- ${m.content}`));
    }

    if (preferences.length > 0) {
      parts.push('\n## User Preferences');
      preferences.forEach((m) => parts.push(`- ${m.content}`));
    }

    if (relevant.length > 0) {
      parts.push('\n## Relevant Context');
      relevant.forEach((m) => parts.push(`- [${m.category}] ${m.content}`));
    }

    return parts.join('\n');
  }

  /**
   * Save a memory directly
   */
  async remember(userId: string, content: string, category: MemoryCategory = 'fact'): Promise<Memory> {
    const memory: Memory = {
      id: uuid(),
      userId,
      content,
      category,
      importance: 0.5,
      source: 'direct',
      createdAt: new Date(),
    };
    await this.store.save(memory);
    return memory;
  }

  /**
   * Forget a memory
   */
  async forget(id: string): Promise<void> {
    await this.store.delete(id);
  }

  /**
   * List all memories
   */
  async list(userId: string): Promise<Memory[]> {
    return this.store.getAll(userId);
  }

  // ─── Detection Heuristics ──────────────────────────────────────

  private isPreference(content: string): boolean {
    const markers = ['i prefer', 'i like', 'i want', 'i don\'t like', 'i hate', 'always use', 'never use',
      'my favorite', 'i usually', 'i typically', 'please always', 'please never'];
    return markers.some((m) => content.includes(m));
  }

  private isFact(content: string): boolean {
    const markers = ['my name is', 'i am', 'i work at', 'i live in', 'my email is',
      'i\'m a', 'my job is', 'my company', 'i study', 'my timezone'];
    return markers.some((m) => content.includes(m));
  }

  private isInstruction(content: string): boolean {
    const markers = ['always remember', 'from now on', 'going forward', 'remember that',
      'keep in mind', 'note that', 'important:', 'rule:'];
    return markers.some((m) => content.includes(m));
  }
}
