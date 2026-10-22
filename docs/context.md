# OpenBot: System Context & Mental Model 🗺️

## 1. System Vision & Problem Statement
Traditional AI agents (such as ChatGPT or Claude desktop) operate inside walled sandboxes: they generate text, chat in browser tabs, or require expensive cloud API tokens ($20-$50/month minimum). Meanwhile, computer use frameworks like Anthropic's Computer Use or AutoGPT are clunky, require complex Docker containers, fail anti-bot tests due to synthetic cursor jumps, and do not natively support physical mobile phones.

**OpenBot** solves this with a **Unified Multi-Device Physical Agent Fabric**:
1. **Edge-First Daemons**: Your actual Laptop and Phone run lightweight native daemons (`:4002` Win32 executable and `:8765` Android background accessibility service).
2. **True Human-Like Physical Control**: Mouse movements utilize cubic Bézier curves with randomized jerk/acceleration; typing uses randomized Gaussian inter-keystroke intervals; phone interactions utilize Android accessibility trees and ADB.
3. **Zero Mandatory Token Cost ($0/month)**: Combines Pollinations.ai free text models, Web2API DuckDuckGo DuckChat gateways (`gpt-4o-mini`, `claude-3-haiku`), and local GGUF weights with zero cloud fees.
4. **Zero-Cloud Privacy Airgap**: Built-in Zero-Cloud Guard blocks outbound data leakage, keeping corporate and personal credentials safe inside an AES-256-GCM encrypted KeyVault.
5. **176+ Extensible Agent Skills**: Built-in ingestion of specialized industry SOPs across DevOps, Security, Data Engineering, and App Architecture.

---

## 2. Component Boundaries & Responsibilities

| Subsystem | Source Location | Core Responsibility |
|---|---|---|
| **Core Agent Platform** | `packages/core/src/agent` | ReAct reasoning loop, `DeviceOrchestrator`, human trajectory planning. |
| **Model & Token Routing** | `packages/core/src/models` | `TokenRouter`, `PollinationsModelAdapter`, `Web2ApiModelAdapter`, `FreeApiDiscoverer`. |
| **Edge Hardware Daemons** | `packages/core/src/desktop`, `src/phone`, `scripts/` | `DesktopNodeServer` (:4002), `OpenBot-Laptop-Edge.exe`, `PhoneNodeClient` (:8765), `OpenBot-Phone-Edge.apk`. |
| **Browser Engine** | `packages/core/src/browser` | Playwright & Puppeteer browser automation with Artemis mobile emulation. |
| **Skills Ingestion** | `packages/core/src/skills` | `AgentSkillsLoader` scanning and converting 176+ skills from `ai-agent-skills`. |
| **Security & Vault** | `packages/core/src/security` | `zeroCloudGuard`, `KeyVault` (AES-256-GCM), permission checks. |
| **Next.js Web Console** | `apps/web/src` | Edge nodes dashboard, live terminal execution console, 1-click installer downloads. |
