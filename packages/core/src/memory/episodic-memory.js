"use strict";
/**
 * Episodic Memory Engine 🧠📜
 * Records, retrieves, and synthesizes complete agent task trajectories and past episodes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EpisodicMemoryEngine = void 0;
const uuid_1 = require("uuid");
class EpisodicMemoryEngine {
    episodes = new Map();
    /**
     * Record a completed task execution episode
     */
    async recordEpisode(episode) {
        const fullEpisode = {
            ...episode,
            id: (0, uuid_1.v4)(),
            completedAt: Date.now(),
        };
        this.episodes.set(fullEpisode.id, fullEpisode);
        return fullEpisode;
    }
    /**
     * Search past episodes by semantic / keyword similarity to current goal
     */
    async searchSimilarEpisodes(queryGoal, userId, limit = 5) {
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
    async getLessonsLearned(queryGoal, userId) {
        const similar = await this.searchSimilarEpisodes(queryGoal, userId, 3);
        const lessons = [];
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
    async getAllEpisodes(userId) {
        return Array.from(this.episodes.values())
            .filter((e) => e.userId === userId)
            .sort((a, b) => b.completedAt - a.completedAt);
    }
}
exports.EpisodicMemoryEngine = EpisodicMemoryEngine;
//# sourceMappingURL=episodic-memory.js.map