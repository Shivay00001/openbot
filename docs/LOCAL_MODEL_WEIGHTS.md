# 🧠 OpenBot Local Model Weights

OpenBot includes a local weight system in `@openbot/core/local-weights`
(`packages/core/src/local-weights/index.ts`) with two parts:

1. **`ModelWeightManager`** — downloads, verifies, and catalogs GGUF weights
   on disk.
2. **`LocalWeightInferenceAdapter`** — runs inference on those weights
   through a local Ollama server.

> **How inference actually works:** OpenBot does **not** embed an in-process
> llama.cpp / node-llama-cpp runtime. Downloaded GGUF files are registered
> with your local Ollama server (`POST /api/create` with a
> `FROM <path>` Modelfile) and served via `/api/chat`. This keeps prompts
> 100% on-device while reusing Ollama's optimized runtimes (CPU, Metal,
> CUDA, Vulkan). If Ollama is not running or a weight is not installed,
> inference calls fail with the real error — responses are never fabricated.

---

## 1. Downloads (real, resumable, verified)

`startDownload(modelId)`:

- Streams the file from the catalog URL to `.openbot_models/<id>.gguf.part`.
- Resumes interrupted downloads with an HTTP `Range` request when a `.part`
  file exists.
- Emits live progress (bytes, %, speed, ETA) via `onDownloadProgress`.
- Verifies the finished file with SHA-256 (against the catalog checksum when
  one is published; the computed digest is always recorded in
  `.openbot_models/manifest.json`) and atomically renames it into place.
- `deleteModel(modelId)` removes the file and its manifest entry.

Downloads respect Zero-Cloud mode: with the guard enabled, remote weight
URLs are blocked like any other non-local egress (download weights *before*
going offline).

## 2. Curated Weight Catalog

| Model ID | Parameter Size | Quantization | Download Size | Best For | Hardware Req. |
|---|---|---|---|---|---|
| `deepseek-r1-distill-qwen-1.5b-q4` | 1.5B | Q4_K_M | **1.18 GB** | Deep Reasoning & Tool Calling | 4 GB RAM, 2 GB VRAM |
| `qwen2.5-coder-1.5b-q4` | 1.5B | Q4_K_M | **1.12 GB** | Code Synthesis & Terminal Commands | 4 GB RAM, 2 GB VRAM |
| `llama-3.2-1b-instruct-q4` | 1B | Q4_K_M | **810 MB** | Mobile Phones & Fast Web Chat | 2 GB RAM, 1 GB VRAM |
| `llama-3.2-3b-instruct-q4` | 3B | Q4_K_M | **2.02 GB** | Balanced Mobile & Laptop General Agent | 6 GB RAM, 3 GB VRAM |
| `smollm2-1.7b-instruct-q4` | 1.7B | Q4_K_M | **1.04 GB** | Compact Embedded & Low-Resource | 4 GB RAM, 1.5 GB VRAM |
| `deepseek-r1-distill-qwen-7b-q4` | 7B | Q4_K_M | **4.68 GB** | Frontier Competition-Level Logic | 16 GB RAM, 6 GB VRAM |
| `whisper-base-voice` | 74M | Q5_K_M | **142 MB** | On-Device Speech-to-Text (whisper.cpp format) | 2 GB RAM |

`detectHardware()` reads the real OS memory/CPU in Node (or
`navigator` + WebGPU in browsers) and recommends a catalog model that fits.

## 3. Inference Flow

```
LocalWeightInferenceAdapter.complete({ model: 'local:<catalog-id>', ... })
  → ensureOllamaModel(id)
      → GET  /api/tags            (is it already in Ollama?)
      → POST /api/create          (FROM <downloaded .gguf path>, first use only)
  → POST /api/chat                (stream or non-stream)
  → CompletionResult { content, usage from Ollama counters, costUsd: 0 }
```

## 4. Zero-Cloud Mode

With Zero-Cloud on, the model router only allows local providers (Ollama /
LM Studio / local weights) and the egress guard blocks every non-local URL.
Prompt tokens, conversation context, and reasoning traces never leave the
host device, and per-token cost is **$0.00** for local inference.
