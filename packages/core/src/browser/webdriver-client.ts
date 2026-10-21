/**
 * W3C WebDriver Protocol Client 🌐
 * Minimal, real implementation of the W3C WebDriver REST protocol used by
 * Selenium Grid, chromedriver, and geckodriver. Every method performs an
 * actual HTTP call to the configured endpoint; if no server is listening,
 * calls fail with the real connection error — nothing is simulated.
 */

export class WebDriverError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'WebDriverError';
    this.status = status;
  }
}

export class WebDriverClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  get endpoint(): string {
    return this.baseUrl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30000),
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
