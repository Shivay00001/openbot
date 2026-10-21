"use strict";
/**
 * @openbot/core — Main Export
 * The universal intelligence brain of OpenBot.
 * Shared across Web, Desktop (Tauri), Mobile (React Native), and API Gateway.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_SKILLS = exports.SkillEngine = exports.CURATED_VOICE_PERSONAS = exports.VoicePipelineAgent = exports.BUILTIN_VFLOW_WORKFLOWS = exports.vFlowCommandParser = exports.vFlowEngine = exports.BROWSER_DEVICE_PRESETS = exports.BrowserUseAdapter = exports.WebdriverIOAdapter = exports.SeleniumAdapter = exports.PuppeteerAdapter = exports.PlaywrightAdapter = exports.ArtemisPhoneBrowserController = exports.MultiTabBrowserAgent = exports.BrowserAutomationEngine = exports.RobotJSAdapter = exports.PyAutoGUIAdapter = exports.McpComputerServer = exports.OpenInterpreterEngine = exports.SelfOperatingComputerEngine = exports.WindowsNativeDriver = exports.AgenticDesktopController = exports.ArtemisPhoneNavigator = exports.AccessibilityServiceBridge = exports.AppiumBridge = exports.AdbController = exports.DEFAULT_PHONE_APPS = exports.AgenticPhoneController = exports.ReinforcementLearningEngine = exports.CloudPrismaMemoryStore = exports.DiskMemoryStore = exports.IndexedDBMemoryStore = exports.EpisodicMemoryEngine = exports.InMemoryStore = exports.MemoryManager = exports.ToolRegistry = exports.LOCAL_WEIGHT_CATALOG = exports.LocalWeightInferenceAdapter = exports.ModelWeightManager = exports.DEFAULT_PROVIDERS = exports.OpenAICompatibleAdapter = exports.ModelRouter = exports.createAgent = exports.AgentLoop = void 0;
// Types
__exportStar(require("./types/index.js"), exports);
// Agent Loop Engine (ReAct Plan-Execute-Observe-Reflect)
var index_js_1 = require("./agent/index.js");
Object.defineProperty(exports, "AgentLoop", { enumerable: true, get: function () { return index_js_1.AgentLoop; } });
Object.defineProperty(exports, "createAgent", { enumerable: true, get: function () { return index_js_1.createAgent; } });
// Model Router & BYOK Providers
var index_js_2 = require("./models/index.js");
Object.defineProperty(exports, "ModelRouter", { enumerable: true, get: function () { return index_js_2.ModelRouter; } });
Object.defineProperty(exports, "OpenAICompatibleAdapter", { enumerable: true, get: function () { return index_js_2.OpenAICompatibleAdapter; } });
Object.defineProperty(exports, "DEFAULT_PROVIDERS", { enumerable: true, get: function () { return index_js_2.DEFAULT_PROVIDERS; } });
// Local Model Weight & On-Device Inference System
var index_js_3 = require("./local-weights/index.js");
Object.defineProperty(exports, "ModelWeightManager", { enumerable: true, get: function () { return index_js_3.ModelWeightManager; } });
Object.defineProperty(exports, "LocalWeightInferenceAdapter", { enumerable: true, get: function () { return index_js_3.LocalWeightInferenceAdapter; } });
Object.defineProperty(exports, "LOCAL_WEIGHT_CATALOG", { enumerable: true, get: function () { return index_js_3.LOCAL_WEIGHT_CATALOG; } });
// Tool Registry & Built-ins
var index_js_4 = require("./tools/index.js");
Object.defineProperty(exports, "ToolRegistry", { enumerable: true, get: function () { return index_js_4.ToolRegistry; } });
// Memory System, Vector Store & Reinforcement Learning
var index_js_5 = require("./memory/index.js");
Object.defineProperty(exports, "MemoryManager", { enumerable: true, get: function () { return index_js_5.MemoryManager; } });
Object.defineProperty(exports, "InMemoryStore", { enumerable: true, get: function () { return index_js_5.InMemoryStore; } });
Object.defineProperty(exports, "EpisodicMemoryEngine", { enumerable: true, get: function () { return index_js_5.EpisodicMemoryEngine; } });
Object.defineProperty(exports, "IndexedDBMemoryStore", { enumerable: true, get: function () { return index_js_5.IndexedDBMemoryStore; } });
Object.defineProperty(exports, "DiskMemoryStore", { enumerable: true, get: function () { return index_js_5.DiskMemoryStore; } });
Object.defineProperty(exports, "CloudPrismaMemoryStore", { enumerable: true, get: function () { return index_js_5.CloudPrismaMemoryStore; } });
Object.defineProperty(exports, "ReinforcementLearningEngine", { enumerable: true, get: function () { return index_js_5.ReinforcementLearningEngine; } });
// Agentic Phone Mode & Mobile Automation 📱
var index_js_6 = require("./phone/index.js");
Object.defineProperty(exports, "AgenticPhoneController", { enumerable: true, get: function () { return index_js_6.AgenticPhoneController; } });
Object.defineProperty(exports, "DEFAULT_PHONE_APPS", { enumerable: true, get: function () { return index_js_6.DEFAULT_PHONE_APPS; } });
Object.defineProperty(exports, "AdbController", { enumerable: true, get: function () { return index_js_6.AdbController; } });
Object.defineProperty(exports, "AppiumBridge", { enumerable: true, get: function () { return index_js_6.AppiumBridge; } });
Object.defineProperty(exports, "AccessibilityServiceBridge", { enumerable: true, get: function () { return index_js_6.AccessibilityServiceBridge; } });
Object.defineProperty(exports, "ArtemisPhoneNavigator", { enumerable: true, get: function () { return index_js_6.ArtemisPhoneNavigator; } });
// Agentic Desktop Mode 💻 ("Own Computer" Mode)
var index_js_7 = require("./desktop/index.js");
Object.defineProperty(exports, "AgenticDesktopController", { enumerable: true, get: function () { return index_js_7.AgenticDesktopController; } });
// Computer Control Suite 🖥️ (Self-Operating Computer, Open Interpreter, MCP)
var index_js_8 = require("./computer/index.js");
Object.defineProperty(exports, "WindowsNativeDriver", { enumerable: true, get: function () { return index_js_8.WindowsNativeDriver; } });
Object.defineProperty(exports, "SelfOperatingComputerEngine", { enumerable: true, get: function () { return index_js_8.SelfOperatingComputerEngine; } });
Object.defineProperty(exports, "OpenInterpreterEngine", { enumerable: true, get: function () { return index_js_8.OpenInterpreterEngine; } });
Object.defineProperty(exports, "McpComputerServer", { enumerable: true, get: function () { return index_js_8.McpComputerServer; } });
Object.defineProperty(exports, "PyAutoGUIAdapter", { enumerable: true, get: function () { return index_js_8.PyAutoGUIAdapter; } });
Object.defineProperty(exports, "RobotJSAdapter", { enumerable: true, get: function () { return index_js_8.RobotJSAdapter; } });
// Universal Browser Automation Suite 🌐 (Manus / Hark / Artemis Phone Browser)
var index_js_9 = require("./browser/index.js");
Object.defineProperty(exports, "BrowserAutomationEngine", { enumerable: true, get: function () { return index_js_9.BrowserAutomationEngine; } });
Object.defineProperty(exports, "MultiTabBrowserAgent", { enumerable: true, get: function () { return index_js_9.MultiTabBrowserAgent; } });
Object.defineProperty(exports, "ArtemisPhoneBrowserController", { enumerable: true, get: function () { return index_js_9.ArtemisPhoneBrowserController; } });
Object.defineProperty(exports, "PlaywrightAdapter", { enumerable: true, get: function () { return index_js_9.PlaywrightAdapter; } });
Object.defineProperty(exports, "PuppeteerAdapter", { enumerable: true, get: function () { return index_js_9.PuppeteerAdapter; } });
Object.defineProperty(exports, "SeleniumAdapter", { enumerable: true, get: function () { return index_js_9.SeleniumAdapter; } });
Object.defineProperty(exports, "WebdriverIOAdapter", { enumerable: true, get: function () { return index_js_9.WebdriverIOAdapter; } });
Object.defineProperty(exports, "BrowserUseAdapter", { enumerable: true, get: function () { return index_js_9.BrowserUseAdapter; } });
Object.defineProperty(exports, "BROWSER_DEVICE_PRESETS", { enumerable: true, get: function () { return index_js_9.BROWSER_DEVICE_PRESETS; } });
// vFlow Voice Command Engine 🎙️⚡
var index_js_10 = require("./vflow/index.js");
Object.defineProperty(exports, "vFlowEngine", { enumerable: true, get: function () { return index_js_10.vFlowEngine; } });
Object.defineProperty(exports, "vFlowCommandParser", { enumerable: true, get: function () { return index_js_10.vFlowCommandParser; } });
Object.defineProperty(exports, "BUILTIN_VFLOW_WORKFLOWS", { enumerable: true, get: function () { return index_js_10.BUILTIN_VFLOW_WORKFLOWS; } });
// Voice Pipeline & Autonomous Phone Call Agent 🎙️📞
var index_js_11 = require("./voice/index.js");
Object.defineProperty(exports, "VoicePipelineAgent", { enumerable: true, get: function () { return index_js_11.VoicePipelineAgent; } });
Object.defineProperty(exports, "CURATED_VOICE_PERSONAS", { enumerable: true, get: function () { return index_js_11.CURATED_VOICE_PERSONAS; } });
// Skill Engine & Teach-a-Task Recorder ⚡ (GrokBot style)
var index_js_12 = require("./skills/index.js");
Object.defineProperty(exports, "SkillEngine", { enumerable: true, get: function () { return index_js_12.SkillEngine; } });
Object.defineProperty(exports, "BUILTIN_SKILLS", { enumerable: true, get: function () { return index_js_12.BUILTIN_SKILLS; } });
//# sourceMappingURL=index.js.map