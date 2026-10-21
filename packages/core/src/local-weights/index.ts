/**
 * OpenBot Local Model Weight & Inference System
 *
 * Provides:
 * - A curated catalog of GGUF weights (DeepSeek R1, Qwen 2.5, Llama 3.2, ...)
 * - REAL weight downloads: streamed HTTP with resume (.part files),
 *   live progress, and SHA-256 verification of the finished file.
 * - Local inference through a local Ollama server: downloaded GGUF files are
 *   registered with Ollama (`/api/create`) and served from there, so prompts
 *   are processed 100% on-device. If Ollama is not running or the weight is
 *   not installed, calls fail with the real error — responses are never
 *   fabricated locally.
 * - Hardware capability detection for model recommendations.
 */

import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { StreamEvent } from '../types/index.js';
import type { ModelAdapter, CompletionParams, CompletionResult } from '../models/index.js';
import { zeroCloudGuard } from '../security/zero-cloud.js';
import { proxiedFetch, fetchWithHeaderTimeout } from '../net/http.js';

// ─── Model Weight Metadata ──────────────────────────────────────

// ─── Model Weight Metadata (pure data lives in ./catalog.ts) ────
export type { ModelWeightInfo, WeightDownloadProgress, HardwareProfile } from './catalog.js';
export { LOCAL_WEIGHT_CATALOG } from './catalog.js';
import type { ModelWeightInfo, WeightDownloadProgress, HardwareProfile } from './catalog.js';
import { LOCAL_WEIGHT_CATALOG } from './catalog.js';


// ─── Local Weight Manager ───────────────────────────────────────

interface InstalledManifestEntry {
  modelId: string;
  localPath: string;
  sizeBytes: number;
  sha256: string;
  installedAt: string;
}

export interface ModelWeightManagerOptions {
  /** Directory where weights are stored (default <cwd>/.openbot_models). */
  dir?: string;
}

export class ModelWeightManager {
  private readonly dir: string;
  private readonly manifestPath: string;
  private manifest: Map<string, InstalledManifestEntry> = new Map();
  private listeners: Set<(progress: WeightDownloadProgress) => void> = new Set();

  constructor(options: ModelWeightManagerOptions = {}) {
    this.dir = options.dir || path.resolve(process.cwd(), '.openbot_models');
    this.manifestPath = path.join(this.dir, 'manifest.json');
    this.loadManifest();
  }

  get modelsDir(): string {
    return this.dir;
  }

  private loadManifest(): void {
    try {
      if (fs.existsSync(this.manifestPath)) {
        const entries = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8')) as InstalledManifestEntry[];
        for (const entry of entries) {
          if (fs.existsSync(entry.localPath)) this.manifest.set(entry.modelId, entry);
        }
      }
    } catch {
      this.manifest.clear();
    }
  }

  private saveManifest(): void {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.manifestPath, JSON.stringify(Array.from(this.manifest.values()), null, 2));
  }

  getCatalog(): ModelWeightInfo[] {
    return LOCAL_WEIGHT_CATALOG;
  }

  getInstalledWeights(): { info: ModelWeightInfo; localPath: string; installedAt: Date }[] {
    const installed: { info: ModelWeightInfo; localPath: string; installedAt: Date }[] = [];
    for (const entry of this.manifest.values()) {
      const info = LOCAL_WEIGHT_CATALOG.find((m) => m.id === entry.modelId);
      if (info) {
        installed.push({ info, localPath: entry.localPath, installedAt: new Date(entry.installedAt) });
      }
    }
    return installed;
  }

  isModelInstalled(modelId: string): boolean {
    const entry = this.manifest.get(modelId);
    return Boolean(entry && fs.existsSync(entry.localPath));
  }

  getInstalledPath(modelId: string): string | null {
    const entry = this.manifest.get(modelId);
    return entry && fs.existsSync(entry.localPath) ? entry.localPath : null;
  }

  onDownloadProgress(callback: (progress: WeightDownloadProgress) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyProgress(progress: WeightDownloadProgress) {
    for (const listener of this.listeners) listener(progress);
  }

  private async sha256OfFile(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    await pipeline(fs.createReadStream(filePath), hash);
    return hash.digest('hex');
  }

  /**
   * Download a model weight for real: streamed to `<id>.gguf.part`, resumed
   * with a Range header when a partial file exists, then SHA-256 verified
   * (against the catalog checksum when published; the computed digest is
   * always recorded in the manifest) and atomically renamed into place.
   */
  async startDownload(
    modelId: string,
    onProgress?: (progress: WeightDownloadProgress) => void
  ): Promise<{ success: boolean; localPath?: string; error?: string }> {
    const model = LOCAL_WEIGHT_CATALOG.find((m) => m.id === modelId);
    if (!model) {
      return { success: false, error: `Model ${modelId} not found in catalog` };
    }

    const existing = this.getInstalledPath(modelId);
    if (existing) {
      return { success: true, localPath: existing };
    }

    fs.mkdirSync(this.dir, { recursive: true });
    const extension = model.downloadUrl.endsWith('.bin') ? '.bin' : '.gguf';
    const finalPath = path.join(this.dir, `${model.id}${extension}`);
    const partPath = `${finalPath}.part`;

    const emit = (progress: WeightDownloadProgress) => {
      this.notifyProgress(progress);
      onProgress?.(progress);
    };

    try {
      zeroCloudGuard.assertAllowed(model.downloadUrl);

      const resumeFrom = fs.existsSync(partPath) ? fs.statSync(partPath).size : 0;
      const headers: Record<string, string> = {};
      if (resumeFrom > 0) headers['Range'] = `bytes=${resumeFrom}-`;

      // Bounded to response HEADERS (30s): a dead route must fail fast,
      // while the streamed body of a multi-GB weight is intentionally not
      // capped (downloads are resumable via the .part file).
      const response = await fetchWithHeaderTimeout(
        model.downloadUrl,
        { headers, redirect: 'follow' },
        30000,
        `Download of ${model.id}`
      );
      if (!response.ok || !response.body) {
        throw new Error(`Download failed: HTTP ${response.status} from ${new URL(model.downloadUrl).hostname}`);
      }

      // If the server ignored our Range request, restart from scratch.
      const append = resumeFrom > 0 && response.status === 206;
      const totalBytes = append
        ? resumeFrom + Number(response.headers.get('content-length') || model.sizeBytes - resumeFrom)
        : Number(response.headers.get('content-length') || model.sizeBytes);

      let downloaded = append ? resumeFrom : 0;
      const startedAt = Date.now();
      const source = Readable.fromWeb(response.body as any);
      source.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        const elapsedSec = Math.max(0.001, (Date.now() - startedAt) / 1000);
        const speed = downloaded / elapsedSec;
        emit({
          modelId,
          bytesDownloaded: downloaded,
          totalBytes,
          percentage: totalBytes > 0 ? Math.min(100, Math.round((downloaded / totalBytes) * 100)) : 0,
          speedBytesPerSec: Math.round(speed),
          etaSeconds: speed > 0 ? Math.max(0, Math.round((totalBytes - downloaded) / speed)) : 0,
          status: 'downloading',
        });
      });

      await pipeline(source, fs.createWriteStream(partPath, { flags: append ? 'a' : 'w' }));

      emit({
        modelId,
        bytesDownloaded: downloaded,
        totalBytes,
        percentage: 100,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        status: 'verifying',
      });

      const digest = await this.sha256OfFile(partPath);
      if (model.sha256 && digest.toLowerCase() !== model.sha256.toLowerCase()) {
        fs.unlinkSync(partPath);
        throw new Error(`SHA-256 verification failed for ${modelId}: expected ${model.sha256}, got ${digest}. Partial file deleted.`);
      }

      fs.renameSync(partPath, finalPath);
      const sizeBytes = fs.statSync(finalPath).size;
      this.manifest.set(modelId, {
        modelId,
        localPath: finalPath,
        sizeBytes,
        sha256: digest,
        installedAt: new Date().toISOString(),
      });
      this.saveManifest();

      emit({
        modelId,
        bytesDownloaded: sizeBytes,
        totalBytes: sizeBytes,
        percentage: 100,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        status: 'ready',
      });

      return { success: true, localPath: finalPath };
    } catch (err: any) {
      emit({
        modelId,
        bytesDownloaded: 0,
        totalBytes: model.sizeBytes,
        percentage: 0,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        status: 'error',
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  /** Delete an installed model weight and its manifest entry. */
  async deleteModel(modelId: string): Promise<boolean> {
    const entry = this.manifest.get(modelId);
    if (!entry) return false;
    try {
      if (fs.existsSync(entry.localPath)) fs.unlinkSync(entry.localPath);
    } catch {
      // file already gone — still drop the manifest entry
    }
    this.manifest.delete(modelId);
    this.saveManifest();
    return true;
  }

  /**
   * Detect hardware capabilities for model recommendations.
   * In Node this reads the real OS memory/CPU; in browsers it uses
   * navigator + WebGPU when present.
   */
  async detectHardware(): Promise<HardwareProfile> {
    const hasNavigator = typeof navigator !== 'undefined';
    let hasWebGpu = false;
    let gpuAdapterName: string | undefined = undefined;

    if (hasNavigator && 'gpu' in navigator) {
      try {
        const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<{ info?: { description: string } }> } }).gpu;
        if (gpu) {
          const adapter = await gpu.requestAdapter();
          if (adapter) {
            hasWebGpu = true;
            gpuAdapterName = adapter.info?.description || 'WebGPU Compatible Accelerator';
          }
        }
      } catch {
        hasWebGpu = false;
      }
    }

    let cpuCores: number;
    let ramGb: number;
    if (hasNavigator) {
      cpuCores = navigator.hardwareConcurrency || 4;
      ramGb = 'deviceMemory' in navigator ? (navigator as unknown as { deviceMemory: number }).deviceMemory : 8;
    } else {
      cpuCores = os.cpus().length || 4;
      ramGb = Math.round((os.totalmem() / 1_073_741_824) * 10) / 10;
    }

    let recommended = 'llama-3.2-1b-instruct-q4';
    if (ramGb >= 16) recommended = 'deepseek-r1-distill-qwen-7b-q4';
    else if (ramGb >= 8) recommended = 'deepseek-r1-distill-qwen-1.5b-q4';
    else if (ramGb >= 4) recommended = 'qwen2.5-coder-1.5b-q4';

    return {
      hasWebGpu,
      gpuAdapter: gpuAdapterName,
      systemRamGb: ramGb,
      availableVramGb: hasWebGpu ? Math.round(ramGb * 0.5) : undefined,
      cpuCores,
      recommendedModelId: recommended,
    };
  }
}

// ─── Local Inference Adapter (Ollama-backed) ────────────────────

export class LocalWeightInferenceAdapter implements ModelAdapter {
  private weightManager: ModelWeightManager;
  private readonly ollamaBaseUrl: string;
  private registeredModels: Set<string> = new Set();

  constructor(weightManager: ModelWeightManager, ollamaBaseUrl?: string) {
    this.weightManager = weightManager;
    this.ollamaBaseUrl = (ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await proxiedFetch(`${this.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await proxiedFetch(`${this.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      const data: any = await res.json();
      return (data.models || []).map((m: any) => `local:${m.name}`);
    } catch {
      return [];
    }
  }

  /**
   * Make a downloaded GGUF usable: registers it with the local Ollama
   * server via /api/create (Modelfile FROM <path>) the first time it is used.
   */
  async loadModel(modelId: string): Promise<boolean> {
    await this.ensureOllamaModel(modelId);
    return true;
  }

  private async ensureOllamaModel(modelId: string): Promise<string> {
    const ollamaName = modelId.replace(/[^a-zA-Z0-9_.-]/g, '-');
    if (this.registeredModels.has(ollamaName)) return ollamaName;

    // Already present in Ollama?
    const tagsRes = await proxiedFetch(`${this.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) }).catch((err) => {
      throw new Error(`Ollama is not reachable at ${this.ollamaBaseUrl}: ${err.message}. Start Ollama to use local weights.`);
    });
    if (!tagsRes.ok) throw new Error(`Ollama returned HTTP ${tagsRes.status} on /api/tags`);
    const tags: any = await tagsRes.json();
    const present = (tags.models || []).some(
      (m: any) => m.name === ollamaName || m.name === `${ollamaName}:latest`
    );
    if (present) {
      this.registeredModels.add(ollamaName);
      return ollamaName;
    }

    const localPath = this.weightManager.getInstalledPath(modelId);
    if (!localPath) {
      throw new Error(
        `Local model "${modelId}" is not downloaded and not present in Ollama. Download it first via ModelWeightManager.startDownload("${modelId}") or run \`ollama pull\`.`
      );
    }

    const createRes = await proxiedFetch(`${this.ollamaBaseUrl}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: ollamaName, modelfile: `FROM ${localPath}`, stream: false }),
      signal: AbortSignal.timeout(120000),
    });
    if (!createRes.ok) {
      const detail = await createRes.text().catch(() => '');
      throw new Error(`Ollama failed to register local weight ${modelId}: HTTP ${createRes.status} ${detail}`.trim());
    }
    this.registeredModels.add(ollamaName);
    return ollamaName;
  }

  async complete(params: CompletionParams): Promise<CompletionResult> {
    const startTime = Date.now();
    const modelId = params.modelConfig.model.replace('local:', '');
    const ollamaName = await this.ensureOllamaModel(modelId);

    const response = await proxiedFetch(`${this.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaName,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        options: {
          temperature: params.modelConfig.temperature ?? 0.7,
          num_predict: params.modelConfig.maxTokens ?? 4096,
        },
      }),
      // Local generation can legitimately take minutes; the bound exists so
      // a wedged Ollama server surfaces an error instead of hanging forever.
      signal: AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Local Ollama inference failed: HTTP ${response.status} ${detail}`.trim());
    }

    const data: any = await response.json();
    const promptTokens = data.prompt_eval_count || 0;
    const completionTokens = data.eval_count || 0;

    return {
      id: uuid(),
      content: data.message?.content || '',
      finishReason: 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      costUsd: 0, // Local inference has no per-token cost
      latencyMs: Date.now() - startTime,
    };
  }

  async *stream(params: CompletionParams): AsyncGenerator<StreamEvent> {
    const modelId = params.modelConfig.model.replace('local:', '');
    const ollamaName = await this.ensureOllamaModel(modelId);

    const response = await fetchWithHeaderTimeout(`${this.ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaName,
        messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        options: {
          temperature: params.modelConfig.temperature ?? 0.7,
          num_predict: params.modelConfig.maxTokens ?? 4096,
        },
      }),
    }, 30000, 'Ollama streaming request');

    if (!response.ok || !response.body) {
      const detail = response.ok ? '' : await response.text().catch(() => '');
      throw new Error(`Local Ollama streaming failed: HTTP ${response.status} ${detail}`.trim());
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            yield { type: 'text', data: parsed.message.content };
          }
        } catch {
          // Non-JSON keep-alive line — ignore
        }
      }
    }

    yield { type: 'done', data: null };
  }
}
