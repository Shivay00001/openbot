/**
 * W3C WebDriver Protocol Client 🌐
 * Minimal, real implementation of the W3C WebDriver REST protocol used by
 * Selenium Grid, chromedriver, and geckodriver. Every method performs an
 * actual HTTP call to the configured endpoint; if no server is listening,
 * calls fail with the real connection error — nothing is simulated.
 * Every request is bounded by an explicit timeout (default 10s) and routed
 * through the shared proxy-aware transport, so a dead route fails fast.
 */

import { proxiedFetch } from '../net/http.js';

export class WebDriverError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'WebDriverError';
    this.status = status;
  }
}

/**
 * Default per-request timeout for WebDriver/Appium protocol calls.
 * Deliberately short: against a live server every protocol call answers in
 * well under a second, so a longer wait only ever means "no server there" —
 * and in sandboxed/proxied environments a dead route can blackhole a
 * connection instead of refusing it. 10s makes an absent server surface as
 * an honest failure fast, never as a hang. Override per client via the
 * constructor or globally with OPENBOT_WEBDRIVER_TIMEOUT_MS.
 */
export const DEFAULT_WEBDRIVER_REQUEST_TIMEOUT_MS = 10_000;

export function resolveWebDriverTimeoutMs(explicit?: number): number {
  if (explicit !== undefined && explicit > 0) return explicit;
  const fromEnv = Number(process.env.OPENBOT_WEBDRIVER_TIMEOUT_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return DEFAULT_WEBDRIVER_REQUEST_TIMEOUT_MS;
}

export class WebDriverClient {
  private readonly baseUrl: string;
  readonly requestTimeoutMs: number;

  constructor(baseUrl: string, requestTimeoutMs?: number) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.requestTimeoutMs = resolveWebDriverTimeoutMs(requestTimeoutMs);
  }

  get endpoint(): string {
    return this.baseUrl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await proxiedFetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
    } catch (err: any) {
      throw new WebDriverError(
        `WebDriver server unreachable at ${this.baseUrl}: ${err.message}. ` +
          `Start a Selenium Grid / chromedriver server or choose another engine.`
      );
    }

    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        payload?.value?.message || payload?.message || `HTTP ${response.status} from WebDriver server`;
      throw new WebDriverError(message, response.status);
    }
    return (payload?.value ?? payload) as T;
  }

  async newSession(capabilities: Record<string, unknown> = {}): Promise<string> {
    const result = await this.request<{ sessionId: string }>('POST', '/session', {
      capabilities: { alwaysMatch: capabilities, firstMatch: [{}] },
    });
    if (!result.sessionId) throw new WebDriverError('WebDriver server did not return a sessionId');
    return result.sessionId;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.request('DELETE', `/session/${sessionId}`);
  }

  async navigate(sessionId: string, url: string): Promise<void> {
    await this.request('POST', `/session/${sessionId}/url`, { url });
  }

  async getCurrentUrl(sessionId: string): Promise<string> {
    return this.request<string>('GET', `/session/${sessionId}/url`);
  }

  async getTitle(sessionId: string): Promise<string> {
    return this.request<string>('GET', `/session/${sessionId}/title`);
  }

  async findElement(sessionId: string, cssSelector: string): Promise<string> {
    const result = await this.request<Record<string, string>>('POST', `/session/${sessionId}/element`, {
      using: 'css selector',
      value: cssSelector,
    });
    const elementId = result['element-6066-11e4-a52e-4f735466cecf'] || Object.values(result)[0];
    if (!elementId) throw new WebDriverError(`Element not found: ${cssSelector}`);
    return elementId;
  }

  async clickElement(sessionId: string, elementId: string): Promise<void> {
    await this.request('POST', `/session/${sessionId}/element/${elementId}/click`, {});
  }

  async sendKeys(sessionId: string, elementId: string, text: string): Promise<void> {
    await this.request('POST', `/session/${sessionId}/element/${elementId}/value`, { text });
  }

  async executeScript<T>(sessionId: string, script: string, args: unknown[] = []): Promise<T> {
    return this.request<T>('POST', `/session/${sessionId}/execute/sync`, { script, args });
  }

  async screenshot(sessionId: string): Promise<string> {
    return this.request<string>('GET', `/session/${sessionId}/screenshot`);
  }
}
