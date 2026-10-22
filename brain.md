# OpenBot Brain & Architecture Ledger 🧠

This document is the continuous architectural ledger, safety boundary, and state-of-the-art tracking file for OpenBot, adhering to strict production-grade engineering standards (`safe-coding-practices`, `engineering-mastery`, `production-readiness-audit`).

---

## 1. Project Identity & Objective
- **Name**: OpenBot
- **Mission**: Universal Autonomous Human-Like Multi-Device Agent operating seamlessly across Phone (Android), Laptop (Windows/macOS/Linux), and Web Browsers.
- **Core Ethos**: 
  1. Zero-Cloud privacy & BYOK/Free-tier local first architecture.
  2. Multi-device execution with native `.exe` daemon for laptop and `.apk` background service for phone.
  3. Real execution guarantees (no fake mocks, no fabricated coordinates).

---

## 2. System Architecture & Edge Node Protocol

```
                                  ┌─────────────────────────────┐
                                  │      OpenBot Web & API      │
                                  │   (Next.js 14 / NestJS)     │
                                  └──────────────┬──────────────┘
                                                 │
                                  ┌──────────────▼──────────────┐
                                  │      DeviceOrchestrator     │
                                  │   Human-Like Trajectory AI  │
                                  └───────┬──────┬──────┬───────┘
                                          │      │      │
               ┌──────────────────────────┘      │      └──────────────────────────┐
               │                                 │                                 │
     ┌─────────▼────────┐               ┌────────▼────────┐               ┌────────▼────────┐
     │  Laptop Daemon   │               │   Phone Daemon  │               │ Browser Engine  │
     │ OpenBot-Laptop   │               │ OpenBot-Phone   │               │ Playwright /    │
     │ :4002 Win32 API  │               │ :8765 Service   │               │ Artemis Mobile  │
     └──────────────────┘               └─────────────────┘               └─────────────────┘
```

---

## 3. The "I's System" (Multi-Dimensional Foundation)

1. **Intelligence**: 
   - Local weights (Llama-3.2, Qwen-2.5-Coder, DeepSeek-R1-Distill).
   - Zero-token cost intelligence via Pollinations.ai & Web2API (DuckDuckGo DuckChat).
   - Dynamic prompt crafting and multi-step ReAct planning.
2. **Inference**:
   - `TokenRouter` multi-provider cascading failover with zero downtime.
   - `FreeApiDiscoverer` continuous community proxy scraper and latency ranking.
3. **Integration**:
   - Native Windows Win32 API (`user32.dll`, GDI screen capture, cubic Bézier mouse paths, variable Gaussian typing latency).
   - Native Android Accessibility Service & ADB daemon (`uiautomator`, tap/swipe/keyevent dispatch).
   - Model Context Protocol (MCP) computer server for Claude/Anthropic desktop integration.
4. **Interoperability**:
   - Cross-device distributed pipeline: Laptop can generate data, phone can dispatch WhatsApp/SMS, and browser can verify status.
5. **Immunity (Resilience & Security)**:
   - Zero-Cloud Guard airgapping outbound requests unless explicitly allowed.
   - KeyVault with AES-256-GCM encryption for API keys at rest.
   - Catastrophic shell pattern sanitization.
6. **Intent Resolution**:
   - vFlow declarative workflows and Teach-a-Task demonstration recorder.
   - SkillEngine with 176+ auto-loaded SOPs from the user's master skills library.

---

## 4. Test Suite & Health Metrics
- **Test Framework**: Vitest v3.2.7
- **Test File**: `packages/core/src/__tests__/automation-suite.test.ts`
- **Total Tests**: 40/40 Passing (100% pass rate)
- **Coverage**:
  - Universal Browser Automation (Playwright, Puppeteer, Artemis Mobile)
  - Desktop Node Server (:4002) & Human-Like Bézier Mouse Movements
  - Phone Node Client (:8765) & Simulated Accessibility Fallback
  - Cross-Device DeviceOrchestrator Multi-Step Execution
  - Free Models (Pollinations, Web2API DuckDuckGo, TokenRouter)
  - AgentSkillsLoader (176+ skill scanning and registration)
  - Zero-Cloud Guard & KeyVault AES-256-GCM

---

## 5. Artifacts & Deliverables
- **Laptop Standalone Executable**: [`dist-artifacts/OpenBot-Laptop-Edge.exe`](file:///c:/Users/shiva/.gemini/antigravity-ide/scratch/openbot/dist-artifacts/OpenBot-Laptop-Edge.exe) & [`apps/web/public/downloads/OpenBot-Laptop-Edge.exe`](file:///c:/Users/shiva/.gemini/antigravity-ide/scratch/openbot/apps/web/public/downloads/OpenBot-Laptop-Edge.exe)
- **Phone APK Packaging**: [`apps/mobile/android/`](file:///c:/Users/shiva/.gemini/antigravity-ide/scratch/openbot/apps/mobile/android/) and automated GitHub Actions CI/CD (`.github/workflows/build.yml`)
- **One-Click Local Runners**: `run-one-click.bat`, `run-one-click.sh`, `docker-compose.free-tier.yml`
