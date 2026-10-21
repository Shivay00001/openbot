/**
 * TF-IDF Vector Index 🔎
 * A genuine, dependency-free vector store: documents and queries are embedded
 * as TF-IDF sparse vectors and ranked by cosine similarity. Runs fully
 * offline (Zero-Cloud safe) and persists as JSON.
 *
 * Used by the episodic memory engine and the disk memory store so that
 * "search similar" is real vector similarity — not substring matching.
 */

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2);
}

export interface SerializableTfIdfIndex {
  docs: Record<string, Record<string, number>>; // docId -> term -> raw count
}

export class TfIdfIndex {
  private docs = new Map<string, Map<string, number>>();
  private docFreq = new Map<string, number>();

  add(id: string, text: string): void {
    this.remove(id);
    const counts = new Map<string, number>();
    for (const token of tokenize(text)) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
    if (counts.size === 0) return;
    this.docs.set(id, counts);
    for (const term of counts.keys()) {
      this.docFreq.set(term, (this.docFreq.get(term) || 0) + 1);
    }
  }

  remove(id: string): void {
    const existing = this.docs.get(id);
    if (!existing) return;
    for (const term of existing.keys()) {
      const next = (this.docFreq.get(term) || 1) - 1;
      if (next <= 0) this.docFreq.delete(term);
      else this.docFreq.set(term, next);
    }
    this.docs.delete(id);
  }

  has(id: string): boolean {
    return this.docs.has(id);
  }

  get size(): number {
    return this.docs.size;
  }

  private idf(term: string): number {
    const df = this.docFreq.get(term) || 0;
    return Math.log(1 + (this.docs.size - df + 0.5) / (df + 0.5));
  }

  private vectorize(counts: Map<string, number>): Map<string, number> {
    const vector = new Map<string, number>();
    for (const [term, count] of counts) {
      vector.set(term, (1 + Math.log(count)) * this.idf(term));
    }
    return vector;
  }

  /** Cosine similarity search. Returns matches with score > 0, best first. */
  search(query: string, limit = 5): Array<{ id: string; score: number }> {
    const queryCounts = new Map<string, number>();
    for (const token of tokenize(query)) {
      queryCounts.set(token, (queryCounts.get(token) || 0) + 1);
    }
    if (queryCounts.size === 0 || this.docs.size === 0) return [];

    const queryVector = this.vectorize(queryCounts);
    let queryNorm = 0;
    for (const value of queryVector.values()) queryNorm += value * value;
    queryNorm = Math.sqrt(queryNorm);
    if (queryNorm === 0) return [];

    const results: Array<{ id: string; score: number }> = [];
    for (const [id, counts] of this.docs) {
      const docVector = this.vectorize(counts);
      let dot = 0;
      let docNorm = 0;
      for (const [term, value] of docVector) {
        docNorm += value * value;
        const q = queryVector.get(term);
        if (q !== undefined) dot += q * value;
      }
      if (dot <= 0) continue;
      const score = dot / (queryNorm * Math.sqrt(docNorm));
      if (score > 0) results.push({ id, score });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  toJSON(): SerializableTfIdfIndex {
    const docs: Record<string, Record<string, number>> = {};
    for (const [id, counts] of this.docs) {
      docs[id] = Object.fromEntries(counts);
    }
    return { docs };
  }

  static fromJSON(data: SerializableTfIdfIndex): TfIdfIndex {
    const index = new TfIdfIndex();
    if (data && data.docs) {
      for (const [id, counts] of Object.entries(data.docs)) {
        const map = new Map<string, number>(Object.entries(counts));
        index.docs.set(id, map);
        for (const term of map.keys()) {
          index.docFreq.set(term, (index.docFreq.get(term) || 0) + 1);
        }
      }
    }
    return index;
  }
}
