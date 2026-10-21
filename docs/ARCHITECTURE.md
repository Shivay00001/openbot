# OpenBot System Architecture

This document describes the architecture of OpenBot **as implemented in this
repository** — every component named here exists in the codebase, with its
source path noted.

## 1. Monorepo Layout

```
openbot/
├── packages/
│   ├── core/          # @openbot/core — the agent platform (TypeScript, ESM)
│   ├── database/      # @openbot/database — Prisma schema + client (PostgreSQL)
│   └── shared-types/  # @openbot/shared-types — cross-package contracts
├── services/
│   ├── api-gateway/   # NestJS — REST API (auth, users, chat, skills, keys, billing)
│   └── ai-engine/     # NestJS — inference routing service
├── apps/
│   ├── web/           # Next.js App Router UI + API routes
│   ├── desktop/       # Tauri (Rust) desktop agent
│   └── mobile/        # Expo React Native app + native Kotlin companion
├── docker-compose.yml / docker-compose.free-tier.yml
└── turbo.json
```

## 2. Core Engine (`packages/core`)

### 2.1 Agent Loop — `src/agent/index.ts`

`AgentLoop` is a ReAct-style loop: it builds a context window from the system
prompt + conversation, asks the `ModelRouter` for a completion (streaming or
not), executes any requested tool calls through the `ToolRegistry` with a
`ToolExecutionContext` (user, conversation, permissions), appends results,
and repeats until the model stops, `maxSteps` is reached, or the run is
aborted. Token/cost accounting is tracked in `AgentState`.

`AgentConfig.zeroCloud` flips the router into Zero-Cloud mode and wires the
`generate_content` tool to the router.

### 2.2 Model Router — `src/models/index.ts`

`ModelRouter` routes completions across providers:

- **OpenAI-compatible adapter** (`OpenAICompatibleAdapter`) for OpenAI,
  DeepSeek, Groq, Gemini (OpenAI-compatible endpoint), LM Studio, and any
  custom `baseUrl`.
- **Ollama adapter** for local models (`/api/chat`, streaming + non-streaming).
- **Local weights adapter** (`src/local-weights`) — see §2.8.

All provider HTTP traffic in the router goes through the Zero-Cloud guard
(see §3).

### 2.3 Tool Registry — `src/tools/index.ts`

The registry maps `ToolDefinition`s (name, description, JSON-Schema
parameters, category, `requiresApproval`, permission level) to handlers.
Execution enforces approval callbacks for gated tools and hard-blocks
catastrophic shell patterns. 39 tools are registered (26 canonical +
convenience aliases), including:

- **Search/fetch**: `web_search` (keyless Bing HTML with DuckDuckGo
  fallback), `read_url` / `fetch_url`.
- **Browser**: `browser_navigate`, `browser_click`, `browser_fill`,
  `browser_extract`, `take_screenshot`, `artemis_phone_browse`.
- **Filesystem** (jailed to `OPENBOT_WORKSPACE_ROOT` or cwd): `read_file`,
  `write_file`, `list_directory`.
- **Execution**: `run_terminal` (real host shell), `execute_code` /
  `open_interpreter_exec` (Open Interpreter), `calculator` (safe
  recursive-descent parser — no `eval`).
- **Phone**: `phone_tap`, `phone_type`, `phone_launch_app`,
  `phone_screenshot`, `phone_send_message`, `phone_initiate_call`,
  `artemis_phone_workflow`.
- **Desktop**: `computer_screenshot`, `computer_click`, `computer_type`,
  `computer_visual_grounding_perceive`, `computer_visual_tag_action`.
- **Memory/voice/RL**: `memory_store`, `memory_recall`,
  `memory_recall_episodic`, `vflow_execute_command`,
  `reinforcement_evaluate_trajectory` (requires the real executed steps —
  it refuses empty trajectories).

### 2.4 Browser Automation — `src/browser/`

`BrowserAutomationEngine` switches between adapters implementing
`UniversalBrowserAdapter`:

| Engine | Implementation |
|---|---|
| `playwright` | Real Chromium via Playwright (locates a system/cached Chromium build) |
| `puppeteer` | Real Chromium via `puppeteer-core` against the same executable |
| `selenium` | W3C WebDriver REST client → Selenium Grid (`OPENBOT_WEBDRIVER_URL`, default `http://localhost:4444`) |
| `webdriverio` | W3C WebDriver REST client → WebdriverIO/Appium endpoint (default `http://localhost:9515`) |
| `browser_use` | DOM-indexed layer over the Playwright adapter (click/type by element index) |
| `artemis_mobile` | `ArtemisPhoneBrowserController` — real Playwright mobile emulation (device presets, touch) |

Adapters without a reachable browser/server return explicit failures —
never simulated success.

### 2.5 Phone Mode — `src/phone/`

`AgenticPhoneController` supports three backends:

- **ADB** (`AdbController`): spawns the real `adb` binary with argv arrays
  (no shell interpolation). Screen state comes from parsing the actual
  `uiautomator dump` XML (`src/phone/hierarchy.ts`); screenshots via
  `exec-out screencap`.
- **Accessibility service** (`AccessibilityServiceBridge`): HTTP client for
  the on-device Kotlin server (see §5.3).
- **Simulator**: a virtual device used for planning/tests; every result and
  screen state is flagged `simulated: true`.

`ArtemisPhoneNavigator` decomposes a natural-language goal into steps and
executes them through the controller, stopping at the first failed step.
`AppiumBridge` is a W3C WebDriver client for an Appium server
(`http://127.0.0.1:4723`).

### 2.6 Desktop Mode — `src/desktop/`, `src/computer/`

- `AgenticDesktopController`: real shell execution, directory listing, and
  detached app launching from Node; mouse/keyboard/display delegate to a
  computer adapter.
- `PyAutoGUIAdapter`: runs a fixed Python bridge script (parameters via
  JSON on stdin) driving pyautogui/pygetwindow/Pillow. Without
  Python/pyautogui/display it reports honest failures.
- `WindowsNativeDriver`: PowerShell/WinForms + PrintWindow capture on
  Windows; throws on other platforms instead of fabricating coordinates.
- `RobotJSAdapter`: loads the optional `robotjs` native module when the
  host installed it.
- `SelfOperatingComputerEngine`: screenshot → element detection via a
  pluggable detector (OmniParser-compatible HTTP endpoint via
  `OPENBOT_OMNIPARSER_URL`, or the Tesseract OCR CLI) → labeled tag actions.
  With no detector available it returns the screenshot with an empty
  element list and says so.
- `OpenInterpreterEngine`: writes code to a temp file and executes it with
  an argv array (`python3 file.py`, `node file.js`, `bash file.sh`,
  `powershell -File file.ps1`) with timeout, output caps, and risk
  classification.
- `McpComputerServer`: exposes the computer tools over an MCP-shaped
  request/response interface.

### 2.7 Memory — `src/memory/`

- **Semantic memory**: `MemoryManager` over pluggable stores —
  `InMemoryStore`, `DiskMemoryStore` (JSON files in `.openbot_data/`),
  `IndexedDBMemoryStore` (real IndexedDB in browsers, in-memory fallback in
  Node), `CloudPrismaMemoryStore` (Prisma/PostgreSQL when a client is
  provided). Search is TF-IDF cosine similarity (`src/memory/vector.ts`).
- **Episodic memory**: `EpisodicMemoryEngine` persists full task episodes
  (goal, steps, outcome, reflection) to `.openbot_data/episodes.json` via
  the disk store and retrieves similar episodes by TF-IDF similarity.
- **Reinforcement**: `ReinforcementLearningEngine` scores trajectories
  (completion, efficiency, safety, error penalty), produces critiques, and
  distills successful episodes into procedural playbooks.

### 2.8 Local Weights — `src/local-weights/`

`ModelWeightManager` downloads GGUF weights from the catalog (DeepSeek R1
distills, Qwen 2.5 Coder, Llama 3.2, SmolLM2, Whisper) with streamed,
resumable HTTP downloads and SHA-256 verification into `.openbot_models/`
plus a manifest. `LocalWeightInferenceAdapter` serves inference through a
local Ollama server: downloaded GGUFs are registered via `/api/create` and
chatted via `/api/chat`. There is no in-process llama.cpp binding — if
Ollama is down or the weight is missing, calls fail with the real error.

### 2.9 Skills (Teach-a-Task) — `src/skills/`

`SkillEngine` implements the canonical skill model from `src/types`
(`Skill` → `SkillDefinition` → `SkillStep[]`). Recording
(`startRecording` → `recordAction` → `stopAndCompileRecording`) compiles a
demonstration into steps that reference real tools; `executeSkill` replays
them through the `ToolRegistry` with `{{param}}` substitution and stops at
the first failing step. Custom skills persist to `.openbot_data/skills.json`.

### 2.10 Voice & vFlow — `src/voice/`, `src/vflow/`

- `VoicePipelineAgent`: real Twilio REST calls when `TWILIO_*` env vars are
  set (explicit "not configured" error otherwise), OpenAI-compatible
  `/audio/speech` synthesis when a key exists, and an RMS-energy VAD for PCM
  frames.
- `vFlowEngine` + `vFlowCommandParser`: wake-word detection, intent
  classification, and slot extraction for voice commands; execution goes
  through the phone controller / browser engine / interpreter and reports
  each step's real status.

## 3. Security Layer — `src/security/`

- **Zero-Cloud guard** (`zero-cloud.ts`): a process-wide egress guard. When
  enabled, `guardedFetch` and the model router reject any non-local URL
  (loopback, RFC1918, link-local, `*.local`/`*.lan`/`*.home` remain
  allowed). Cloud provider calls in the router fail fast with
  `ZeroCloudBlockedError` before any network traffic.
- **Key vault** (`key-vault.ts`): AES-256-GCM with a scrypt-derived key
  (passphrase from `OPENBOT_VAULT_PASSPHRASE`, or a machine key file),
  stored in `.openbot_data/vault.json` with `0600` permissions. Decryption
  with a wrong passphrase fails closed (returns `null`).
- **API gateway keys**: `services/api-gateway` stores BYOK keys with
  AES-256-GCM (`ENCRYPTION_KEY` env, no built-in fallback secret) and
  decrypts them only at call time in the chat service.

## 4. Services

### 4.1 API Gateway — `services/api-gateway` (NestJS)

Modules: Auth, Users, Conversations, Chat (proxies to the AI engine,
enforces billing quotas, decrypts BYOK keys via `KeysService`), Skills
(definitions stored in PostgreSQL; `execute` runs them for real through
`@openbot/core`'s `SkillEngine` + `ToolRegistry` and records the execution
status/output), Keys, Billing, Models, Health. Rate limiting via
`ThrottlerModule` (100 req/60s/IP). Prisma access is provided by a global
`DatabaseModule`.

### 4.2 AI Engine — `services/ai-engine` (NestJS)

Inference endpoints consumed by the gateway; delegates model execution to
`@openbot/core`'s `ModelRouter`.

### 4.3 Database — `packages/database`

Prisma schema (users, conversations, messages, API keys, skills +
executions, billing, usage) targeting PostgreSQL.

## 5. Apps

### 5.1 Web — `apps/web` (Next.js)

App Router UI (chat, browser, phone, desktop, skills, voice, local weights
views) plus API routes under `src/app/api`:

- `chat` / `chat/stream`: intent-routed tool execution + Ollama/BYOK model
  replies; episodes recorded with their real outcomes; streaming emits an
  explicit error event when Ollama is unreachable (no synthetic fallback
  text).
- `browser`: fetch-based page reader (title, links, readable text).
- `computer`: MCP computer tools, interpreter, visual grounding.
- `phone/adb`: delegates to the core `AdbController` with strict input
  validation (host:port, package name, key codes).
- `fs`: workspace-jailed file browsing (separator-safe traversal check).
- `shell`: host terminal for Desktop Mode (cwd jailed to the workspace;
  optional `OPENBOT_API_TOKEN` header check).
- `memory`, `artemis`, `vflow`, `models/ollama`: thin routes over the core
  engines and the local Ollama server.

### 5.2 Desktop — `apps/desktop` (Tauri + Rust)

Rust commands provide screen capture (xcap), input injection (enigo),
window enumeration/focus, and process/shell control to the Tauri frontend.

### 5.3 Mobile — `apps/mobile` (Expo + Kotlin)

The React Native UI controls the phone through the bundled Kotlin
companion (`android/app/src/main/kotlin/com/openbot/agent/`):

- `OpenBotAccessibilityService.kt` — gesture/text injection and hierarchy
  extraction via Android's Accessibility framework.
- `LocalPhoneServer.kt` — embedded HTTP server on port 8765 (`/health`,
  `/screen/hierarchy`, `/action/tap|type|swipe|key|launch`).
- `OpenBotBridge.kt` — JS↔Kotlin bridge.
- The core `AccessibilityServiceBridge` is the TypeScript client for the
  same server, so host-side agents and the on-device UI share one protocol.

## 6. Data Flow — One Chat Request

```
Web UI → POST /api/chat (apps/web)
  → intent router picks a tool (ToolRegistry in @openbot/core)
      → ADB / Playwright / interpreter / shell / memory …
  → else local Ollama /api/chat, else BYOK cloud provider
  → episode (with real outcome) → EpisodicMemoryEngine → .openbot_data/
  → JSON reply { content, thinking, toolCalls, latencyMs }
```

## 7. Persistence Map

| Data | Location |
|---|---|
| Episodes, memories, playbooks | `.openbot_data/` (JSON, via DiskMemoryStore) |
| Custom skills | `.openbot_data/skills.json` |
| Encrypted API keys (local) | `.openbot_data/vault.json` (AES-256-GCM, 0600) |
| Downloaded model weights | `.openbot_models/` + `manifest.json` (SHA-256 recorded) |
| Cloud/multi-user data | PostgreSQL via Prisma (`packages/database`) |
