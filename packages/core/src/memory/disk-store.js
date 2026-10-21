"use strict";
/**
 * Disk Memory & Episodic Store 💾📁
 * Production file-system persistence for Node.js, CLI, and Desktop environments.
 * Saves memories, episodes, and learned procedural playbooks to disk (.openbot_data/).
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiskMemoryStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class DiskMemoryStore {
    baseDir;
    memoriesPath;
    episodesPath;
    playbooksPath;
    memories = new Map();
    episodes = new Map();
    playbooks = new Map();
    constructor(customDir) {
        this.baseDir = customDir || path.resolve(process.cwd ? process.cwd() : '.', '.openbot_data');
        this.memoriesPath = path.join(this.baseDir, 'memories.json');
        this.episodesPath = path.join(this.baseDir, 'episodes.json');
        this.playbooksPath = path.join(this.baseDir, 'playbooks.json');
        this.initializeFromDisk();
    }
    initializeFromDisk() {
        try {
            if (!fs.existsSync(this.baseDir)) {
                fs.mkdirSync(this.baseDir, { recursive: true });
            }
            if (fs.existsSync(this.memoriesPath)) {
                const raw = fs.readFileSync(this.memoriesPath, 'utf-8');
                const list = JSON.parse(raw);
                list.forEach((m) => {
                    m.createdAt = new Date(m.createdAt);
                    this.memories.set(m.id, m);
                });
            }
            if (fs.existsSync(this.episodesPath)) {
                const raw = fs.readFileSync(this.episodesPath, 'utf-8');
                const list = JSON.parse(raw);
                list.forEach((e) => this.episodes.set(e.id, e));
            }
            if (fs.existsSync(this.playbooksPath)) {
                const raw = fs.readFileSync(this.playbooksPath, 'utf-8');
                const list = JSON.parse(raw);
                list.forEach((p) => this.playbooks.set(p.id, p));
            }
        }
        catch {
            // In-memory fallback if file system write is blocked
        }
    }
    persistMemories() {
        try {
            if (!fs.existsSync(this.baseDir))
                fs.mkdirSync(this.baseDir, { recursive: true });
            fs.writeFileSync(this.memoriesPath, JSON.stringify(Array.from(this.memories.values()), null, 2));
        }
        catch { }
    }
    persistEpisodes() {
        try {
            if (!fs.existsSync(this.baseDir))
                fs.mkdirSync(this.baseDir, { recursive: true });
            fs.writeFileSync(this.episodesPath, JSON.stringify(Array.from(this.episodes.values()), null, 2));
        }
        catch { }
    }
    persistPlaybooks() {
        try {
            if (!fs.existsSync(this.baseDir))
                fs.mkdirSync(this.baseDir, { recursive: true });
            fs.writeFileSync(this.playbooksPath, JSON.stringify(Array.from(this.playbooks.values()), null, 2));
        }
        catch { }
    }
    async save(memory) {
        this.memories.set(memory.id, memory);
        this.persistMemories();
    }
    async search(query, userId, limit = 10) {
        const queryLower = query.toLowerCase();
        const userMemories = Array.from(this.memories.values()).filter((m) => m.userId === userId);
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
        return Array.from(this.memories.values())
            .filter((m) => m.userId === userId && m.category === category)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
    async delete(id) {
        this.memories.delete(id);
        this.persistMemories();
    }
    async getAll(userId, limit = 100) {
        return Array.from(this.memories.values())
            .filter((m) => m.userId === userId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);
    }
    // ─── Episodic Memory Operations ────────────────────────────────
    async saveEpisode(episode) {
        this.episodes.set(episode.id, episode);
        this.persistEpisodes();
    }
    async searchEpisodes(goal, userId, limit = 5) {
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
    async savePlaybook(playbook) {
        this.playbooks.set(playbook.id, playbook);
        this.persistPlaybooks();
    }
    async getPlaybooks() {
        return Array.from(this.playbooks.values());
    }
}
exports.DiskMemoryStore = DiskMemoryStore;
//# sourceMappingURL=disk-store.js.map