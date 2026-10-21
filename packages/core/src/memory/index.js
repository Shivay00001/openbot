"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryManager = exports.InMemoryStore = exports.ReinforcementLearningEngine = exports.CloudPrismaMemoryStore = exports.DiskMemoryStore = exports.IndexedDBMemoryStore = exports.EpisodicMemoryEngine = void 0;
const uuid_1 = require("uuid");
__exportStar(require("./types.js"), exports);
var episodic_memory_js_1 = require("./episodic-memory.js");
Object.defineProperty(exports, "EpisodicMemoryEngine", { enumerable: true, get: function () { return episodic_memory_js_1.EpisodicMemoryEngine; } });
var indexeddb_store_js_1 = require("./indexeddb-store.js");
Object.defineProperty(exports, "IndexedDBMemoryStore", { enumerable: true, get: function () { return indexeddb_store_js_1.IndexedDBMemoryStore; } });
var disk_store_js_1 = require("./disk-store.js");
Object.defineProperty(exports, "DiskMemoryStore", { enumerable: true, get: function () { return disk_store_js_1.DiskMemoryStore; } });
var cloud_prisma_store_js_1 = require("./cloud-prisma-store.js");
Object.defineProperty(exports, "CloudPrismaMemoryStore", { enumerable: true, get: function () { return cloud_prisma_store_js_1.CloudPrismaMemoryStore; } });
var reinforcement_engine_js_1 = require("./reinforcement-engine.js");
Object.defineProperty(exports, "ReinforcementLearningEngine", { enumerable: true, get: function () { return reinforcement_engine_js_1.ReinforcementLearningEngine; } });
// ─── In-Memory Store (Development) ──────────────────────────────
class InMemoryStore {
    memories = new Map();
    async save(memory) {
        this.memories.set(memory.id, memory);
    }
    async search(query, userId, limit = 10) {
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
    async getByCategory(userId, category, limit = 20) {
        return Array.from(this.memories.values())
            .filter((m) => m.userId === userId && m.category === category)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
    async delete(id) {
        this.memories.delete(id);
    }
    async getAll(userId, limit = 100) {
        return Array.from(this.memories.values())
            .filter((m) => m.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
}
exports.InMemoryStore = InMemoryStore;
// ─── Memory Manager ─────────────────────────────────────────────
class MemoryManager {
    store;
    constructor(store) {
        this.store = store || new InMemoryStore();
    }
    /**
     * Extract and save important information from a conversation
     */
    async extractAndSave(userId, messages) {
        const extracted = [];
        for (const msg of messages) {
            if (msg.role !== 'user')
                continue;
            const content = msg.content.toLowerCase();
            // Detect preferences
            if (this.isPreference(content)) {
                const memory = {
                    id: (0, uuid_1.v4)(),
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
                const memory = {
                    id: (0, uuid_1.v4)(),
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
                const memory = {
                    id: (0, uuid_1.v4)(),
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
    async buildContext(userId, query) {
        const [relevant, instructions, preferences] = await Promise.all([
            this.store.search(query, userId, 5),
            this.store.getByCategory(userId, 'instruction', 5),
            this.store.getByCategory(userId, 'preference', 5),
        ]);
        const parts = [];
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
    async remember(userId, content, category = 'fact') {
        const memory = {
            id: (0, uuid_1.v4)(),
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
    async forget(id) {
        await this.store.delete(id);
    }
    /**
     * List all memories
     */
    async list(userId) {
        return this.store.getAll(userId);
    }
    // ─── Detection Heuristics ──────────────────────────────────────
    isPreference(content) {
        const markers = ['i prefer', 'i like', 'i want', 'i don\'t like', 'i hate', 'always use', 'never use',
            'my favorite', 'i usually', 'i typically', 'please always', 'please never'];
        return markers.some((m) => content.includes(m));
    }
    isFact(content) {
        const markers = ['my name is', 'i am', 'i work at', 'i live in', 'my email is',
            'i\'m a', 'my job is', 'my company', 'i study', 'my timezone'];
        return markers.some((m) => content.includes(m));
    }
    isInstruction(content) {
        const markers = ['always remember', 'from now on', 'going forward', 'remember that',
            'keep in mind', 'note that', 'important:', 'rule:'];
        return markers.some((m) => content.includes(m));
    }
}
exports.MemoryManager = MemoryManager;
//# sourceMappingURL=index.js.map