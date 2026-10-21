/**
 * Puppeteer & CDP Automation Adapter 🎪
 * REAL Chrome automation via `puppeteer-core` connected to a local Chromium
 * executable (Playwright cache or system Chrome). If puppeteer-core is not
 * installed or no Chromium is found, initialize() throws a clear error —
 * actions never pretend to succeed.
 */

import type {
  UniversalBrowserAdapter,
  BrowserEngineType,
  BrowserActionResult,
  BrowserActionOptions,
  ExtractedPageContent,
  BrowserElement,
  BrowserDevicePreset,
} from '../types.js';
import { BROWSER_DEVICE_PRESETS } from '../types.js';
import { findChromiumExecutable } from '../playwright-runtime.js';
import { zeroCloudGuard } from '../../security/zero-cloud.js';

// Minimal structural typing for the puppeteer-core surface we use,
// so the package stays an optional runtime dependency.
interface PuppeteerPage {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  url(): string;
  title(): Promise<string>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  focus(selector: string): Promise<void>;
  keyboard: { press(key: string): Promise<void> };
  mouse: { click(x: number, y: number): Promise<void>; wheel(delta: { deltaY?: number }): Promise<void> };
  screenshot(options?: Record<string, unknown>): Promise<string>;
  evaluate<T>(fn: (...args: any[]) => T, ...args: any[]): Promise<T>;
  setViewport(viewport: Record<string, unknown>): Promise<void>;
  setUserAgent(ua: string): Promise<void>;
}
interface PuppeteerBrowser {
  newPage(): Promise<PuppeteerPage>;
  close(): Promise<void>;
}

export class PuppeteerAdapter implements UniversalBrowserAdapter {
  readonly engineType: BrowserEngineType = 'puppeteer';
  private browser: PuppeteerBrowser | null = null;
  private page: PuppeteerPage | null = null;
  private isHeadless = true;
  private devicePreset: BrowserDevicePreset = BROWSER_DEVICE_PRESETS.desktop_hd;

  async initialize(options?: { headless?: boolean; devicePreset?: string; proxyUrl?: string }): Promise<void> {
    this.isHeadless = options?.headless ?? true;
    if (options?.devicePreset && BROWSER_DEVICE_PRESETS[options.devicePreset]) {
      this.devicePreset = BROWSER_DEVICE_PRESETS[options.devicePreset];
    }
    await this.ensurePage();
  }

  private async ensurePage(): Promise<PuppeteerPage> {
    if (this.page) return this.page;

    let puppeteer: { launch(options: Record<string, unknown>): Promise<PuppeteerBrowser> };
    try {
      puppeteer = (await import('puppeteer-core')) as unknown as typeof puppeteer;
    } catch {
      throw new Error(
        'The "puppeteer-core" package is not installed. Run `npm install puppeteer-core` in @openbot/core to enable the Puppeteer engine.'
      );
    }

    const executablePath = findChromiumExecutable();
    if (!executablePath) {
      throw new Error(
        'No Chromium executable found for Puppeteer. Install Chrome/Chromium or set PLAYWRIGHT_CHROMIUM_EXECUTABLE / CHROME_PATH.'
      );
    }

    this.browser = await puppeteer.launch({
      executablePath,
      headless: this.isHeadless,
      // Explicit launch bound (matches the puppeteer default, stated so a
      // wedged Chrome startup fails instead of hanging the caller).
      timeout: 30000,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({
      width: this.devicePreset.viewport.width,
      height: this.devicePreset.viewport.height,
      deviceScaleFactor: this.devicePreset.viewport.deviceScaleFactor,
      isMobile: this.devicePreset.isMobile,
      hasTouch: this.devicePreset.hasTouch,
    });
    await this.page.setUserAgent(this.devicePreset.userAgent);
    return this.page;
  }

  async navigate(url: string, options?: BrowserActionOptions): Promise<BrowserActionResult> {
    const start = Date.now();
    const target = url.startsWith('http') ? url : `https://${url}`;
    try {
      zeroCloudGuard.assertAllowed(target);
      const page = await this.ensurePage();
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: options?.timeoutMs || 30000 });
      const title = await page.title();
      return {
        success: true,
        message: `[Puppeteer CDP] Navigated to ${page.url()} — "${title}"`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Puppeteer CDP] Navigation failed: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async click(selectorOrCoord: string | { x: number; y: number }): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const page = await this.ensurePage();
      if (typeof selectorOrCoord === 'string') {
        await page.click(selectorOrCoord);
      } else {
        await page.mouse.click(selectorOrCoord.x, selectorOrCoord.y);
      }
      return {
        success: true,
        message: `[Puppeteer CDP] Click executed on ${page.url()}`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Puppeteer CDP] Click failed: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async type(selector: string, text: string, options?: { clearFirst?: boolean; submit?: boolean }): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const page = await this.ensurePage();
      await page.focus(selector);
      await page.type(selector, text);
      if (options?.submit) await page.keyboard.press('Enter');
      return {
        success: true,
        message: `[Puppeteer CDP] Typed "${text}" into "${selector}"`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Puppeteer CDP] Type failed: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', distancePx = 500): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const page = await this.ensurePage();
      await page.evaluate(
        (dir: string, dist: number) => {
          if (dir === 'top') window.scrollTo(0, 0);
          else if (dir === 'bottom') window.scrollTo(0, document.body.scrollHeight);
          else window.scrollBy(0, dir === 'down' ? dist : -dist);
        },
        direction,
        distancePx
      );
      return {
        success: true,
        message: `[Puppeteer CDP] Scrolled ${direction}`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Puppeteer CDP] Scroll failed: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async touch(type: 'tap' | 'double_tap' | 'swipe' | 'pinch', params: Record<string, unknown>): Promise<BrowserActionResult> {
    return this.click({ x: Number(params.x) || 0, y: Number(params.y) || 0 });
  }

  async captureScreenshot(): Promise<string> {
    const page = await this.ensurePage();
    const base64 = await page.screenshot({ encoding: 'base64', type: 'png' });
    return `data:image/png;base64,${base64}`;
  }

  async extractContent(): Promise<ExtractedPageContent> {
    const page = await this.ensurePage();
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
      markdown: `# ${data.title}\n\n${data.text.substring(0, 8000)}`,
      text: data.text,
      links: data.links,
      tables: [],
      metadata: { engine: 'puppeteer', device: this.devicePreset.name, userAgent: this.devicePreset.userAgent },
    };
  }

  async getInteractiveElements(): Promise<BrowserElement[]> {
    const page = await this.ensurePage();
    return page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href], button, input, select, textarea'))
        .slice(0, 60)
        .map((el, i) => {
          const r = el.getBoundingClientRect();
          const attrs: Record<string, string> = {};
          for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
          return {
            id: `el_${i}`,
            selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
            tagName: el.tagName.toLowerCase(),
            text: (el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 80),
            attributes: attrs,
            isInteractive: true,
            isVisible: r.width > 0 && r.height > 0,
            bounds: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
          };
        })
    ) as Promise<BrowserElement[]>;
  }

  async close(): Promise<void> {
    try {
      await this.browser?.close();
    } catch { /* already closed */ }
    this.browser = null;
    this.page = null;
  }
}
