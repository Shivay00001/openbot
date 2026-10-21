# 🧠 OpenBot Integrated Local Model Weights Engine

OpenBot includes a first-class **On-Device Inference & Local Weight System** (`@openbot/core/local-weights`).

Instead of forcing users to install third-party command line utilities or pay high API token bills, OpenBot allows apps to directly download, cache, and execute quantized weights in-process.

---

## 1. Supported Model Weight Formats

1. **GGUF (GPT-Generated Unified Format)**:
   - Primary format for Desktop (Tauri/Node) and Mobile apps.
   - Powered by `llama.cpp` and `node-llama-cpp` bindings.
   - Supports CPU AVX2/AVX-512, Apple Silicon Metal, NVIDIA CUDA, and Vulkan acceleration.
2. **WebGPU / WebLLM**:
   - Primary format for Browser & Web app (`apps/web`).
   - Runs directly inside Chrome / Edge / Firefox using WebGPU compute shaders.
   - Zero installation required.
3. **ONNX / SafeTensors**:
   - Used for auxiliary tasks: Whisper speech-to-text, sentence embeddings, and OCR vision models.

---

## 2. Curated Weight Catalog

| Model ID | Parameter Size | Quantization | Download Size | Best For | Hardware Req. |
|---|---|---|---|---|---|
| `deepseek-r1-distill-qwen-1.5b-q4` | 1.5B | Q4_K_M | **1.18 GB** | Deep Reasoning & Tool Calling | 4 GB RAM, 2 GB VRAM |
| `qwen2.5-coder-1.5b-q4` | 1.5B | Q4_K_M | **1.12 GB** | Code Synthesis & Terminal Commands | 4 GB RAM, 2 GB VRAM |
| `llama-3.2-1b-instruct-q4` | 1B | Q4_K_M | **810 MB** | Mobile Phones & Fast Web Chat | 2 GB RAM, 1 GB VRAM |
| `llama-3.2-3b-instruct-q4` | 3B | Q4_K_M | **2.02 GB** | Balanced Mobile & Laptop General Agent | 6 GB RAM, 3 GB VRAM |
| `smollm2-1.7b-instruct-q4` | 1.7B | Q4_K_M | **1.04 GB** | Compact Embedded & Low-Resource | 4 GB RAM, 1.5 GB VRAM |
| `deepseek-r1-distill-qwen-7b-q4` | 7B | Q4_K_M | **4.68 GB** | Frontier Competition-Level Logic | 16 GB RAM, 6 GB VRAM |
| `whisper-base-voice` | 74M | Q5_K_M | **142 MB** | On-Device Speech-to-Text | 2 GB RAM |

---

## 3. How Zero-Cloud Mode Works

When Zero-Cloud mode is activated:
1. The model router intercepts every prompt and diverts execution to `LocalWeightInferenceAdapter`.
2. Model weights are mapped directly into system memory or GPU buffers.
3. Prompt tokens, conversation context, and reasoning traces never leave the host device.
4. Token generation cost is **$0.00**.
