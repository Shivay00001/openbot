/**
 * Artemis Phone Browser Controller 📱🌐
 * REAL mobile web automation: a Chromium browser context emulating a phone
 * (mobile viewport, touch, device user-agent, deviceScaleFactor) driven
 * through Playwright. Taps, swipes, typing, screenshots, and content
 * extraction all happen against the live rendered page — nothing simulated.
 */

import { v4 as uuid } from 'uuid';
import type { Browser, BrowserContext, Page } from 'playwright';
import type {
  UniversalBrowserAdapter,
  BrowserEngineType,
  BrowserActionResult,
  BrowserActionOptions,
  ExtractedPageContent,
  BrowserElement,
  BrowserDevicePreset,
  BrowserTab,
  BrowserViewportState,
} from './types.js';
import { BROWSER_DEVICE_PRESETS } from './types.js';
import { loadPlaywright, findChromiumExecutable } from './playwright-runtime.js';
import { zeroCloudGuard } from '../security/zero-cloud.js';

export interface ArtemisMobileTouchGesture {
  type: 'tap' | 'double_tap' | 'long_press' | 'swipe' | 'pinch_zoom' | 'drag';
  x: number;
  y: number;
  toX?: number;
  toY?: number;
  durationMs?: number;
  scale?: number;
}

export interface ArtemisPhoneBrowserOptions {
  devicePreset?: 'iphone_15_pro' | 'pixel_8' | 'ipad_pro';
  orientation?: 'portrait' | 'landscape';
  stealthMode?: boolean;
  geolocation?: { latitude: number; longitude: number };
}

export class ArtemisPhoneBrowserController implements UniversalBrowserAdapter {
  readonly engineType: BrowserEngineType = 'artemis_mobile';
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();
  private tabs: Map<string, BrowserTab> = new Map();
  private activeTabId: string;
  private currentDevice: BrowserDevicePreset;
  private orientation: 'portrait' | 'landscape' = 'portrait';
  private readonly options?: ArtemisPhoneBrowserOptions;

  constructor(options?: ArtemisPhoneBrowserOptions) {
    this.options = options;
    const presetKey = options?.devicePreset || 'iphone_15_pro';
    this.currentDevice = BROWSER_DEVICE_PRESETS[presetKey] || BROWSER_DEVICE_PRESETS.iphone_15_pro;
    this.orientation = options?.orientation || 'portrait';

    const defaultTab: BrowserTab = {
      id: uuid(),
      url: 'about:blank',
      title: 'New Tab',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      createdAt: Date.now(),
    };
    this.tabs.set(defaultTab.id, defaultTab);
    this.activeTabId = defaultTab.id;
  }

  async initialize(options?: { headless?: boolean; devicePreset?: string; proxyUrl?: string }): Promise<void> {
    if (options?.devicePreset && BROWSER_DEVICE_PRESETS[options.devicePreset]) {
      this.currentDevice = BROWSER_DEVICE_PRESETS[options.devicePreset];
    }
    await this.ensureContext();
  }

  private viewport() {
    return this.orientation === 'portrait'
      ? this.currentDevice.viewport
      : {
          width: this.currentDevice.viewport.height,
          height: this.currentDevice.viewport.width,
          deviceScaleFactor: this.currentDevice.viewport.deviceScaleFactor,
        };
  }

  private async ensureContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    const pw = await loadPlaywright();
    if (!this.browser) {
      const executablePath = findChromiumExecutable();
      this.browser = await pw.chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
    }
    const vp = this.viewport();
    this.context = await this.browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      userAgent: this.currentDevice.userAgent,
      isMobile: true,
      hasTouch: true,
      ...(this.options?.geolocation
        ? { geolocation: this.options.geolocation, permissions: ['geolocation'] }
        : {}),
    });
    return this.context;
  }

  private async activePage(): Promise<Page> {
    const context = await this.ensureContext();
    let page = this.pages.get(this.activeTabId);
    if (!page || page.isClosed()) {
      page = await context.newPage();
      this.pages.set(this.activeTabId, page);
    }
    return page;
  }

  private async syncTab(page: Page): Promise<BrowserTab> {
    const tab = this.tabs.get(this.activeTabId)!;
    tab.url = page.url();
    tab.title = await page.title().catch(() => tab.title);
    return tab;
  }

  async getViewportState(): Promise<BrowserViewportState> {
    const page = await this.activePage();
    const tab = await this.syncTab(page);
    const vp = this.viewport();
    return {
      activeTabId: this.activeTabId,
      tabs: Array.from(this.tabs.values()),
      currentUrl: tab.url,
      pageTitle: tab.title,
      viewportDimensions: { width: vp.width, height: vp.height },
      screenshotBase64: await this.captureScreenshot().catch(() => undefined),
      interactiveElements: await this.getInteractiveElements().catch(() => []),
      engine: 'artemis_mobile',
      isHeadless: true,
      devicePreset: this.currentDevice.name,
    };
  }

  async navigate(url: string, options?: BrowserActionOptions): Promise<BrowserActionResult> {
    const start = Date.now();
    const resolvedUrl = url.startsWith('http') ? url : `https://${url}`;
    try {
      zeroCloudGuard.assertAllowed(resolvedUrl);
      const page = await this.activePage();
      const tab = this.tabs.get(this.activeTabId)!;
      tab.isLoading = true;
      await page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: options?.timeoutMs || 30000 });
      tab.isLoading = false;
      const synced = await this.syncTab(page);
      return {
        success: true,
        message: `[Artemis Phone Browser] Navigated to ${synced.url} on ${this.currentDevice.name} — "${synced.title}"`,
        currentUrl: synced.url,
        pageTitle: synced.title,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      const tab = this.tabs.get(this.activeTabId);
      if (tab) tab.isLoading = false;
      return {
        success: false,
        message: `[Artemis Phone Browser] Navigation failed for ${resolvedUrl}: ${err.message}`,
        currentUrl: tab?.url,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async click(selectorOrCoord: string | { x: number; y: number }): Promise<BrowserActionResult> {
    if (typeof selectorOrCoord !== 'string') {
      return this.dispatchTouchGesture({ type: 'tap', x: selectorOrCoord.x, y: selectorOrCoord.y });
    }
    const start = Date.now();
    try {
      const page = await this.activePage();
      await page.locator(selectorOrCoord).first().tap({ timeout: 10000 });
      return {
        success: true,
        message: `[Artemis] Tapped touch selector "${selectorOrCoord}"`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Artemis] Tap failed: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async type(selector: string, text: string, options?: { clearFirst?: boolean; submit?: boolean }): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const page = await this.activePage();
      const locator = page.locator(selector).first();
      await locator.tap({ timeout: 10000 });
      await locator.fill(text, { timeout: 10000 });
      if (options?.submit) await locator.press('Enter');
      return {
        success: true,
        message: `[Artemis Mobile] Typed "${text}" into "${selector}"${options?.submit ? ' and submitted via Enter' : ''}`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Artemis Mobile] Type failed: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', distancePx = 400): Promise<BrowserActionResult> {
    const vp = this.viewport();
    return this.dispatchTouchGesture({
      type: 'swipe',
      x: Math.round(vp.width / 2),
      y: direction === 'down' || direction === 'bottom' ? Math.round(vp.height * 0.7) : Math.round(vp.height * 0.3),
      toX: Math.round(vp.width / 2),
      toY: direction === 'down' || direction === 'bottom' ? Math.round(vp.height * 0.7) - distancePx : Math.round(vp.height * 0.3) + distancePx,
      durationMs: 250,
    });
  }

  async touch(type: 'tap' | 'double_tap' | 'swipe' | 'pinch', params: Record<string, unknown>): Promise<BrowserActionResult> {
    return this.dispatchTouchGesture({
      type: type === 'pinch' ? 'pinch_zoom' : type,
      x: (params.x as number) || 200,
      y: (params.y as number) || 400,
      toX: params.toX as number,
      toY: params.toY as number,
      scale: params.scale as number,
      durationMs: (params.durationMs as number) || 250,
    });
  }

  async dispatchTouchGesture(gesture: ArtemisMobileTouchGesture): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const page = await this.activePage();
      if (gesture.type === 'tap') {
        await page.touchscreen.tap(gesture.x, gesture.y);
      } else if (gesture.type === 'double_tap') {
        await page.touchscreen.tap(gesture.x, gesture.y);
        await page.touchscreen.tap(gesture.x, gesture.y);
      } else if (gesture.type === 'long_press') {
        await page.mouse.move(gesture.x, gesture.y);
        await page.mouse.down();
        await page.waitForTimeout(gesture.durationMs || 600);
        await page.mouse.up();
      } else if (gesture.type === 'swipe' || gesture.type === 'drag') {
        await page.mouse.move(gesture.x, gesture.y);
        await page.mouse.down();
        await page.mouse.move(gesture.toX ?? gesture.x, gesture.toY ?? gesture.y, { steps: 12 });
        await page.mouse.up();
      } else if (gesture.type === 'pinch_zoom') {
        return {
          success: false,
          message: '[Artemis Touch Event] Pinch zoom requires two simultaneous touch points and is not supported by the Chromium emulation backend.',
          error: 'pinch_not_supported',
          durationMs: Date.now() - start,
        };
      }
      return {
        success: true,
        message: `[Artemis Touch Event] Dispatched gesture ${gesture.type} at (${gesture.x}, ${gesture.y})`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Artemis Touch Event] Gesture failed: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async openNewTab(url = 'about:blank'): Promise<BrowserTab> {
    const tab: BrowserTab = {
      id: uuid(),
      url: 'about:blank',
      title: 'New Tab',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      createdAt: Date.now(),
    };
    this.tabs.set(tab.id, tab);
    this.activeTabId = tab.id;
    if (url !== 'about:blank') {
      await this.navigate(url);
      return this.tabs.get(tab.id)!;
    }
    return tab;
  }

  async switchTab(tabId: string): Promise<boolean> {
    if (!this.tabs.has(tabId)) return false;
    this.activeTabId = tabId;
    const page = await this.activePage();
    await page.bringToFront();
    return true;
  }

  async closeTab(tabId: string): Promise<void> {
    const page = this.pages.get(tabId);
    if (page) await page.close().catch(() => undefined);
    this.pages.delete(tabId);
    this.tabs.delete(tabId);
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.keys());
      if (remaining.length > 0) {
        this.activeTabId = remaining[0];
      } else {
        await this.openNewTab();
      }
    }
  }

  rotateDevice(orientation?: 'portrait' | 'landscape'): 'portrait' | 'landscape' {
    this.orientation = orientation || (this.orientation === 'portrait' ? 'landscape' : 'portrait');
    // Viewport change requires a fresh context; pages are recreated lazily.
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.pages.clear();
    return this.orientation;
  }

  async captureScreenshot(): Promise<string> {
    const page = await this.activePage();
    const buffer = await page.screenshot({ type: 'png' });
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  async extractContent(): Promise<ExtractedPageContent> {
    const page = await this.activePage();
    const data = await page.evaluate(() => ({
      title: document.title,
      text: (document.body?.innerText || '').slice(0, 10000),
      links: Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 50)
        .map((a) => ({ text: (a.textContent || '').trim(), href: (a as HTMLAnchorElement).href })),
    }));
    return {
      title: data.title,
      url: page.url(),
      markdown: `# ${data.title}\n\n**Source URL**: ${page.url()}\n**Device**: ${this.currentDevice.name}\n\n${data.text.substring(0, 8000)}`,
      text: data.text,
      links: data.links,
      tables: [],
      metadata: {
        engine: 'artemis_mobile',
        device: this.currentDevice.name,
        userAgent: this.currentDevice.userAgent,
      },
    };
  }

  async getInteractiveElements(): Promise<BrowserElement[]> {
    const page = await this.activePage();
    const elements = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')
      ).slice(0, 60);
      return nodes.map((el, i) => {
        const rect = el.getBoundingClientRect();
        const attrs: Record<string, string> = {};
        for (const attr of Array.from(el.attributes)) attrs[attr.name] = attr.value;
        return {
          id: `mobile_el_${i}`,
          selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
          tagName: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 80),
          attributes: attrs,
          isInteractive: true,
          isVisible: rect.width > 0 && rect.height > 0,
          bounds: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          accessibilityLabel: el.getAttribute('aria-label') || el.getAttribute('placeholder') || undefined,
        };
      });
    });
    return elements as BrowserElement[];
  }

  async close(): Promise<void> {
    try {
      await this.context?.close();
    } catch { /* already closed */ }
    try {
      await this.browser?.close();
    } catch { /* already closed */ }
    this.context = null;
    this.browser = null;
    this.pages.clear();
    this.tabs.clear();
  }
}
