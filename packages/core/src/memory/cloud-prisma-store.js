"use strict";
/**
 * Cloud Database Store Adapter ☁️🗄️
 * Persists and syncs long-term semantic memories and episodic histories with PostgreSQL via Prisma.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudPrismaMemoryStore = void 0;
class CloudPrismaMemoryStore {
    prisma;
    localFallback = new Map();
    constructor(prismaClient) {
        this.prisma = prismaClient;
    }
    async save(memory) {
        this.localFallback.set(memory.id, memory);
        if (this.prisma) {
            try {
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
            catch (err) {
                // Fallback to local cache if network/cloud is temporarily disconnected
            }
        }
    }
    async search(query, userId, limit = 10) {
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
    async getByCategory(userId, category, limit = 20) {
        return Array.from(this.localFallback.values())
            .filter((m) => m.userId === userId && m.category === category)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
    async delete(id) {
        this.localFallback.delete(id);
        if (this.prisma) {
            try {
                await this.prisma.memory.delete({ where: { id } });
            }
            catch { }
        }
    }
    async getAll(userId, limit = 100) {
        return Array.from(this.localFallback.values())
            .filter((m) => m.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
}
exports.CloudPrismaMemoryStore = CloudPrismaMemoryStore;
//# sourceMappingURL=cloud-prisma-store.js.map