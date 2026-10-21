/**
 * Disk Memory & Episodic Store 💾📁
 * Production file-system persistence for Node.js, CLI, and Desktop environments.
 * Saves memories, episodes, and learned procedural playbooks to disk (.openbot_data/).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Memory, MemoryCategory } from '../types/index.js';
import type { MemoryStore } from './index.js';
import type { EpisodicMemoryEpisode, ProceduralSkillTrajectory } from './types.js';
import { TfIdfIndex } from './vector.js';

export class DiskMemoryStore implements MemoryStore {
  private baseDir: string;
  private memoriesPath: string;
  private episodesPath: string;
  private playbooksPath: string;
  private memories: Map<string, Memory> = new Map();
  private episodes: Map<string, EpisodicMemoryEpisode> = new Map();
  private playbooks: Map<string, ProceduralSkillTrajectory> = new Map();
  private memoryIndex = new TfIdfIndex();

  constructor(customDir?: string) {
    this.baseDir = customDir || path.resolve(process.cwd ? process.cwd() : '.', '.openbot_data');
    this.memoriesPath = path.join(this.baseDir, 'memories.json');
    this.episodesPath = path.join(this.baseDir, 'episodes.json');
    this.playbooksPath = path.join(this.baseDir, 'playbooks.json');
    this.initializeFromDisk();
  }

  private initializeFromDisk(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
      }

      if (fs.existsSync(this.memoriesPath)) {
        const raw = fs.readFileSync(this.memoriesPath, 'utf-8');
        const list: Memory[] = JSON.parse(raw);
        list.forEach((m) => {
          m.createdAt = new Date(m.createdAt);
          this.memories.set(m.id, m);
          this.memoryIndex.add(m.id, m.content);
        });
      }

      if (fs.existsSync(this.episodesPath)) {
        const raw = fs.readFileSync(this.episodesPath, 'utf-8');
        const list: EpisodicMemoryEpisode[] = JSON.parse(raw);
        list.forEach((e) => this.episodes.set(e.id, e));
      }

      if (fs.existsSync(this.playbooksPath)) {
        const raw = fs.readFileSync(this.playbooksPath, 'utf-8');
        const list: ProceduralSkillTrajectory[] = JSON.parse(raw);
        list.forEach((p) => this.playbooks.set(p.id, p));
      }
    } catch {
      // In-memory fallback if file system write is blocked
    }
  }

  private persistMemories(): void {
    try {
      if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
      fs.writeFileSync(this.memoriesPath, JSON.stringify(Array.from(this.memories.values()), null, 2));
    } catch {}
  }

  private persistEpisodes(): void {
    try {
      if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
      fs.writeFileSync(this.episodesPath, JSON.stringify(Array.from(this.episodes.values()), null, 2));
    } catch {}
  }

  private persistPlaybooks(): void {
    try {
      if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
      fs.writeFileSync(this.playbooksPath, JSON.stringify(Array.from(this.playbooks.values()), null, 2));
    } catch {}
  }

  async save(memory: Memory): Promise<void> {
    this.memories.set(memory.id, memory);
    this.memoryIndex.add(memory.id, memory.content);
    this.persistMemories();
  }

  /** TF-IDF cosine-similarity search over memory contents. */
  async search(query: string, userId: string, limit = 10): Promise<Memory[]> {
    const ranked = this.memoryIndex.search(query, Math.max(limit * 4, limit));
    const results: Memory[] = [];
    for (const { id } of ranked) {
      const memory = this.memories.get(id);
      if (memory && memory.userId === userId) {
        results.push(memory);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  async getByCategory(userId: string, category: MemoryCategory, limit = 20): Promise<Memory[]> {
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId && m.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    this.memories.delete(id);
    this.memoryIndex.remove(id);
    this.persistMemories();
  }

  async getAll(userId: string, limit = 100): Promise<Memory[]> {
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // ─── Episodic Memory Operations ────────────────────────────────

  async saveEpisode(episode: EpisodicMemoryEpisode): Promise<void> {
    this.episodes.set(episode.id, episode);
    this.persistEpisodes();
  }

  /** Synchronous snapshot of all persisted episodes (used at engine boot). */
  getAllEpisodesSync(): EpisodicMemoryEpisode[] {
    return Array.from(this.episodes.values());
  }

  async searchEpisodes(goal: string, userId: string, limit = 5): Promise<EpisodicMemoryEpisode[]> {
    const queryTokens = goal.toLowerCase().split(/\s+/);
    const userEpisodes = Array.from(this.episodes.values()).filter((e) => e.userId === userId);

    return userEpisodes
      .map((e) => {
        const goalLower = e.goal.toLowerCase();
        const matches = queryTokens.filter((token) => goalLower.includes(token)).length;
        const score = matches / (queryTokens.length || 1);
        return { episode: e, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || b.episode.rewardScore - a.episode.rewardScore)
      .slice(0, limit)
      .map((s) => s.episode);
  }

  // ─── Procedural Playbooks ──────────────────────────────────────

  async savePlaybook(playbook: ProceduralSkillTrajectory): Promise<void> {
    this.playbooks.set(playbook.id, playbook);
    this.persistPlaybooks();
  }

  async getPlaybooks(): Promise<ProceduralSkillTrajectory[]> {
    return Array.from(this.playbooks.values());
  }
}
