"use strict";
/**
 * Unified Browser Automation Engine 🌐
 * Orchestrates Playwright, Puppeteer, Selenium, WebdriverIO, Browser-Use, and Artemis Phone Browser.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserAutomationEngine = void 0;
const uuid_1 = require("uuid");
const playwright_adapter_js_1 = require("./adapters/playwright-adapter.js");
const puppeteer_adapter_js_1 = require("./adapters/puppeteer-adapter.js");
const selenium_adapter_js_1 = require("./adapters/selenium-adapter.js");
const webdriverio_adapter_js_1 = require("./adapters/webdriverio-adapter.js");
const browser_use_adapter_js_1 = require("./adapters/browser-use-adapter.js");
const artemis_phone_browser_js_1 = require("./artemis-phone-browser.js");
class BrowserAutomationEngine {
    activeEngineType;
    currentAdapter;
    adapters = new Map();
    tabs = new Map();
    activeTabId;
    options;
    constructor(options) {
        this.options = {
            defaultEngine: 'playwright',
            headless: true,
            ...options,
        };
        this.activeEngineType = this.options.defaultEngine;
        // Register all adapters
        this.adapters.set('playwright', new playwright_adapter_js_1.PlaywrightAdapter());
        this.adapters.set('puppeteer', new puppeteer_adapter_js_1.PuppeteerAdapter());
        this.adapters.set('selenium', new selenium_adapter_js_1.SeleniumAdapter());
        this.adapters.set('webdriverio', new webdriverio_adapter_js_1.WebdriverIOAdapter());
        this.adapters.set('browser_use', new browser_use_adapter_js_1.BrowserUseAdapter());
        this.adapters.set('artemis_mobile', new artemis_phone_browser_js_1.ArtemisPhoneBrowserController({
            devicePreset: this.options.devicePreset || 'iphone_15_pro',
        }));
        this.currentAdapter = this.adapters.get(this.activeEngineType) || this.adapters.get('playwright');
        const initialTab = {
            id: (0, uuid_1.v4)(),
            url: 'https://duckduckgo.com',
            title: 'DuckDuckGo — Privacy, simplified.',
            isLoading: false,
            canGoBack: false,
            canGoForward: false,
            createdAt: Date.now(),
        };
        this.tabs.set(initialTab.id, initialTab);
        this.activeTabId = initialTab.id;
    }
    /**
     * Switch the active automation backend dynamically (e.g. from desktop Playwright to Artemis phone browser)
     */
    async switchEngine(engine) {
        const targetAdapter = this.adapters.get(engine);
        if (!targetAdapter) {
            throw new Error(`Browser automation engine "${engine}" is not registered.`);
        }
        this.activeEngineType = engine;
        this.currentAdapter = targetAdapter;
        await this.currentAdapter.initialize({
            headless: this.options.headless,
            devicePreset: this.options.devicePreset,
            proxyUrl: this.options.proxyUrl,
        });
    }
    getActiveEngine() {
        return this.activeEngineType;
    }
    /**
     * Get active Artemis mobile controller instance if using mobile phone browser mode
     */
    getArtemisController() {
        return this.adapters.get('artemis_mobile');
    }
    async getBrowserState() {
        const activeTab = this.tabs.get(this.activeTabId) || Array.from(this.tabs.values())[0];
        const elements = await this.currentAdapter.getInteractiveElements();
        const screenshot = await this.currentAdapter.captureScreenshot();
        return {
            activeTabId: this.activeTabId,
            tabs: Array.from(this.tabs.values()),
            currentUrl: activeTab.url,
            pageTitle: activeTab.title,
            viewportDimensions: { width: 1280, height: 800 },
            screenshotBase64: screenshot,
            interactiveElements: elements,
            engine: this.activeEngineType,
            isHeadless: this.options.headless ?? true,
            devicePreset: this.options.devicePreset,
        };
    }
    async openTab(url = 'https://google.com') {
        const tab = {
            id: (0, uuid_1.v4)(),
            url,
            title: 'New Tab',
            isLoading: false,
            canGoBack: false,
            canGoForward: false,
            createdAt: Date.now(),
        };
        this.tabs.set(tab.id, tab);
        this.activeTabId = tab.id;
        await this.navigate(url);
        return tab;
    }
    async switchTab(tabId) {
        if (this.tabs.has(tabId)) {
            this.activeTabId = tabId;
            return true;
        }
        return false;
    }
    async closeTab(tabId) {
        this.tabs.delete(tabId);
        if (this.activeTabId === tabId) {
            const remaining = Array.from(this.tabs.keys());
            if (remaining.length > 0) {
                this.activeTabId = remaining[0];
            }
            else {
                await this.openTab();
            }
        }
    }
    async navigate(url, options) {
        const tab = this.tabs.get(this.activeTabId);
        if (tab) {
            tab.isLoading = true;
        }
        const result = await this.currentAdapter.navigate(url, options);
        if (tab) {
            tab.url = result.currentUrl || url;
            tab.title = this.extractTitle(tab.url);
            tab.isLoading = false;
        }
        return result;
    }
    async clickElement(selectorOrCoord) {
        return this.currentAdapter.click(selectorOrCoord);
    }
    async fillInput(selector, value, options) {
        return this.currentAdapter.type(selector, value, options);
    }
    async scroll(direction, distancePx) {
        return this.currentAdapter.scroll(direction, distancePx);
    }
    async touchGesture(type, params) {
        return this.currentAdapter.touch(type, params);
    }
    async extractContent() {
        return this.currentAdapter.extractContent();
    }
    async captureScreenshot() {
        return this.currentAdapter.captureScreenshot();
    }
    extractTitle(url) {
        try {
            const host = new URL(url).hostname;
            return host.replace('www.', '').toUpperCase() + ' — Live Workspace';
        }
        catch {
            return 'Web Document';
        }
    }
}
exports.BrowserAutomationEngine = BrowserAutomationEngine;
//# sourceMappingURL=engine.js.map