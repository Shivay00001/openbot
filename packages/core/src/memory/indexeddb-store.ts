/**
 * Client-Side IndexedDB Memory Store 🗄️
 * Persistent offline memory for browsers / webviews. When IndexedDB is
 * available, memories, episodes, and skill trajectories are written to real
 * object stores and rehydrated on construction; search runs TF-IDF cosine
 * similarity over the loaded set. Outside a browser (Node, tests) it falls
 * back to an in-memory map with identical semantics.
 */

import type { Memory, MemoryCategory } from '../types/index.js';
import type { MemoryStore } from './index.js';
import type { EpisodicMemoryEpisode, ProceduralSkillTrajectory } from './types.js';
import { TfIdfIndex } from './vector.js';

const STORE_MEMORIES = 'memories';
const STORE_EPISODES = 'episodes';
const STORE_SKILLS = 'skills';

function idbAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDBMemoryStore implements MemoryStore {
  private dbName: string;
  private memories: Map<string, Memory> = new Map();
  private episodeStore: Map<string, EpisodicMemoryEpisode> = new Map();
  private skillStore: Map<string, ProceduralSkillTrajectory> = new Map();
  private index = new TfIdfIndex();
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private hydrated = false;

  constructor(dbName = 'openbot_client_db') {
    this.dbName = dbName;
    // Kick off hydration in browsers; queries await `ready()`.
    if (idbAvailable()) {
      void this.hydrate();
    } else {
      this.hydrated = true;
    }
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (!idbAvailable()) return Promise.resolve(null);
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        const request = window.indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_MEMORIES)) db.createObjectStore(STORE_MEMORIES, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STORE_EPISODES)) db.createObjectStore(STORE_EPISODES, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STORE_SKILLS)) db.createObjectStore(STORE_SKILLS, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      });
    }
    return this.dbPromise;
  }

  private async hydrate(): Promise<void> {
    const db = await this.openDb();
    if (!db) {
      this.hydrated = true;
      return;
    }
    try {
      const tx = db.transaction([STORE_MEMORIES, STORE_EPISODES, STORE_SKILLS], 'readonly');
      const memories = await requestToPromise(tx.objectStore(STORE_MEMORIES).getAll() as IDBRequest<Memory[]>);
      const episodes = await requestToPromise(tx.objectStore(STORE_EPISODES).getAll() as IDBRequest<EpisodicMemoryEpisode[]>);
      const skills = await requestToPromise(tx.objectStore(STORE_SKILLS).getAll() as IDBRequest<ProceduralSkillTrajectory[]>);
      for (const m of memories || []) {
        m.createdAt = new Date(m.createdAt);
        this.memories.set(m.id, m);
        this.index.add(m.id, m.content);
      }
      for (const e of episodes || []) this.episodeStore.set(e.id, e);
      for (const s of skills || []) this.skillStore.set(s.id, s);
    } catch {
      // IndexedDB read failed — continue with whatever is in memory.
    }
    this.hydrated = true;
  }

  /** Resolves once persisted browser data (if any) has been loaded. */
  async ready(): Promise<void> {
    if (!this.hydrated) await this.hydrate();
  }

  private async persist(storeName: string, value: unknown): Promise<void> {
    const db = await this.openDb();
    if (!db) return;
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
    } catch {
      // Persistence is best-effort; in-memory state remains authoritative.
    }
  }

  private async removePersisted(storeName: string, id: string): Promise<void> {
    const db = await this.openDb();
    if (!db) return;
    try {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
    } catch {
      // best effort
    }
  }

  async save(memory: Memory): Promise<void> {
    await this.ready();
    this.memories.set(memory.id, memory);
    this.index.add(memory.id, memory.content);
    await this.persist(STORE_MEMORIES, { ...memory, createdAt: memory.createdAt.toISOString() });
  }

  /** TF-IDF cosine-similarity search. */
  async search(query: string, userId: string, limit = 10): Promise<Memory[]> {
    await this.ready();
    const ranked = this.index.search(query, Math.max(limit * 4, limit));
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
    await this.ready();
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId && m.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    await this.ready();
    this.memories.delete(id);
    this.index.remove(id);
    await this.removePersisted(STORE_MEMORIES, id);
  }

  async getAll(userId: string, limit = 100): Promise<Memory[]> {
    await this.ready();
    return Array.from(this.memories.values())
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // ─── Episodic History ──────────────────────────────────────────

  async saveEpisode(episode: EpisodicMemoryEpisode): Promise<void> {
    await this.ready();
    this.episodeStore.set(episode.id, episode);
    await this.persist(STORE_EPISODES, episode);
  }

  async getEpisodes(userId: string, limit = 20): Promise<EpisodicMemoryEpisode[]> {
    await this.ready();
    return Array.from(this.episodeStore.values())
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, limit);
  }

  // ─── Procedural Skills ─────────────────────────────────────────

  async saveSkillTrajectory(skill: ProceduralSkillTrajectory): Promise<void> {
    await this.ready();
    this.skillStore.set(skill.id, skill);
    await this.persist(STORE_SKILLS, skill);
  }

  async getSkillTrajectories(): Promise<ProceduralSkillTrajectory[]> {
    await this.ready();
    return Array.from(this.skillStore.values());
  }
}
