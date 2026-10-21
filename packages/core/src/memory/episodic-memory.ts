/**
 * Episodic Memory Engine 🧠📜
 * Records, retrieves, and synthesizes complete agent task trajectories.
 *
 * Persistence: episodes are stored on disk via DiskMemoryStore
 * (`.openbot_data/episodes.json`) so they survive restarts.
 * Retrieval: episodes are embedded as TF-IDF vectors and ranked by cosine
 * similarity to the query goal — a real vector search that runs fully
 * offline. Pass `{ persist: false }` for a purely in-memory engine (tests).
 */

import { v4 as uuid } from 'uuid';
import type { EpisodicMemoryEpisode } from './types.js';
import { DiskMemoryStore } from './disk-store.js';
import { TfIdfIndex } from './vector.js';

export interface EpisodicMemoryOptions {
  /** Persist episodes to disk (default true in Node environments). */
  persist?: boolean;
  /** Custom disk store (implies persistence). */
  store?: DiskMemoryStore;
  /** Base directory for the default disk store. */
  dataDir?: string;
}

export class EpisodicMemoryEngine {
  private episodes: Map<string, EpisodicMemoryEpisode> = new Map();
  private index = new TfIdfIndex();
  private readonly store: DiskMemoryStore | null;

  constructor(options: EpisodicMemoryOptions = {}) {
    const persist = options.persist ?? true;
    this.store = options.store || (persist ? new DiskMemoryStore(options.dataDir) : null);
    if (this.store) {
      for (const episode of this.store.getAllEpisodesSync()) {
        this.addToIndex(episode);
      }
    }
  }

  private addToIndex(episode: EpisodicMemoryEpisode): void {
    this.episodes.set(episode.id, episode);
    const text = [episode.goal, episode.summary, ...(episode.tags || [])].join(' ');
    this.index.add(episode.id, text);
  }

  /**
   * Record a completed task execution episode (persisted to disk).
   */
  async recordEpisode(episode: Omit<EpisodicMemoryEpisode, 'id' | 'completedAt'>): Promise<EpisodicMemoryEpisode> {
    const fullEpisode: EpisodicMemoryEpisode = {
      ...episode,
      id: uuid(),
      completedAt: Date.now(),
    };
    this.addToIndex(fullEpisode);
    if (this.store) {
      await this.store.saveEpisode(fullEpisode);
    }
    return fullEpisode;
  }

  /**
   * Search past episodes by TF-IDF cosine similarity to the current goal.
   */
  async searchSimilarEpisodes(queryGoal: string, userId: string, limit = 5): Promise<EpisodicMemoryEpisode[]> {
    const ranked = this.index.search(queryGoal, Math.max(limit * 4, limit));
    const results: EpisodicMemoryEpisode[] = [];
    for (const { id } of ranked) {
      const episode = this.episodes.get(id);
      if (episode && episode.userId === userId) {
        results.push(episode);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  /**
   * Extract lessons learned from past successes & failures for similar tasks.
   */
  async getLessonsLearned(queryGoal: string, userId: string): Promise<string[]> {
    const similar = await this.searchSimilarEpisodes(queryGoal, userId, 3);
    const lessons: string[] = [];
    for (const ep of similar) {
      if (ep.reflectionCritique?.lessonsLearned) {
        lessons.push(...ep.reflectionCritique.lessonsLearned);
      }
    }
    return Array.from(new Set(lessons));
  }

  /**
   * Get all episodes for user (newest first).
   */
  async getAllEpisodes(userId: string): Promise<EpisodicMemoryEpisode[]> {
    return Array.from(this.episodes.values())
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.completedAt - a.completedAt);
  }
}
