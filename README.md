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
- **Native Android Companion**: Kotlin-based background Accessibility Service and WebSocket daemon (port 8765).

### 🖥️ 2. Desktop Mode ("Own Computer" Control)
- **Rust Tauri Architecture**: Low-latency native desktop controller (`apps/desktop`).
- **Screen Perception**: High-FPS monitor capture with window tracking and active process telemetry.
- **Mouse & Keyboard Injection**: Enigma-free hardware input simulation.
- **Subprocess Shell Integration**: PowerShell, Bash, and Python execution with live stdout streaming.

### 🛡️ 3. Zero-Cloud Privacy Guarantee
- **Local GGUF Weights**: Native support for Ollama running DeepSeek R1 Distill (1.5B/7B), Qwen 2.5 Coder, and Llama 3.2.
- **Strict Offline Mode**: Toggle Zero-Cloud to guarantee zero external HTTP/HTTPS egress.
- **BYOK Key Vault**: AES-256 encrypted local key storage for optional frontier cloud fallbacks.

### 🛠️ 4. Universal Tool & Execution Engine
- **26+ Built-in Tools**: Open Interpreter code execution (Python, Node.js, Shell), Playwright browser navigation, file system I/O, network querying, and calculator.
- **Teach-a-Task Studio**: Record your own desktop or phone workflows once; OpenBot compiles them into reusable autonomous routines.
- **Episodic Memory & RL**: Persistent on-disk vector store (`.openbot_data/`) and self-critique reinforcement engine for trajectory optimization.

### 🎙️ 5. vFlow Voice Workflows & Real-time Call Agent
- Autonomous voice pipelines executing complex tasks with natural voice prompts.
- WebRTC / WebSocket low-latency voice streaming.

---

## 🏗️ Repository Architecture

```
openbot/
├── packages/
│   ├── core/            # Agent loop, model router, 26 tools, memory, computer, phone, voice
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
git clone https://github.com/your-org/openbot.git
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

---

## ⚡ 1-Click Free Tier Cloud Hosting (Zero Cost)

OpenBot is pre-configured to run 100% free with zero infrastructure cost using world-class free-tier providers:

| Layer | Free Tier Provider | Limits / Perks | Config File |
| :--- | :--- | :--- | :--- |
| **Web Dashboard** | [Vercel](https://vercel.com) (Hobby) | Unlimited Serverless Next.js 15, Global CDN | [`vercel.json`](vercel.json) |
| **Full Stack + DB**| [Render](https://render.com) | Free Web Service + Managed PostgreSQL 16 | [`render.yaml`](render.yaml) |
| **Cloud Database** | [Neon](https://neon.tech) / [Supabase](https://supabase.com) | Serverless Postgres with pooled connections | `DATABASE_URL` |
| **AI Inference** | [Groq](https://groq.com) / [Ollama](https://ollama.ai) | DeepSeek R1 & Llama 3.3 70B (300+ T/s free) | `GROQ_API_KEY` |

### 🚀 Option A: Deploy to Vercel (1-Click)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FShivay00001%2Fopenbot&project-name=openbot&root-directory=apps/web)

1. Click the button above to import `Shivay00001/openbot`.
2. Set Root Directory to `apps/web`.
3. Add your free `DATABASE_URL` (from Neon or Supabase) and `JWT_SECRET`.
4. Hit **Deploy** — your live dashboard is instantly online!

### 🚀 Option B: Deploy to Render Blueprint (1-Click Full Stack)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Shivay00001/openbot)

Render reads [`render.yaml`](render.yaml) to automatically provision:
- Managed PostgreSQL database (`openbot-db`, Free Plan)
- OpenBot Web frontend (`openbot-web`, Free Plan)
- API Gateway backend (`openbot-api-gateway`, Free Plan)

---

## 🐳 Docker Multi-Device Orchestration (One-Click)

### 🚀 1-Click All-in-One Deployment (OS + Browser + Phone Bridge + Ollama)
Run directly via the included launcher script:
- **Windows**: Double-click `run-one-click.bat` or run:
  ```cmd
  run-one-click.bat
  ```
- **Linux / macOS**:
  ```bash
  chmod +x run-one-click.sh && ./run-one-click.sh
  ```
- **npm command**:
  ```bash
  npm run docker:one-click
  ```

This automatically orchestrates:
1. `openbot-os-desktop`: Full Ubuntu XFCE Desktop with live noVNC web streaming on port `6080`.
2. `openbot-browser-sandbox`: Chromium + Chrome DevTools Protocol (CDP) on port `3002`.
3. `openbot-phone-bridge`: Real physical USB & Wireless ADB daemon + MJPEG screen streaming on port `8000`.
4. `openbot-web`: Next.js 15 UI on port `3000`.
5. `openbot-api-gateway` (:4000) & `openbot-ai-engine` (:4001).
6. PostgreSQL 16 (:5432), Redis 7 (:6379), and Ollama (:11434).

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
- `LocalPhoneServer.kt`: Embedded HTTP/WebSocket server listening on port `8765`.
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
