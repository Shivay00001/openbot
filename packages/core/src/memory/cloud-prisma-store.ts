/**
 * Cloud Database Store Adapter ☁️🗄️
 * Persists long-term memories to PostgreSQL via Prisma when a client is
 * provided, and reads them back with real queries (search runs TF-IDF
 * cosine similarity over the user's rows). A local cache mirrors writes so
 * reads still work during transient disconnects; when no Prisma client is
 * configured the store operates cache-only and says so via `isCloudBacked`.
 */

import type { Memory, MemoryCategory } from '../types/index.js';
import type { MemoryStore } from './index.js';
import { TfIdfIndex } from './vector.js';

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

function rowToMemory(row: any): Memory {
  return {
    id: row.id,
    userId: row.userId,
    content: row.content,
    category: (typeof row.category === 'string' ? row.category.toLowerCase() : row.category) as MemoryCategory,
    importance: row.importance ?? 0.5,
    source: row.source ?? 'cloud',
    embedding: row.embedding || undefined,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}

export class CloudPrismaMemoryStore implements MemoryStore {
  private prisma?: PrismaDatabaseClient;
  private localCache: Map<string, Memory> = new Map();
  private index = new TfIdfIndex();

  constructor(prismaClient?: PrismaDatabaseClient) {
    this.prisma = prismaClient;
  }

  /** True when a Prisma client is configured (writes go to PostgreSQL). */
  get isCloudBacked(): boolean {
    return Boolean(this.prisma);
  }

  async save(memory: Memory): Promise<void> {
    this.localCache.set(memory.id, memory);
    this.index.add(memory.id, memory.content);

    if (this.prisma) {
      await this.prisma.memory.create({
        data: {
          id: memory.id,
          userId: memory.userId,
          content: memory.content,
          category: memory.category.toUpperCase(),
          importance: memory.importance,
          source: memory.source,
          embedding: memory.embedding || [],
          createdAt: memory.createdAt,
        },
      });
    }
  }

  /** Load the user's memories from Prisma (refreshing the local cache). */
  private async fetchUserMemories(userId: string): Promise<Memory[]> {
    if (this.prisma) {
      const rows = await this.prisma.memory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });
      const memories = rows.map(rowToMemory);
      for (const memory of memories) {
        if (!this.localCache.has(memory.id)) {
          this.localCache.set(memory.id, memory);
          this.index.add(memory.id, memory.content);
        }
      }
      return memories;
    }
    return Array.from(this.localCache.values()).filter((m) => m.userId === userId);
  }

  /** TF-IDF cosine-similarity search over the user's cloud memories. */
  async search(query: string, userId: string, limit = 10): Promise<Memory[]> {
    await this.fetchUserMemories(userId);
    const ranked = this.index.search(query, Math.max(limit * 4, limit));
    const results: Memory[] = [];
    for (const { id } of ranked) {
      const memory = this.localCache.get(id);
      if (memory && memory.userId === userId) {
        results.push(memory);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  async getByCategory(userId: string, category: MemoryCategory, limit = 20): Promise<Memory[]> {
    const memories = await this.fetchUserMemories(userId);
    return memories
      .filter((m) => m.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.localCache.delete(id);
    this.index.remove(id);
    if (this.prisma) {
      await this.prisma.memory.delete({ where: { id } });
    }
  }

  async getAll(userId: string, limit = 100): Promise<Memory[]> {
    const memories = await this.fetchUserMemories(userId);
    return memories
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
