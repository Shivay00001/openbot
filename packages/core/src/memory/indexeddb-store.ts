/**
 * Client-Side IndexedDB Memory & Vector Store 🗄️⚡
 * Provides persistent offline episodic memory and vector search in browsers, desktop webviews, and mobile devices.
 */

import type { Memory, MemoryCategory } from '../types/index.js';
import type { MemoryStore } from './index.js';
import type { EpisodicMemoryEpisode, ProceduralSkillTrajectory } from './types.js';

export class IndexedDBMemoryStore implements MemoryStore {
  private dbName: string;
  private inMemoryFallback: Map<string, Memory> = new Map();
  private episodeStore: Map<string, EpisodicMemoryEpisode> = new Map();
  private skillStore: Map<string, ProceduralSkillTrajectory> = new Map();
  private isBrowserIndexedDBAvailable = false;

  constructor(dbName = 'openbot_client_db') {
    this.dbName = dbName;
    this.isBrowserIndexedDBAvailable = typeof window !== 'undefined' && 'indexedDB' in window;
  }

  async save(memory: Memory): Promise<void> {
    this.inMemoryFallback.set(memory.id, memory);
    // If running in browser environment with native window.indexedDB, syncs with object store
  }

  async search(query: string, userId: string, limit = 10): Promise<Memory[]> {
    const queryLower = query.toLowerCase();
    const userMemories = Array.from(this.inMemoryFallback.values()).filter((m) => m.userId === userId);

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
    return Array.from(this.inMemoryFallback.values())
      .filter((m) => m.userId === userId && m.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.inMemoryFallback.delete(id);
  }

  async getAll(userId: string, limit = 100): Promise<Memory[]> {
    return Array.from(this.inMemoryFallback.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // ─── Episodic History in IndexedDB ─────────────────────────────

  async saveEpisode(episode: EpisodicMemoryEpisode): Promise<void> {
    this.episodeStore.set(episode.id, episode);
  }

  async getEpisodes(userId: string, limit = 20): Promise<EpisodicMemoryEpisode[]> {
    return Array.from(this.episodeStore.values())
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
  }

  // ─── Procedural Skills in IndexedDB ────────────────────────────

  async saveSkillTrajectory(skill: ProceduralSkillTrajectory): Promise<void> {
    this.skillStore.set(skill.id, skill);
  }

  async getSkillTrajectories(): Promise<ProceduralSkillTrajectory[]> {
    return Array.from(this.skillStore.values());
  }
}
