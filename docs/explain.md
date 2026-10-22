# OpenBot: Deep Explanation & Engineering School 🎓💡

This document explains the core engineering concepts, mathematical models, and design patterns utilized in OpenBot in plain, accessible language with intuitive real-life analogies.

---

## 1. Kinematics of Human Computer Interaction

### Why Synthetic Clicks Fail
Standard automated testing tools (like Selenium or raw xdotool) invoke `click(x, y)` by instantly changing the cursor coordinates in a single frame. Modern fraud detection, anti-scraping systems, and enterprise telemetry immediately detect this:
- **Instantaneous Acceleration**: $\vec{a} = \infty$. No human arm has infinite acceleration.
- **Straight Euclidean Vectors**: Perfect straight lines between two points never happen when a human hand grips a mouse.
- **Isochronous Keystrokes**: Typing with fixed delays (e.g. exactly 50ms between characters) is a clear bot signal.

### OpenBot's Mathematical Solution: Cubic Bézier Motion & Gaussian Jitter
In `packages/core/src/desktop/index.ts` and `OpenBot-Laptop-Edge.exe`, mouse trajectories are calculated using cubic Bézier curves:
$$B(t) = (1-t)^3 P_0 + 3(1-t)^2 t P_1 + 3(1-t) t^2 P_2 + t^3 P_3, \quad t \in [0, 1]$$
- $P_0$: Starting cursor coordinate.
- $P_3$: Target element coordinate.
- $P_1, P_2$: Dynamically computed control points with perpendicular deviation and random arc drift simulating natural arm extension.
- **Velocity Profiling**: The step parameter $t$ is non-linear, adhering to Fitts's Law (ease-in, peak velocity in the mid-third, ease-out as the cursor decelerates near the target).
- **Keystroke Cadence**: Keystrokes are modeled via a Gaussian distribution:
$$\Delta t \sim \mathcal{N}(\mu=65\text{ms}, \sigma=20\text{ms})$$
with micro-pauses (150ms-300ms) inserted after punctuation or space characters to mimic cognitive typing rhythms.

---

## 2. Web2API: Free Intelligence Reverse Handshakes

### How DuckDuckGo DuckChat Web2API Works
Instead of requiring a paid OpenAI API key ($0.03/1k tokens), `packages/core/src/models/web2api-adapter.ts` interfaces with DuckDuckGo's privacy-focused free AI chat:
1. **Handshake Step**: Performs a preliminary request to `https://duckduckgo.com/duckchat/v1/status` with `x-vqd-accept: 1`.
2. **Session Token Extraction**: Extracts the ephemeral verification token `x-vqd-4` from response headers.
3. **Chat Request**: Dispatches the user prompt to `https://duckduckgo.com/duckchat/v1/chat` carrying the `x-vqd-4` header and specifying backend model `gpt-4o-mini` or `claude-3-haiku`.
4. **Zero-Token Cost**: DuckDuckGo subsidizes the inference for search queries, allowing OpenBot users to operate state-of-the-art LLMs for free.

---

## 3. The Edge Node Protocol (:4002 and :8765)

OpenBot decouples the user interface from the target hardware using lightweight REST/WebSocket micro-daemons:
- **Laptop Node (:4002)**: Runs as a native Win32 background daemon. It exposes endpoints:
  - `GET /health`: Node status, OS metadata, active monitors.
  - `POST /screenshot`: High-speed GDI screen capture formatted as PNG or JPEG.
  - `POST /mouse`: Executes smooth Bézier path to target $(X, Y)$ and issues left/right click.
  - `POST /type`: Injects keystrokes with realistic delays.
  - `POST /hotkey`: Dispatches combination keys (`Ctrl+C`, `Win+R`, `Alt+Tab`).
- **Phone Node (:8765)**: Runs inside an Android background service or ADB bridge:
  - `GET /health`: Device model, battery level, Android API version.
  - `POST /action/tap`: Tap coordinates on touch surface.
  - `POST /action/swipe`: Natural touch swipe gestures.
  - `POST /action/type`: Injects text via Android IME or `input text`.
  - `POST /action/key`: Injects hardware keys (Home, Back, Recents, Power).

This architecture allows a central OpenBot instance (hosted locally or in a cloud instance) to control any number of remote laptops and phones securely across your LAN or Wireguard mesh!
