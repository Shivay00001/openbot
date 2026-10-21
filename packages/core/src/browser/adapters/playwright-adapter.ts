/**
 * Playwright Automation Adapter 🎭
 * REAL browser automation backed by the `playwright` package and a local
 * Chromium build: live navigation, DOM interaction, screenshots, and content
 * extraction from the rendered page. Nothing is simulated — if the browser
 * cannot start or the page cannot load, the result says so.
 */

import type { Browser, BrowserContext, Page } from 'playwright';
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
import { loadPlaywright, findChromiumExecutable } from '../playwright-runtime.js';
import { zeroCloudGuard } from '../../security/zero-cloud.js';

export interface PlaywrightAdapterOptions {
  executablePath?: string;
  launchArgs?: string[];
}

export class PlaywrightAdapter implements UniversalBrowserAdapter {
  readonly engineType: BrowserEngineType = 'playwright';
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isHeadless = true;
  private devicePreset: BrowserDevicePreset = BROWSER_DEVICE_PRESETS.desktop_hd;
  private proxyUrl?: string;
  private readonly adapterOptions: PlaywrightAdapterOptions;

  constructor(options: PlaywrightAdapterOptions = {}) {
    this.adapterOptions = options;
  }

  async initialize(options?: { headless?: boolean; devicePreset?: string; proxyUrl?: string }): Promise<void> {
    this.isHeadless = options?.headless ?? true;
    this.proxyUrl = options?.proxyUrl;
    if (options?.devicePreset && BROWSER_DEVICE_PRESETS[options.devicePreset]) {
      this.devicePreset = BROWSER_DEVICE_PRESETS[options.devicePreset];
    }
    await this.ensurePage();
  }

  /** Lazily launch browser + context + page (shared by all actions). */
  async ensurePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) return this.page;

    const pw = await loadPlaywright();
    if (!this.browser) {
      const executablePath = this.adapterOptions.executablePath || findChromiumExecutable();
      this.browser = await pw.chromium.launch({
        headless: this.isHeadless,
        ...(executablePath ? { executablePath } : {}),
        args: ['--no-sandbox', '--disable-dev-shm-usage', ...(this.adapterOptions.launchArgs || [])],
      });
    }
    if (!this.context) {
      this.context = await this.browser.newContext({
        viewport: this.devicePreset.viewport,
        userAgent: this.devicePreset.userAgent,
        deviceScaleFactor: this.devicePreset.viewport.deviceScaleFactor,
        isMobile: this.devicePreset.isMobile,
        hasTouch: this.devicePreset.hasTouch,
        ...(this.proxyUrl ? { proxy: { server: this.proxyUrl } } : {}),
      });
    }
    this.page = await this.context.newPage();
    return this.page;
  }

  /** Access the underlying Playwright page (used by composite adapters). */
  async getPage(): Promise<Page> {
    return this.ensurePage();
  }

  getCurrentUrl(): string {
    return this.page?.url() || 'about:blank';
  }

  async navigate(url: string, options?: BrowserActionOptions): Promise<BrowserActionResult> {
    const start = Date.now();
    const target = url.startsWith('http') || url.startsWith('data:') ? url : `https://${url}`;
    try {
      zeroCloudGuard.assertAllowed(target);
      const page = await this.ensurePage();
      const response = await page.goto(target, {
        waitUntil: 'domcontentloaded',
        timeout: options?.timeoutMs || 30000,
      });
      if (options?.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, { timeout: options.timeoutMs || 10000 });
      }
      const title = await page.title();
      return {
        success: true,
        message: `[Playwright] Navigated to ${page.url()} — Loaded "${title}" (${this.devicePreset.name})` +
          (response ? ` [HTTP ${response.status()}]` : ''),
        currentUrl: page.url(),
        pageTitle: title,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Playwright] Navigation failed for ${target}: ${err.message}`,
        currentUrl: this.getCurrentUrl(),
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
        await this.clickBySelector(page, selectorOrCoord);
      } else {
        await page.mouse.click(selectorOrCoord.x, selectorOrCoord.y);
      }
      return {
        success: true,
        message: `[Playwright] Clicked ${typeof selectorOrCoord === 'string' ? `selector "${selectorOrCoord}"` : `coordinate (${selectorOrCoord.x}, ${selectorOrCoord.y})`} on ${page.url()}`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Playwright] Click failed: ${err.message}`,
        currentUrl: this.getCurrentUrl(),
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  private async clickBySelector(page: Page, selector: string): Promise<void> {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.click({ timeout: 10000 });
      return;
    }
    // Fall back to visible-text matching for human-style targets ("Search", "Login")
    await page.getByText(selector, { exact: false }).first().click({ timeout: 10000 });
  }

  async type(selector: string, text: string, options?: { clearFirst?: boolean; submit?: boolean }): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const page = await this.ensurePage();
      const locator = page.locator(selector).first();
      if (options?.clearFirst === false) {
        await locator.pressSequentially(text, { timeout: 10000 });
      } else {
        await locator.fill(text, { timeout: 10000 });
      }
      if (options?.submit) {
        await locator.press('Enter');
      }
      return {
        success: true,
        message: `[Playwright] Typed "${text}" into "${selector}"${options?.submit ? ' and pressed Enter' : ''}`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Playwright] Type failed: ${err.message}`,
        currentUrl: this.getCurrentUrl(),
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', distancePx = 500): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const page = await this.ensurePage();
      if (direction === 'top') {
        await page.evaluate(() => window.scrollTo(0, 0));
      } else if (direction === 'bottom') {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      } else {
        await page.mouse.wheel(0, direction === 'down' ? distancePx : -distancePx);
      }
      return {
        success: true,
        message: `[Playwright] Scrolled ${direction} (${distancePx}px)`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Playwright] Scroll failed: ${err.message}`,
        currentUrl: this.getCurrentUrl(),
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async touch(type: 'tap' | 'double_tap' | 'swipe' | 'pinch', params: Record<string, unknown>): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const page = await this.ensurePage();
      const x = Number(params.x) || 0;
      const y = Number(params.y) || 0;
      if (type === 'tap') {
        await page.touchscreen.tap(x, y);
      } else if (type === 'double_tap') {
        await page.touchscreen.tap(x, y);
        await page.touchscreen.tap(x, y);
      } else if (type === 'swipe') {
        const toX = Number(params.toX) || x;
        const toY = Number(params.toY) || y;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(toX, toY, { steps: 10 });
        await page.mouse.up();
      } else {
        return {
          success: false,
          message: `[Playwright] Pinch gestures require two touch points and are not supported by this adapter.`,
          currentUrl: page.url(),
          error: 'pinch_not_supported',
          durationMs: Date.now() - start,
        };
      }
      return {
        success: true,
        message: `[Playwright] Touch ${type} executed at (${x}, ${y})`,
        currentUrl: page.url(),
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[Playwright] Touch failed: ${err.message}`,
        currentUrl: this.getCurrentUrl(),
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async captureScreenshot(): Promise<string> {
    const page = await this.ensurePage();
    const buffer = await page.screenshot({ type: 'png' });
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }

  async extractContent(): Promise<ExtractedPageContent> {
    const page = await this.ensurePage();
    const data = await page.evaluate(() => {
      const text = (document.body?.innerText || '').replace(/\s+\n/g, '\n').trim();
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => ({ text: (a.textContent || '').trim(), href: (a as HTMLAnchorElement).href }))
        .filter((l) => l.href.startsWith('http'))
        .slice(0, 50);
      const tables = Array.from(document.querySelectorAll('table')).slice(0, 5).map((table) => {
        const rows = Array.from(table.querySelectorAll('tr'));
        const headers = rows.length
          ? Array.from(rows[0].querySelectorAll('th,td')).map((c) => (c.textContent || '').trim())
          : [];
        return {
          headers,
          rows: rows.slice(1).map((r) => Array.from(r.querySelectorAll('td,th')).map((c) => (c.textContent || '').trim())),
        };
      });
      return { title: document.title, text, links, tables };
    });

    return {
      title: data.title,
      url: page.url(),
      markdown: `# ${data.title}\n\n**Source URL**: ${page.url()}\n**Device Viewport**: ${this.devicePreset.name} (${this.devicePreset.viewport.width}x${this.devicePreset.viewport.height})\n\n${data.text.substring(0, 8000)}`,
      text: data.text.substring(0, 10000),
      links: data.links,
      tables: data.tables,
      metadata: {
        engine: 'playwright',
        device: this.devicePreset.name,
        userAgent: this.devicePreset.userAgent,
      },
    };
  }

  async getInteractiveElements(): Promise<BrowserElement[]> {
    const page = await this.ensurePage();
    const elements = await page.evaluate(() => {
      const selectorFor = (el: Element): string => {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const name = el.getAttribute('name');
        if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
        const parts: string[] = [];
        let node: Element | null = el;
        while (node && node !== document.body) {
          let part = node.tagName.toLowerCase();
          const parent: Element | null = node.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
            if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
          }
          parts.unshift(part);
          node = parent;
        }
        return parts.join(' > ');
      };

      const nodes = Array.from(
        document.querySelectorAll('a[href], button, input, select, textarea, [role="button"], [tabindex]')
      ).slice(0, 60);

      return nodes.map((el, i) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const attrs: Record<string, string> = {};
        for (const attr of Array.from(el.attributes)) attrs[attr.name] = attr.value;
        return {
          id: `el_${i}`,
          selector: selectorFor(el),
          tagName: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('placeholder') || el.getAttribute('value') || '').trim().slice(0, 80),
          attributes: attrs,
          isInteractive: true,
          isVisible: style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0,
          bounds: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          accessibilityLabel: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || undefined,
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
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}
