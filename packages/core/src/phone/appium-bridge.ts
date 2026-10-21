/**
 * Appium Mobile Bridge 📲🌐
 * Real W3C WebDriver client for an Appium server (default
 * http://127.0.0.1:4723): session lifecycle, element lookup, click, keys,
 * and touch actions are actual protocol calls. Without a running Appium
 * server, calls fail with the real connection error — never fake success.
 */

import { WebDriverClient, WebDriverError } from '../browser/webdriver-client.js';

export interface AppiumCapabilities {
  platformName: 'Android' | 'iOS';
  automationName: 'UiAutomator2' | 'XCUITest';
  deviceName: string;
  appPackage?: string;
  appActivity?: string;
  bundleId?: string; // iOS
  udid?: string;
  noReset?: boolean;
}

export class AppiumBridge {
  private readonly client: WebDriverClient;
  private sessionId?: string;
  private capabilities: AppiumCapabilities;

  constructor(serverUrl = 'http://127.0.0.1:4723', capabilities?: Partial<AppiumCapabilities>) {
    this.client = new WebDriverClient(serverUrl);
    this.capabilities = {
      platformName: 'Android',
      automationName: 'UiAutomator2',
      deviceName: 'Pixel_8',
      noReset: true,
      ...capabilities,
    };
  }

  get isConnected(): boolean {
    return Boolean(this.sessionId);
  }

  /** Start a real session with the Appium server. */
  async startSession(): Promise<{ success: boolean; sessionId: string; error?: string }> {
    try {
      const caps: Record<string, unknown> = {
        platformName: this.capabilities.platformName,
        'appium:automationName': this.capabilities.automationName,
        'appium:deviceName': this.capabilities.deviceName,
        'appium:noReset': this.capabilities.noReset ?? true,
      };
      if (this.capabilities.appPackage) caps['appium:appPackage'] = this.capabilities.appPackage;
      if (this.capabilities.appActivity) caps['appium:appActivity'] = this.capabilities.appActivity;
      if (this.capabilities.bundleId) caps['appium:bundleId'] = this.capabilities.bundleId;
      if (this.capabilities.udid) caps['appium:udid'] = this.capabilities.udid;

      this.sessionId = await this.client.newSession(caps);
      return { success: true, sessionId: this.sessionId };
    } catch (err: any) {
      return { success: false, sessionId: '', error: err.message };
    }
  }

  private requireSession(): string {
    if (!this.sessionId) {
      throw new WebDriverError('No active Appium session. Call startSession() first.');
    }
    return this.sessionId;
  }

  private async findElement(using: string, value: string): Promise<string> {
    const session = this.requireSession();
    let response: Response;
    try {
      response = await fetch(`${this.client.endpoint}/session/${session}/element`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ using, value }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err: any) {
      throw new WebDriverError(`Appium server unreachable at ${this.client.endpoint}: ${err.message}`);
    }
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new WebDriverError(payload?.value?.message || `Element lookup failed (HTTP ${response.status})`, response.status);
    }
    const element = payload.value || {};
    const elementId = element['element-6066-11e4-a52e-4f735466cecf'] || Object.values(element)[0];
    if (!elementId) throw new WebDriverError(`Element not found: ${using}=${value}`);
    return elementId as string;
  }

  async findElementByAccessibilityId(accessibilityId: string): Promise<{ success: boolean; elementId: string; error?: string }> {
    try {
      const elementId = await this.findElement('accessibility id', accessibilityId);
      return { success: true, elementId };
    } catch (err: any) {
      return { success: false, elementId: '', error: err.message };
    }
  }

  async findElementByXPath(xpath: string): Promise<{ success: boolean; elementId: string; error?: string }> {
    try {
      const elementId = await this.findElement('xpath', xpath);
      return { success: true, elementId };
    } catch (err: any) {
      return { success: false, elementId: '', error: err.message };
    }
  }

  async clickElement(elementId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.clickElement(this.requireSession(), elementId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async sendKeys(elementId: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.sendKeys(this.requireSession(), elementId, text);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /** W3C Actions API touch sequence (press/wait/moveTo/tap/release steps). */
  async performTouchAction(actions: Array<{ action: string; options?: Record<string, unknown> }>): Promise<{ success: boolean; error?: string }> {
    try {
      const session = this.requireSession();
      const sequence: Array<Record<string, unknown>> = [];
      let downPending = false;
      for (const a of actions) {
        const opts = a.options || {};
        switch (a.action) {
          case 'press':
            sequence.push({ type: 'pointerMove', origin: 'viewport', x: Number(opts.x) || 0, y: Number(opts.y) || 0, duration: 0 });
            sequence.push({ type: 'pointerDown', button: 0 });
            downPending = true;
            break;
          case 'tap':
            sequence.push({ type: 'pointerMove', origin: 'viewport', x: Number(opts.x) || 0, y: Number(opts.y) || 0, duration: 0 });
            sequence.push({ type: 'pointerDown', button: 0 });
            sequence.push({ type: 'pointerUp', button: 0 });
            break;
          case 'wait':
            sequence.push({ type: 'pause', duration: Number(opts.ms) || 100 });
            break;
          case 'moveTo':
            sequence.push({ type: 'pointerMove', origin: 'viewport', x: Number(opts.x) || 0, y: Number(opts.y) || 0, duration: Number(opts.duration) || 250 });
            break;
          case 'release':
            sequence.push({ type: 'pointerUp', button: 0 });
            downPending = false;
            break;
          default:
            break;
        }
      }
      if (downPending) sequence.push({ type: 'pointerUp', button: 0 });

      let response: Response;
      try {
        response = await fetch(`${this.client.endpoint}/session/${session}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actions: [{ type: 'touch', id: 'finger1', parameters: { pointerType: 'touch' }, actions: sequence }],
          }),
          signal: AbortSignal.timeout(15000),
        });
      } catch (err: any) {
        throw new WebDriverError(`Appium server unreachable: ${err.message}`);
      }
      if (!response.ok) {
        const payload: any = await response.json().catch(() => ({}));
        throw new WebDriverError(payload?.value?.message || `Touch action failed (HTTP ${response.status})`, response.status);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async endSession(): Promise<void> {
    if (this.sessionId) {
      await this.client.deleteSession(this.sessionId).catch(() => undefined);
      this.sessionId = undefined;
    }
  }
}
