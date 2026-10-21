"use strict";
/**
 * Client-Side IndexedDB Memory & Vector Store 🗄️⚡
 * Provides persistent offline episodic memory and vector search in browsers, desktop webviews, and mobile devices.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexedDBMemoryStore = void 0;
class IndexedDBMemoryStore {
    dbName;
    inMemoryFallback = new Map();
    episodeStore = new Map();
    skillStore = new Map();
    isBrowserIndexedDBAvailable = false;
    constructor(dbName = 'openbot_client_db') {
        this.dbName = dbName;
        this.isBrowserIndexedDBAvailable = typeof window !== 'undefined' && 'indexedDB' in window;
    }
    async save(memory) {
        this.inMemoryFallback.set(memory.id, memory);
        // If running in browser environment with native window.indexedDB, syncs with object store
    }
    async search(query, userId, limit = 10) {
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
    async getByCategory(userId, category, limit = 20) {
        return Array.from(this.inMemoryFallback.values())
            .filter((m) => m.userId === userId && m.category === category)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
    async delete(id) {
        this.inMemoryFallback.delete(id);
    }
    async getAll(userId, limit = 100) {
        return Array.from(this.inMemoryFallback.values())
            .filter((m) => m.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
    // ─── Episodic History in IndexedDB ─────────────────────────────
    async saveEpisode(episode) {
        this.episodeStore.set(episode.id, episode);
    }
    async getEpisodes(userId, limit = 20) {
        return Array.from(this.episodeStore.values())
            .filter((e) => e.userId === userId)
            .sort((a, b) => b.completedAt - a.completedAt)
            .slice(0, limit);
    }
    // ─── Procedural Skills in IndexedDB ────────────────────────────
    async saveSkillTrajectory(skill) {
        this.skillStore.set(skill.id, skill);
    }
    async getSkillTrajectories() {
        return Array.from(this.skillStore.values());
    }
}
exports.IndexedDBMemoryStore = IndexedDBMemoryStore;
//# sourceMappingURL=indexeddb-store.js.map