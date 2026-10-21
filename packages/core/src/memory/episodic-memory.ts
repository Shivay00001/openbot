/**
 * Episodic Memory Engine 🧠📜
 * Records, retrieves, and synthesizes complete agent task trajectories and past episodes.
 */

import { v4 as uuid } from 'uuid';
import type { EpisodicMemoryEpisode, EpisodicStep } from './types.js';

export class EpisodicMemoryEngine {
  private episodes: Map<string, EpisodicMemoryEpisode> = new Map();

  /**
   * Record a completed task execution episode
   */
  async recordEpisode(episode: Omit<EpisodicMemoryEpisode, 'id' | 'completedAt'>): Promise<EpisodicMemoryEpisode> {
    const fullEpisode: EpisodicMemoryEpisode = {
      ...episode,
      id: uuid(),
      completedAt: Date.now(),
    };
    this.episodes.set(fullEpisode.id, fullEpisode);
    return fullEpisode;
  }

  /**
   * Search past episodes by semantic / keyword similarity to current goal
   */
  async searchSimilarEpisodes(queryGoal: string, userId: string, limit = 5): Promise<EpisodicMemoryEpisode[]> {
    const userEpisodes = Array.from(this.episodes.values()).filter((e) => e.userId === userId);
    const queryTokens = queryGoal.toLowerCase().split(/\s+/);

    const scored = userEpisodes.map((ep) => {
      const goalLower = ep.goal.toLowerCase();
      const matchCount = queryTokens.filter((token) => goalLower.includes(token)).length;
      const score = matchCount / (queryTokens.length || 1);
      return { ep, score };
    });

    return scored
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.ep.rewardScore - a.ep.rewardScore)
      .slice(0, limit)
      .map((item) => item.ep);
  }

  /**
   * Extract lessons learned from past successes & failures for similar tasks
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
   * Get all episodes for user
   */
  async getAllEpisodes(userId: string): Promise<EpisodicMemoryEpisode[]> {
    return Array.from(this.episodes.values())
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.completedAt - a.completedAt);
  }
}
