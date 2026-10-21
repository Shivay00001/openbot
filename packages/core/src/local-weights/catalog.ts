/**
 * Local model catalog — pure data + types (no Node imports), safe to
 * import from browser bundles. The download manager and inference
 * adapter live in ./index.ts and re-export everything here.
 */

export interface ModelWeightInfo {
  id: string;
  name: string;
  family: 'llama' | 'qwen' | 'deepseek' | 'smollm' | 'phi' | 'gemma' | 'whisper';
  description: string;
  parameterSize: string; // e.g. "1.5B", "3B", "7B"
  quantization: 'Q4_K_M' | 'Q5_K_M' | 'Q8_0' | 'FP16' | 'q4f16_1';
  sizeBytes: number;
  sizeFormatted: string; // e.g. "1.2 GB"
  contextLength: number;
  downloadUrl: string;
  sha256?: string;
  recommendedHardware: {
    minRamGb: number;
    preferredVramGb: number;
    webgpuSupported: boolean;
    mobileOptimized: boolean;
  };
  tags: string[];
  capabilities: ('chat' | 'code' | 'reasoning' | 'vision' | 'audio')[];
}

export interface WeightDownloadProgress {
  modelId: string;
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  status: 'idle' | 'downloading' | 'verifying' | 'ready' | 'error' | 'paused';
  error?: string;
}

export interface HardwareProfile {
  hasWebGpu: boolean;
  gpuAdapter?: string;
  systemRamGb?: number;
  availableVramGb?: number;
  cpuCores: number;
  recommendedModelId: string;
}

// ─── Curated Local Model Catalog ────────────────────────────────

export const LOCAL_WEIGHT_CATALOG: ModelWeightInfo[] = [
  {
    id: 'deepseek-r1-distill-qwen-1.5b-q4',
    name: 'DeepSeek R1 Distill Qwen (1.5B)',
    family: 'deepseek',
    description: 'State-of-the-art distilled reasoning model. Excels at complex logic, step-by-step thinking, and tool planning.',
    parameterSize: '1.5B',
    quantization: 'Q4_K_M',
    sizeBytes: 1_180_000_000,
    sizeFormatted: '1.18 GB',
    contextLength: 32768,
    downloadUrl: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    recommendedHardware: { minRamGb: 4, preferredVramGb: 2, webgpuSupported: true, mobileOptimized: true },
    tags: ['reasoning', 'recommended', 'fast', 'low-vram'],
    capabilities: ['chat', 'reasoning', 'code'],
  },
  {
    id: 'qwen2.5-coder-1.5b-q4',
    name: 'Qwen 2.5 Coder (1.5B)',
    family: 'qwen',
    description: 'Specialized coding and agentic model. Fast code synthesis, bug fixing, tool calling, and shell command generation.',
    parameterSize: '1.5B',
    quantization: 'Q4_K_M',
    sizeBytes: 1_120_000_000,
    sizeFormatted: '1.12 GB',
    contextLength: 32768,
    downloadUrl: 'https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf',
    recommendedHardware: { minRamGb: 4, preferredVramGb: 2, webgpuSupported: true, mobileOptimized: true },
    tags: ['code', 'developer', 'tool-calling'],
    capabilities: ['chat', 'code'],
  },
  {
    id: 'llama-3.2-1b-instruct-q4',
    name: 'Llama 3.2 Instruct (1B)',
    family: 'llama',
    description: 'Meta flagship ultra-compact model. Extreme speed, low memory footprint, runs natively on phones and web browsers.',
    parameterSize: '1B',
    quantization: 'Q4_K_M',
    sizeBytes: 810_000_000,
    sizeFormatted: '810 MB',
    contextLength: 131072,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    recommendedHardware: { minRamGb: 2, preferredVramGb: 1, webgpuSupported: true, mobileOptimized: true },
    tags: ['ultra-light', 'phone-ready', 'webgpu', 'low-memory'],
    capabilities: ['chat'],
  },
  {
    id: 'llama-3.2-3b-instruct-q4',
    name: 'Llama 3.2 Instruct (3B)',
    family: 'llama',
    description: 'Balanced power and portability from Meta. High general intelligence, multi-turn conversation, and agent tool execution.',
    parameterSize: '3B',
    quantization: 'Q4_K_M',
    sizeBytes: 2_020_000_000,
    sizeFormatted: '2.02 GB',
    contextLength: 131072,
    downloadUrl: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    recommendedHardware: { minRamGb: 6, preferredVramGb: 3, webgpuSupported: true, mobileOptimized: true },
    tags: ['balanced', 'smart', 'agentic'],
    capabilities: ['chat', 'code'],
  },
  {
    id: 'smollm2-1.7b-instruct-q4',
    name: 'SmolLM2 Instruct (1.7B)',
    family: 'smollm',
    description: 'Hugging Face compact marvel. Trained on high-quality synthetic educational & agentic datasets.',
    parameterSize: '1.7B',
    quantization: 'Q4_K_M',
    sizeBytes: 1_040_000_000,
    sizeFormatted: '1.04 GB',
    contextLength: 8192,
    downloadUrl: 'https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf',
    recommendedHardware: { minRamGb: 4, preferredVramGb: 1.5, webgpuSupported: true, mobileOptimized: true },
    tags: ['compact', 'open-weights', 'efficient'],
    capabilities: ['chat'],
  },
  {
    id: 'deepseek-r1-distill-qwen-7b-q4',
    name: 'DeepSeek R1 Distill Qwen (7B)',
    family: 'deepseek',
    description: 'Frontier-grade local reasoning. Matches large cloud models in math, coding competitions, and complex research tasks.',
    parameterSize: '7B',
    quantization: 'Q4_K_M',
    sizeBytes: 4_680_000_000,
    sizeFormatted: '4.68 GB',
    contextLength: 32768,
    downloadUrl: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    recommendedHardware: { minRamGb: 16, preferredVramGb: 6, webgpuSupported: false, mobileOptimized: false },
    tags: ['frontier', 'high-power', 'laptop-desktop-only'],
    capabilities: ['chat', 'reasoning', 'code'],
  },
  {
    id: 'whisper-base-voice',
    name: 'Whisper Base (Audio STT)',
    family: 'whisper',
    description: 'Local on-device automatic speech recognition. Zero cloud audio upload for maximum voice privacy.',
    parameterSize: '74M',
    quantization: 'Q5_K_M',
    sizeBytes: 142_000_000,
    sizeFormatted: '142 MB',
    contextLength: 448,
    downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    recommendedHardware: { minRamGb: 2, preferredVramGb: 0.5, webgpuSupported: true, mobileOptimized: true },
    tags: ['voice', 'speech-to-text', 'audio', 'fast'],
    capabilities: ['audio'],
  },
];
