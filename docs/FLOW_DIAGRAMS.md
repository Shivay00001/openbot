# OpenBot: Architectural Flow Diagrams & Visual Blueprint 📊🗺️

Welcome to the comprehensive visual documentation and interactive system flow mapping of **OpenBot**. This document visually maps every critical pathway in the codebase, detailing data structures, communication protocols, state machines, and real-life analogies to make every subsystem effortless to understand.

---

## 1. High-Level Macro Architecture Flow

```mermaid
graph TD
    User([👤 User Prompt / Voice / Schedule]) --> WebUI["🌐 OpenBot Web Console (Next.js 14)"]
    WebUI --> API["⚡ Gateway & API Routes (/api/nodes, /api/chat)"]
    API --> Orchestrator["🧠 DeviceOrchestrator (packages/core/src/agent)"]

    subgraph "The Intelligence & Inference Layer (The Brain)"
        Orchestrator --> TokenRouter["🔀 TokenRouter"]
        TokenRouter -->|Primary 0$ Free| Pollinations["🌸 Pollinations.ai Text API"]
        TokenRouter -->|Fallback 0$ Free| Web2API["🦆 Web2API (DuckDuckGo DuckChat)"]
        TokenRouter -->|Fallback Local| Ollama["🦙 Ollama / Local GGUF Weights"]
        TokenRouter -->|Paid Option| OpenRouter["🌐 OpenRouter / OpenAI BYOK"]
        TokenRouter --> Discoverer["🔍 FreeApiDiscoverer (Live Proxy Scanner)"]
    end

    subgraph "The Knowledge & Skills Engine"
        Orchestrator --> SkillEngine["🛠️ SkillEngine"]
        SkillEngine --> SkillsLoader["📦 AgentSkillsLoader (176+ Specialized SOPs)"]
        SkillsLoader --> Memory["🧠 Episodic & Semantic Memory"]
    end

    subgraph "Physical Execution Layer (The Hands & Eyes)"
        Orchestrator -->|Target: laptop| LaptopNode["💻 Laptop Edge Daemon (:4002 Win32 / Native)"]
        Orchestrator -->|Target: phone| PhoneNode["📱 Phone Edge Client (:8765 Android Service)"]
        Orchestrator -->|Target: browser| BrowserEngine["🌍 Playwright / Puppeteer Headless Engine"]
    end

    LaptopNode --> ScreenWin32["🖥️ Windows GDI Screen Capture & Bézier Cursor"]
    PhoneNode --> ScreenAndroid["📲 Android uiautomator & Accessibility Tap/Swipe"]
    BrowserEngine --> DOM["📄 Live DOM Extraction & Interactive Elements"]
```

---

## 2. Cross-Device Autonomous Task Flow (Laptop ⇄ Phone ⇄ Browser)

### 💡 Real-Life Analogy
> Imagine an executive assistant who sits in your office. When you ask them: *"Review the quarterly balance sheet on my laptop, verify the supplier's website in Chrome, and send an approval confirmation via SMS on my phone"*, they don't do it with imaginary tools. They physically turn to the PC screen, move their hand along a natural human curve to open the spreadsheet, switch tabs to check the supplier's portal, and pick up the smartphone to tap the SMS app. OpenBot's `DeviceOrchestrator` does exactly this across digital edge sockets.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 User
    participant Orch as 🧠 DeviceOrchestrator
    participant TR as 🔀 TokenRouter
    participant Laptop as 💻 Laptop Daemon (:4002)
    participant Browser as 🌍 Browser Engine
    participant Phone as 📱 Phone Daemon (:8765)

    User->>Orch: "Check laptop report, verify site, message client on phone"
    Orch->>TR: Request task decomposition & routing plan
    TR-->>Orch: Plan: [1. Laptop OCR, 2. Browser scraping, 3. Phone SMS]

    rect rgb(230, 245, 255)
        Note over Orch,Laptop: Step 1: Laptop Execution
        Orch->>Laptop: POST /screenshot
        Laptop-->>Orch: High-res screen frame
        Orch->>Laptop: POST /mouse (Human Bézier Curve to coordinates)
        Laptop-->>Orch: 200 OK (Mouse arrived with human cadence)
        Orch->>Laptop: POST /type "Finance_Report_2026.xlsx"
        Laptop-->>Orch: 200 OK (Randomized typing latency)
    end

    rect rgb(240, 255, 240)
        Note over Orch,Browser: Step 2: Browser Verification
        Orch->>Browser: Navigate to supplier portal
        Browser-->>Orch: DOM content & verification token
    end

    rect rgb(255, 245, 230)
        Note over Orch,Phone: Step 3: Phone Execution
        Orch->>Phone: POST /action/tap (Open WhatsApp/Messages)
        Phone-->>Orch: 200 OK (Accessibility Node Clicked)
        Orch->>Phone: POST /action/type "Report verified & approved."
        Phone-->>Orch: 200 OK (Text injected)
        Orch->>Phone: POST /action/tap (Send button)
        Phone-->>Orch: 200 OK (Message dispatched)
    end

    Orch-->>User: ✅ Full multi-device task accomplished with verified trajectory
```

---

## 3. Laptop Win32 Native Control & Human-Like Kinematics

### 💡 Real-Life Analogy
> If a robotic hand instantly teleports a mouse from `(0,0)` to `(800, 600)` in 0 milliseconds, anti-bot security flags it immediately as automated fraud. A real human arm accelerates smoothly, follows a slight arc (a cubic Bézier curve), slows down before reaching the target button, and pauses slightly before clicking. OpenBot's `WindowsNativeDriver` and `OpenBot-Laptop-Edge.exe` incorporate these physics.

```mermaid
flowchart TD
    Start([Execute Mouse Move]) --> Calc["Compute Source (x1, y1) and Destination (x2, y2)"]
    Calc --> ControlPoints["Generate Randomized Control Points (C1, C2) with Arc Drift"]
    ControlPoints --> Steps["Divide path into 15 to 25 micro-interpolation steps"]
    
    subgraph "Bézier Curve Interpolation"
        Steps --> Formula["B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃"]
        Formula --> Velocity["Apply Human Ease-In Ease-Out Velocity Curve"]
        Velocity --> SendWin32["Call Win32 SendInput / SetCursorPos"]
        SendWin32 --> Sleep["Sleep random 5ms - 15ms between micro-steps"]
    end
    
    Sleep --> Arrive["Arrive at Target (x2, y2)"]
    Arrive --> MicroPause["Human Micro-Pause (80ms - 200ms)"]
    MicroPause --> Click["Send MOUSEEVENTF_LEFTDOWN followed by MOUSEEVENTF_LEFTUP"]
    Click --> Finish([Action Completed])
```

---

## 4. Free-Tier Zero-Token Cost Inference Engine (TokenRouter)

### 💡 Real-Life Analogy
> Think of an intelligent electricity generator for a hospital. When standard mains power (paid OpenAI API) isn't desired or fails, the generator instantly switches to solar panels (Pollinations.ai Free Text API). If the sun is blocked, it switches immediately to wind power (Web2API DuckDuckGo Free Engine) or local battery reserves (Local Ollama GGUF weights) with zero interruption to life support.

```mermaid
stateDiagram-v2
    [*] --> TokenRouterInit: User Prompt Received
    TokenRouterInit --> PollinationsCheck: Preferred = 'pollinations'
    
    state PollinationsCheck {
        [*] --> PollinationsRequest: POST https://text.pollinations.ai/
        PollinationsRequest --> PollinationsSuccess: 200 OK & Stream
        PollinationsRequest --> PollinationsFail: 429 Rate Limit / 503 Outage
    }
    
    PollinationsSuccess --> CompleteResponse: Return Generated Text
    
    PollinationsFail --> Web2APIFallback: Trigger Zero-Downtime Failover
    
    state Web2APIFallback {
        [*] --> DuckHandshake: GET https://duckduckgo.com/duckchat/v1/status
        DuckHandshake --> ExtractToken: Extract x-vqd-4 Session Token
        ExtractToken --> DuckChatPost: POST /duckchat/v1/chat (gpt-4o-mini / claude-3)
        DuckChatPost --> DuckSuccess: 200 OK Text Response
        DuckChatPost --> DuckFail: Failover Error
    }
    
    DuckSuccess --> CompleteResponse
    
    DuckFail --> LocalOllamaFallback: Fallback to Local Edge Model
    LocalOllamaFallback --> OllamaExecute: POST http://127.0.0.1:11434/api/chat
    OllamaExecute --> CompleteResponse
    
    CompleteResponse --> [*]
```

---

## 5. Agent Skills Dynamic Discovery & Ingestion Flow

```mermaid
flowchart LR
    Repo[("📁 ai-agent-skills/ (176+ Repositories)")] --> Loader["AgentSkillsLoader.scanSkills()"]
    Loader --> Parser["YAML Frontmatter & Markdown SOP Parser"]
    Parser --> Categorizer{"Category Classification"}
    
    Categorizer -->|Security, Pentest, Reverse| Cat1["Security & Forensics"]
    Categorizer -->|BigQuery, Spark, dbt, GCP| Cat2["Cloud & Data Engineering"]
    Categorizer -->|Loop, Multi-Agent, Superpowers| Cat3["Agentic Architecture"]
    Categorizer -->|DevOps, Docker, K8s, CI| Cat4["DevOps & Infrastructure"]
    Categorizer -->|Browser, Phone, iOS, macOS| Cat5["Device & Automation"]
    Categorizer -->|All Others| Cat6["Engineering Mastery"]

    Cat1 & Cat2 & Cat3 & Cat4 & Cat5 & Cat6 --> Converter["convertToOpenBotSkills()"]
    Converter --> Registry[("SkillEngine Registry (In-Memory & Indexed)")]
    Registry --> Runtime["Available for 1-Click Injection in Tasks"]
```
