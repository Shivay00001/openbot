/**
 * @openbot/core — Main Export
 * The universal intelligence brain of OpenBot.
 * Shared across Web, Desktop (Tauri), Mobile (React Native), and API Gateway.
 */

// Types
export * from './types/index.js';

// Agent Loop Engine (ReAct Plan-Execute-Observe-Reflect)
export { AgentLoop, createAgent } from './agent/index.js';
export type { AgentConfig } from './agent/index.js';

// Model Router & BYOK Providers
export { ModelRouter, OpenAICompatibleAdapter, DEFAULT_PROVIDERS } from './models/index.js';
export type { ModelAdapter, CompletionParams, CompletionResult } from './models/index.js';

// Local Model Weight & On-Device Inference System
export {
  ModelWeightManager,
  LocalWeightInferenceAdapter,
  LOCAL_WEIGHT_CATALOG,
} from './local-weights/index.js';
export type {
  ModelWeightInfo,
  WeightDownloadProgress,
  HardwareProfile,
} from './local-weights/index.js';

// Tool Registry & Built-ins
export { ToolRegistry } from './tools/index.js';
export type { ToolHandler } from './tools/index.js';

// Memory System, Vector Store & Reinforcement Learning
export {
  MemoryManager,
  InMemoryStore,
  EpisodicMemoryEngine,
  IndexedDBMemoryStore,
  DiskMemoryStore,
  CloudPrismaMemoryStore,
  ReinforcementLearningEngine,
} from './memory/index.js';
export type {
  MemoryStore,
  EpisodicMemoryEpisode,
  EpisodicStep,
  ProceduralSkillTrajectory,
  TrajectoryEvaluationResult,
} from './memory/index.js';

// Agentic Phone Mode & Mobile Automation 📱
export {
  AgenticPhoneController,
  DEFAULT_PHONE_APPS,
  AdbController,
  AppiumBridge,
  AccessibilityServiceBridge,
  ArtemisPhoneNavigator,
} from './phone/index.js';
export type {
  PhoneElementNode,
  PhoneScreenState,
  PhoneNotification,
  PhoneGesture,
  PhoneKeyCode,
  PhoneAppInfo,
  AdbDevice,
  AppiumCapabilities,
  AccessibilityEventPayload,
  PhoneTaskPlan,
} from './phone/index.js';

// Agentic Desktop Mode 💻 ("Own Computer" Mode)
export {
  AgenticDesktopController,
} from './desktop/index.js';
export type {
  DesktopScreenBounds,
  DesktopWindowInfo,
  ShellExecutionResult,
  FileItemInfo,
} from './desktop/index.js';

// Computer Control Suite 🖥️ (Self-Operating Computer, Open Interpreter, MCP)
export {
  WindowsNativeDriver,
  SelfOperatingComputerEngine,
  OpenInterpreterEngine,
  McpComputerServer,
  PyAutoGUIAdapter,
  RobotJSAdapter,
} from './computer/index.js';
export type {
  DisplayInfo,
  WindowInfo,
  ScreenPoint,
  ScreenBounds,
  VisualGroundingElement,
  InterpreterExecutionOptions,
  InterpreterExecutionResult,
  McpToolRequest,
  McpToolResponse,
} from './computer/index.js';

// Universal Browser Automation Suite 🌐 (Manus / Hark / Artemis Phone Browser)
export {
  BrowserAutomationEngine,
  MultiTabBrowserAgent,
  ArtemisPhoneBrowserController,
  PlaywrightAdapter,
  PuppeteerAdapter,
  SeleniumAdapter,
  WebdriverIOAdapter,
  BrowserUseAdapter,
  BROWSER_DEVICE_PRESETS,
} from './browser/index.js';
export type {
  BrowserTab,
  BrowserElement,
  BrowserViewportState,
  BrowserEngineType,
  BrowserDevicePreset,
  ExtractedPageContent,
  ArtemisMobileTouchGesture,
  ArtemisPhoneBrowserOptions,
} from './browser/index.js';

// vFlow Voice Command Engine 🎙️⚡
export {
  vFlowEngine,
  vFlowCommandParser,
  BUILTIN_VFLOW_WORKFLOWS,
} from './vflow/index.js';
export type {
  vFlowCommand,
  vFlowIntent,
  vFlowWorkflow,
  vFlowNode,
  vFlowEdge,
  vFlowExecutionSession,
  vFlowExecutionStep,
  vFlowNodeType,
} from './vflow/index.js';

// Security: Zero-Cloud egress guard & encrypted key vault 🔐
export {
  ZeroCloudGuard,
  ZeroCloudBlockedError,
  zeroCloudGuard,
  isLocalUrl,
  installGlobalFetchGuard,
  uninstallGlobalFetchGuard,
  KeyVault,
} from './security/index.js';
export type { KeyVaultOptions } from './security/index.js';

// Voice Pipeline & Autonomous Phone Call Agent 🎙️📞
export {
  VoicePipelineAgent,
  CURATED_VOICE_PERSONAS,
} from './voice/index.js';
export type {
  VoicePersona,
  ActivePhoneCallSession,
} from './voice/index.js';

// Skill Engine & Teach-a-Task Recorder ⚡ (GrokBot style)
export {
  SkillEngine,
  BUILTIN_SKILLS,
} from './skills/index.js';
export type {
  RecordedAction,
} from './skills/index.js';
