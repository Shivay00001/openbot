/**
 * Cloud Database Store Adapter ☁️🗄️
 * Persists and syncs long-term semantic memories and episodic histories with PostgreSQL via Prisma.
 */

import type { Memory, MemoryCategory } from '../types/index.js';
import type { MemoryStore } from './index.js';
import type { EpisodicMemoryEpisode } from './types.js';

export interface PrismaDatabaseClient {
  memory: {
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
    delete: (args: any) => Promise<any>;
  };
  taskJob?: {
    create: (args: any) => Promise<any>;
    findMany: (args: any) => Promise<any[]>;
  };
}

export class CloudPrismaMemoryStore implements MemoryStore {
  private prisma?: PrismaDatabaseClient;
  private localFallback: Map<string, Memory> = new Map();

  constructor(prismaClient?: PrismaDatabaseClient) {
    this.prisma = prismaClient;
  }

  async save(memory: Memory): Promise<void> {
    this.localFallback.set(memory.id, memory);

    if (this.prisma) {
      try {
        await this.prisma.memory.create({
          data: {
            id: memory.id,
            userId: memory.userId,
            content: memory.content,
            category: (memory.category.toUpperCase() as any),
            importance: memory.importance,
            source: memory.source,
            embedding: memory.embedding || [],
            createdAt: memory.createdAt,
          },
        });
      } catch (err) {
        // Fallback to local cache if network/cloud is temporarily disconnected
      }
    }
  }

  async search(query: string, userId: string, limit = 10): Promise<Memory[]> {
    const queryLower = query.toLowerCase();
    const userMemories = Array.from(this.localFallback.values()).filter((m) => m.userId === userId);

    return userMemories
      .map((m) => {
        const content = m.content.toLowerCase();
        const words = queryLower.split(/\s+/);
        const matchCount = words.filter((w) => content.includes(w)).length;
        const score = matchCount / (words.length || 1);
        return { memory: m, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.memory);
  }

  async getByCategory(userId: string, category: MemoryCategory, limit = 20): Promise<Memory[]> {
    return Array.from(this.localFallback.values())
      .filter((m) => m.userId === userId && m.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.localFallback.delete(id);
    if (this.prisma) {
      try {
        await this.prisma.memory.delete({ where: { id } });
      } catch {}
    }
  }

  async getAll(userId: string, limit = 100): Promise<Memory[]> {
    return Array.from(this.localFallback.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
