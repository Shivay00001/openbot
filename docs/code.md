# OpenBot: Code Architecture & Production Tour 💻🔍

This document walks through the exact files, types, and logic that make up OpenBot's core execution pipeline.

---

## 1. Directory & Code Map

```
packages/core/
├── src/
│   ├── agent/
│   │   ├── index.ts                 # ReAct AgentLoop with context, step limits, abort controller
│   │   └── device-orchestrator.ts   # Multi-device planner (Laptop, Phone, Browser routing)
│   ├── models/
│   │   ├── index.ts                 # ModelRouter & OpenAI-compatible adapters
│   │   ├── pollinations-adapter.ts  # Pollinations.ai 100% free text API
│   │   ├── web2api-adapter.ts       # DuckDuckGo DuckChat free token adapter
│   │   ├── token-router.ts          # Automatic zero-downtime failover router
│   │   └── free-api-discoverer.ts   # Community reverse proxy scanner
│   ├── desktop/
│   │   └── index.ts                 # DesktopNodeServer (:4002), Bézier curves, WindowsNativeDriver
│   ├── phone/
│   │   └── index.ts                 # PhoneNodeClient (:8765), ADB & Accessibility bridges
│   ├── browser/
│   │   └── index.ts                 # Playwright, Puppeteer & Artemis phone browser
│   ├── skills/
│   │   ├── index.ts                 # SkillEngine, demonstration recorder & compiler
│   │   └── agent-skills-loader.ts   # Dynamic parser for 176+ external agent skills
│   ├── security/
│   │   ├── index.ts                 # ZeroCloudGuard & KeyVault (AES-256-GCM)
│   │   └── zero-cloud-guard.ts      # Subnet checking & outbound IP airgap enforcement
│   └── __tests__/
│       └── automation-suite.test.ts # 40 unit and integration tests across all subsystems
```

---

## 2. Key Code Snippets & Contracts

### A. Bézier Mouse Interpolation (`packages/core/src/desktop/index.ts`)
```typescript
export function calculateBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const cx = 3 * (p1.x - p0.x);
  const bx = 3 * (p2.x - p1.x) - cx;
  const ax = p3.x - p0.x - cx - bx;

  const cy = 3 * (p1.y - p0.y);
  const by = 3 * (p2.y - p1.y) - cy;
  const ay = p3.y - p0.y - cy - by;

  const xt = ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + p0.x;
  const yt = ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + p0.y;

  return { x: Math.round(xt), y: Math.round(yt) };
}
```

### B. Dynamic Skill Ingestion (`packages/core/src/skills/agent-skills-loader.ts`)
```typescript
const discovered = this.scanSkills();
const openBotSkills = this.convertToOpenBotSkills(discovered);
for (const skill of openBotSkills) {
  skillEngine.registerSkill(skill);
}
```

### C. Automated TokenRouter Failover (`packages/core/src/models/token-router.ts`)
```typescript
for (const provider of this.failoverChain) {
  try {
    const response = await this.executeProvider(provider, prompt);
    if (response) return response;
  } catch (err) {
    console.warn(`Provider ${provider} failed, cascading to next available route...`);
  }
}
```
