/**
 * WebDriver-backed Browser Adapter Base 🌐
 * Shared real implementation for engines that speak the W3C WebDriver
 * protocol (Selenium, WebdriverIO/chromedriver). Sessions are created lazily
 * against the configured endpoint; failures surface the real error.
 */

import type {
  UniversalBrowserAdapter,
  BrowserEngineType,
  BrowserActionResult,
  BrowserActionOptions,
  ExtractedPageContent,
  BrowserElement,
} from '../types.js';
import { WebDriverClient } from '../webdriver-client.js';
import { zeroCloudGuard } from '../../security/zero-cloud.js';

export abstract class WebDriverAdapterBase implements UniversalBrowserAdapter {
  abstract readonly engineType: BrowserEngineType;
  protected abstract readonly label: string;
  protected readonly client: WebDriverClient;
  protected sessionId: string | null = null;
  protected currentUrl = 'about:blank';

  protected constructor(defaultEndpoint: string, endpointOverride?: string) {
    this.client = new WebDriverClient(
      endpointOverride || process.env.OPENBOT_WEBDRIVER_URL || defaultEndpoint
    );
  }

  async initialize(): Promise<void> {
    // Session is created lazily on first action so engine switching stays cheap.
  }

  protected async ensureSession(): Promise<string> {
    if (this.sessionId) return this.sessionId;
    this.sessionId = await this.client.newSession({
      browserName: 'chrome',
      'goog:chromeOptions': { args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'] },
    });
    return this.sessionId;
  }

  async navigate(url: string, options?: BrowserActionOptions): Promise<BrowserActionResult> {
    const start = Date.now();
    const target = url.startsWith('http') ? url : `https://${url}`;
    try {
      zeroCloudGuard.assertAllowed(target);
      const session = await this.ensureSession();
      await this.client.navigate(session, target);
      this.currentUrl = await this.client.getCurrentUrl(session).catch(() => target);
      const title = await this.client.getTitle(session).catch(() => '');
      return {
        success: true,
        message: `[${this.label}] Navigated to ${this.currentUrl}${title ? ` — "${title}"` : ''}`,
        currentUrl: this.currentUrl,
        pageTitle: title || undefined,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[${this.label}] Navigation failed: ${err.message}`,
        currentUrl: this.currentUrl,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async click(selectorOrCoord: string | { x: number; y: number }): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const session = await this.ensureSession();
      if (typeof selectorOrCoord === 'string') {
        const elementId = await this.client.findElement(session, selectorOrCoord);
        await this.client.clickElement(session, elementId);
      } else {
        await this.client.executeScript(
          session,
          `window.scrollTo(0,0); const el = document.elementFromPoint(${Math.round(selectorOrCoord.x)}, ${Math.round(selectorOrCoord.y)}); if (el) { el.click(); return true; } return false;`
        );
      }
      return {
        success: true,
        message: `[${this.label}] Click executed`,
        currentUrl: this.currentUrl,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[${this.label}] Click failed: ${err.message}`,
        currentUrl: this.currentUrl,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async type(selector: string, text: string, options?: { clearFirst?: boolean; submit?: boolean }): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const session = await this.ensureSession();
      const elementId = await this.client.findElement(session, selector);
      await this.client.sendKeys(session, elementId, options?.submit ? `${text}\n` : text);
      return {
        success: true,
        message: `[${this.label}] Typed "${text}" into "${selector}"`,
        currentUrl: this.currentUrl,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[${this.label}] Type failed: ${err.message}`,
        currentUrl: this.currentUrl,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', distancePx = 500): Promise<BrowserActionResult> {
    const start = Date.now();
    try {
      const session = await this.ensureSession();
      const script =
        direction === 'top'
          ? 'window.scrollTo(0,0)'
          : direction === 'bottom'
            ? 'window.scrollTo(0, document.body.scrollHeight)'
            : `window.scrollBy(0, ${direction === 'down' ? distancePx : -distancePx})`;
      await this.client.executeScript(session, script);
      return {
        success: true,
        message: `[${this.label}] Scrolled ${direction}`,
        currentUrl: this.currentUrl,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `[${this.label}] Scroll failed: ${err.message}`,
        currentUrl: this.currentUrl,
        error: err.message,
        durationMs: Date.now() - start,
      };
    }
  }

  async touch(type: 'tap' | 'double_tap' | 'swipe' | 'pinch', params: Record<string, unknown>): Promise<BrowserActionResult> {
    return this.click({ x: Number(params.x) || 0, y: Number(params.y) || 0 });
  }

  async captureScreenshot(): Promise<string> {
    const session = await this.ensureSession();
    const base64 = await this.client.screenshot(session);
    return `data:image/png;base64,${base64}`;
  }

  async extractContent(): Promise<ExtractedPageContent> {
    const session = await this.ensureSession();
    const data = await this.client.executeScript<{
      title: string;
      text: string;
      links: Array<{ text: string; href: string }>;
    }>(
      session,
      `return { title: document.title, text: (document.body ? document.body.innerText : '').slice(0, 10000),
        links: Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({ text: (a.textContent||'').trim(), href: a.href })) };`
    );
    return {
      title: data.title,
      url: this.currentUrl,
      markdown: `# ${data.title}\n\n${data.text.substring(0, 8000)}`,
      text: data.text,
      links: data.links,
      tables: [],
      metadata: { engine: this.engineType, webdriverEndpoint: this.client.endpoint },
    };
  }

  async getInteractiveElements(): Promise<BrowserElement[]> {
    const session = await this.ensureSession();
    const elements = await this.client.executeScript<BrowserElement[]>(
      session,
      `return Array.from(document.querySelectorAll('a[href], button, input, select, textarea')).slice(0, 60).map((el, i) => {
        const r = el.getBoundingClientRect();
        const attrs = {}; for (const a of el.attributes) attrs[a.name] = a.value;
        return { id: 'el_' + i, selector: el.id ? '#' + el.id : el.tagName.toLowerCase(), tagName: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 80), attributes: attrs,
          isInteractive: true, isVisible: r.width > 0 && r.height > 0,
          bounds: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } };
      });`
    );
    return elements;
  }

  async close(): Promise<void> {
    if (this.sessionId) {
      await this.client.deleteSession(this.sessionId).catch(() => undefined);
      this.sessionId = null;
    }
  }
}
