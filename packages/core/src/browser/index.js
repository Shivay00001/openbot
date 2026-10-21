"use strict";
/**
 * OpenBot Universal Browser Automation Suite 🌐
 * Inspired by Manus, Hark AI, and Artemis mobile phone browser control.
 *
 * Supports:
 * - Playwright (Chromium, WebKit, Firefox)
 * - Puppeteer & CDP (Chrome DevTools Protocol)
 * - Selenium WebDriver 4
 * - WebdriverIO
 * - Browser-Use agentic automation
 * - Artemis Phone Browser Controller for mobile phone browser control
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
exports.MultiTabBrowserAgent = exports.BrowserAutomationEngine = exports.BrowserUseAdapter = exports.WebdriverIOAdapter = exports.SeleniumAdapter = exports.PuppeteerAdapter = exports.PlaywrightAdapter = exports.ArtemisPhoneBrowserController = void 0;
__exportStar(require("./types.js"), exports);
var artemis_phone_browser_js_1 = require("./artemis-phone-browser.js");
Object.defineProperty(exports, "ArtemisPhoneBrowserController", { enumerable: true, get: function () { return artemis_phone_browser_js_1.ArtemisPhoneBrowserController; } });
var playwright_adapter_js_1 = require("./adapters/playwright-adapter.js");
Object.defineProperty(exports, "PlaywrightAdapter", { enumerable: true, get: function () { return playwright_adapter_js_1.PlaywrightAdapter; } });
var puppeteer_adapter_js_1 = require("./adapters/puppeteer-adapter.js");
Object.defineProperty(exports, "PuppeteerAdapter", { enumerable: true, get: function () { return puppeteer_adapter_js_1.PuppeteerAdapter; } });
var selenium_adapter_js_1 = require("./adapters/selenium-adapter.js");
Object.defineProperty(exports, "SeleniumAdapter", { enumerable: true, get: function () { return selenium_adapter_js_1.SeleniumAdapter; } });
var webdriverio_adapter_js_1 = require("./adapters/webdriverio-adapter.js");
Object.defineProperty(exports, "WebdriverIOAdapter", { enumerable: true, get: function () { return webdriverio_adapter_js_1.WebdriverIOAdapter; } });
var browser_use_adapter_js_1 = require("./adapters/browser-use-adapter.js");
Object.defineProperty(exports, "BrowserUseAdapter", { enumerable: true, get: function () { return browser_use_adapter_js_1.BrowserUseAdapter; } });
var engine_js_1 = require("./engine.js");
Object.defineProperty(exports, "BrowserAutomationEngine", { enumerable: true, get: function () { return engine_js_1.BrowserAutomationEngine; } });
// Backwards-compatible alias for existing agent code
const engine_js_2 = require("./engine.js");
class MultiTabBrowserAgent extends engine_js_2.BrowserAutomationEngine {
}
exports.MultiTabBrowserAgent = MultiTabBrowserAgent;
//# sourceMappingURL=index.js.map