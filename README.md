# OpenBot 🤖

> **Universal Autonomous AI Agent Platform** — Open Source, Model Agnostic, Cross-Platform Hardware Controller.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Turborepo](https://img.shields.io/badge/Turborepo-Monorepo-red.svg)](https://turbo.build/)

OpenBot is an open-source autonomous agent system engineered to unify physical devices (Android phones, desktop operating systems, headless browsers) with local open-weights reasoning (Ollama, DeepSeek R1, Qwen 2.5) and frontier cloud models (Claude 3.7 Sonnet, GPT-4o, Grok 3) through a zero-cloud privacy guarantee.

---

## ⚡ Key Capabilities

### 📱 1. Agentic Phone Mode (Real Android Hardware Bridge)
- **Universal ADB Daemon**: Native connectivity over USB or Wireless ADB (`tcp:5037`).
- **Real Touch & Gesture Dispatch**: Emits actual kernel touch, swipe, text injection, and key events via `adb shell input` or the native Android Accessibility Service.
- **UI Hierarchy Perception**: Real-time `uiautomator dump` XML parsing into accessibility nodes.
- **Native Android Companion**: Kotlin-based background Accessibility Service with an embedded HTTP control server (port 8765).

### 🖥️ 2. Desktop Mode ("Own Computer" Control)
- **Rust Tauri Architecture**: Native desktop controller (`apps/desktop`) with screen capture (xcap), input injection (enigo), and window/process control.
- **Node Desktop Bridge**: The core engine also drives the host desktop from Node via a PyAutoGUI bridge (real screenshots, mouse, keyboard) when Python + pyautogui are installed.
- **Visual Grounding**: Self-Operating Computer perception labels on-screen elements via an OmniParser-compatible endpoint or Tesseract OCR, then clicks/types by label.
- **Subprocess Shell Integration**: PowerShell, Bash, and Python execution with real stdout/stderr and exit codes.

### 🛡️ 3. Zero-Cloud Privacy Guarantee
- **Local GGUF Weights**: Native support for Ollama running DeepSeek R1 Distill (1.5B/7B), Qwen 2.5 Coder, and Llama 3.2.
- **Strict Offline Mode**: Toggle Zero-Cloud and every non-local HTTP/HTTPS request is blocked at the agent/model layer (cloud APIs included); loopback and private-LAN endpoints such as a local Ollama server stay reachable.
- **BYOK Key Vault**: AES-256-GCM encrypted local key storage (passphrase or machine key, `0600` files) for optional frontier cloud fallbacks.

### 🛠️ 4. Universal Tool & Execution Engine
- **26+ Built-in Tools**: Open Interpreter code execution (Python, Node.js, Shell), Playwright browser navigation, file system I/O, web search, and a safe-parser calculator — 39 registered tools in total (26 canonical + convenience aliases), each backed by a real implementation.
- **Teach-a-Task Studio**: Record your own desktop or phone workflows once; OpenBot compiles them into parameterized routines that replay through the same tool registry.
- **Episodic Memory & RL**: Persistent on-disk TF-IDF vector store (`.openbot_data/`) and a self-critique reinforcement engine for trajectory optimization.

### 🎙️ 5. vFlow Voice Workflows & Call Agent
- vFlow parses natural voice commands (wake word, intent, slots) and executes them through the phone/browser/desktop engines, reporting each step's real outcome.
- Outbound phone calls are placed through Twilio when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` are configured; without a provider the call API returns an explicit "not configured" error — calls are never simulated.

---

## 🏗️ Repository Architecture

```
openbot/
├── packages/
│   ├── core/            # Agent loop, model router, tools, memory, computer, phone, voice
│   ├── database/        # Prisma PostgreSQL schema (12 models) & singleton client
│   └── shared-types/    # Monorepo TypeScript contracts, DTOs & WebSocket events
├── services/
│   ├── api-gateway/     # NestJS API Gateway (Auth, Conversations, Skills, WebSockets)
│   └── ai-engine/       # NestJS AI Engine (Inference router, streaming, Ollama bridge)
├── apps/
│   ├── web/             # Next.js 15 App Router UI with glassmorphism design system
│   ├── desktop/         # Tauri + Rust native desktop agent
│   └── mobile/          # React Native + Expo mobile agent with Android Accessibility
├── docker-compose.yml   # Full stack orchestration (PostgreSQL, Redis, Ollama, API, AI, Web)
├── turbo.json           # Turborepo task pipeline
└── tsconfig.base.json   # Monorepo TypeScript base configuration
```

---

## 🚀 Quickstart

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker & Docker Compose (optional, for full containerized stack)
- [Ollama](https://ollama.ai) (optional, for local Zero-Cloud inference)

### 1. Clone & Install
```bash
git clone https://github.com/Shivay00001/openbot.git
cd openbot
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

### 3. Start Development Servers
Run the full web development workspace:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Verify the core engine
The core package ships a real test suite (browser automation against a local
page, tool registry, zero-cloud guard, key vault, memory persistence,
skill replay):
```bash
cd packages/core
npm test
```

---

## 🐳 Docker Deployment

### Full Stack (Web + API + AI Engine + Postgres + Redis + Ollama)
```bash
docker-compose up -d
```

### Free-Tier Minimalist Stack (Zero External Costs)
```bash
docker-compose -f docker-compose.free-tier.yml up -d
```

---

## 📱 Mobile App (React Native & Expo)

The mobile client is located in `apps/mobile`:
```bash
cd apps/mobile
npx expo start
```

### Android Native Accessibility Companion
The Kotlin source code for the Accessibility Service and local daemon is located in:
`apps/mobile/android/app/src/main/kotlin/com/openbot/agent/`

Features:
- `OpenBotAccessibilityService.kt`: Intercepts system events and executes gestures.
- `LocalPhoneServer.kt`: Embedded HTTP server listening on port `8765` (`/health`, `/screen/hierarchy`, `/action/tap|type|swipe|key|launch`).
- `OpenBotBridge.kt`: JavaScript-to-Kotlin bidirectional bridge.

---

## 🖥️ Desktop App (Tauri & Rust)

The desktop client is located in `apps/desktop`:
```bash
cd apps/desktop
npm run tauri dev
```

---

## 🔒 Security & Privacy

OpenBot is architected around the principle of user sovereignty:
- **No Telemetry**: No third-party analytics or tracker beacons.
- **Hardware Vault**: API keys are stored locally and only dispatched directly to provider endpoints via BYOK.
- **Permission Matrix**: Granular per-tool permissions (`always_allow`, `ask_each_time`, `block`).

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.
