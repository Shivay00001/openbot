/**
 * Unified Browser Automation Engine 🌐
 * Orchestrates Playwright, Puppeteer, Selenium, WebdriverIO, Browser-Use, and Artemis Phone Browser.
 */

import { v4 as uuid } from 'uuid';
import type {
  UniversalBrowserAdapter,
  BrowserEngineType,
  BrowserTab,
  BrowserViewportState,
  BrowserActionResult,
  BrowserActionOptions,
  ExtractedPageContent,
  BrowserElement,
} from './types.js';
import { PlaywrightAdapter } from './adapters/playwright-adapter.js';
import { PuppeteerAdapter } from './adapters/puppeteer-adapter.js';
import { SeleniumAdapter } from './adapters/selenium-adapter.js';
import { WebdriverIOAdapter } from './adapters/webdriverio-adapter.js';
import { BrowserUseAdapter } from './adapters/browser-use-adapter.js';
import { ArtemisPhoneBrowserController } from './artemis-phone-browser.js';

export interface BrowserEngineOptions {
  defaultEngine?: BrowserEngineType;
  headless?: boolean;
  devicePreset?: string;
  proxyUrl?: string;
}

export class BrowserAutomationEngine {
  private activeEngineType: BrowserEngineType;
  private currentAdapter: UniversalBrowserAdapter;
  private adapters: Map<BrowserEngineType, UniversalBrowserAdapter> = new Map();
  private tabs: Map<string, BrowserTab> = new Map();
  private activeTabId: string;
  private options: BrowserEngineOptions;

  constructor(options?: BrowserEngineOptions) {
    this.options = {
      defaultEngine: 'playwright',
      headless: true,
      ...options,
    };
    this.activeEngineType = this.options.defaultEngine!;

    // Register all adapters
    this.adapters.set('playwright', new PlaywrightAdapter());
    this.adapters.set('puppeteer', new PuppeteerAdapter());
    this.adapters.set('selenium', new SeleniumAdapter());
    this.adapters.set('webdriverio', new WebdriverIOAdapter());
    this.adapters.set('browser_use', new BrowserUseAdapter());
    this.adapters.set('artemis_mobile', new ArtemisPhoneBrowserController({
      devicePreset: (this.options.devicePreset as any) || 'iphone_15_pro',
    }));

    this.currentAdapter = this.adapters.get(this.activeEngineType) || this.adapters.get('playwright')!;

    const initialTab: BrowserTab = {
      id: uuid(),
      url: 'about:blank',
      title: 'New Tab',
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
  async switchEngine(engine: BrowserEngineType): Promise<void> {
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

  getActiveEngine(): BrowserEngineType {
    return this.activeEngineType;
  }

  /**
   * Get active Artemis mobile controller instance if using mobile phone browser mode
   */
  getArtemisController(): ArtemisPhoneBrowserController {
    return this.adapters.get('artemis_mobile') as ArtemisPhoneBrowserController;
  }

  async getBrowserState(): Promise<BrowserViewportState> {
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

  async openTab(url = 'https://google.com'): Promise<BrowserTab> {
    const tab: BrowserTab = {
      id: uuid(),
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

  async switchTab(tabId: string): Promise<boolean> {
    if (this.tabs.has(tabId)) {
      this.activeTabId = tabId;
      return true;
    }
    return false;
  }

  async closeTab(tabId: string): Promise<void> {
    this.tabs.delete(tabId);
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.keys());
      if (remaining.length > 0) {
        this.activeTabId = remaining[0];
      } else {
        await this.openTab();
      }
    }
  }

  async navigate(url: string, options?: BrowserActionOptions): Promise<BrowserActionResult> {
    const tab = this.tabs.get(this.activeTabId);
    if (tab) {
      tab.isLoading = true;
    }

    const result = await this.currentAdapter.navigate(url, options);

    if (tab) {
      tab.url = result.currentUrl || url;
      // Use the real title reported by the engine; never invent one.
      if (result.pageTitle) tab.title = result.pageTitle;
      tab.isLoading = false;
    }

    return result;
  }

  async clickElement(selectorOrCoord: string | { x: number; y: number }): Promise<BrowserActionResult> {
    return this.currentAdapter.click(selectorOrCoord);
  }

  async fillInput(selector: string, value: string, options?: { submit?: boolean }): Promise<BrowserActionResult> {
    return this.currentAdapter.type(selector, value, options);
  }

  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', distancePx?: number): Promise<BrowserActionResult> {
    return this.currentAdapter.scroll(direction, distancePx);
  }

  async touchGesture(type: 'tap' | 'double_tap' | 'swipe' | 'pinch', params: Record<string, unknown>): Promise<BrowserActionResult> {
    return this.currentAdapter.touch(type, params);
  }

  async extractContent(): Promise<ExtractedPageContent> {
    return this.currentAdapter.extractContent();
  }

  async captureScreenshot(): Promise<string> {
    return this.currentAdapter.captureScreenshot();
  }

}
