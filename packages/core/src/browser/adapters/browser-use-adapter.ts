/**
 * Browser-Use Agentic Automation Adapter 🤖
 * LLM-oriented layer over the REAL Playwright engine: after each navigation
 * it indexes the live DOM's interactive elements ([0], [1], [2], ...) so an
 * agent can act by index — the browser-use pattern — while every action is
 * executed for real by Chromium underneath.
 */

import type {
  UniversalBrowserAdapter,
  BrowserEngineType,
  BrowserActionResult,
  BrowserActionOptions,
  ExtractedPageContent,
  BrowserElement,
} from '../types.js';
import { PlaywrightAdapter } from './playwright-adapter.js';

export interface BrowserUseActionPlan {
  action: 'click' | 'type' | 'scroll' | 'wait' | 'done';
  elementIndex?: number;
  value?: string;
  thought: string;
}

export class BrowserUseAdapter implements UniversalBrowserAdapter {
  readonly engineType: BrowserEngineType = 'browser_use';
  private readonly playwright = new PlaywrightAdapter();
  private indexedElements: BrowserElement[] = [];

  async initialize(options?: { headless?: boolean; devicePreset?: string; proxyUrl?: string }): Promise<void> {
    await this.playwright.initialize(options);
    await this.refreshIndex();
  }

  /** Current indexed interactive elements from the live DOM. */
  getIndexedElements(): BrowserElement[] {
    return this.indexedElements;
  }

  private async refreshIndex(): Promise<void> {
    try {
      this.indexedElements = await this.playwright.getInteractiveElements();
    } catch {
      this.indexedElements = [];
    }
  }

  async navigate(url: string, options?: BrowserActionOptions): Promise<BrowserActionResult> {
    const result = await this.playwright.navigate(url, options);
    if (result.success) {
      await this.refreshIndex();
      result.message += ` Indexed ${this.indexedElements.length} interactive elements for LLM planning.`;
    }
    return result;
  }

  /** Accepts a CSS selector, visible text, or an element index ("3" / "[3]"). */
  async click(selectorOrCoord: string | { x: number; y: number }): Promise<BrowserActionResult> {
    if (typeof selectorOrCoord === 'string') {
      const indexMatch = selectorOrCoord.trim().match(/^\[?(\d+)\]?$/);
      if (indexMatch) {
        const element = this.indexedElements[Number(indexMatch[1])];
        if (!element) {
          return {
            success: false,
            message: `[Browser-Use] Element index ${indexMatch[1]} not in the current index (${this.indexedElements.length} elements). Re-navigate to refresh.`,
            error: 'index_out_of_range',
            durationMs: 0,
          };
        }
        const result = await this.playwright.click(element.selector);
        if (result.success) await this.refreshIndex();
        return result;
      }
    }
    const result = await this.playwright.click(selectorOrCoord as string);
    if (result.success) await this.refreshIndex();
    return result;
  }

  async type(selector: string, text: string, options?: { clearFirst?: boolean; submit?: boolean }): Promise<BrowserActionResult> {
    const indexMatch = selector.trim().match(/^\[?(\d+)\]?$/);
    const target = indexMatch && this.indexedElements[Number(indexMatch[1])]
      ? this.indexedElements[Number(indexMatch[1])].selector
      : selector;
    const result = await this.playwright.type(target, text, options);
    if (result.success) await this.refreshIndex();
    return result;
  }

  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', distancePx?: number): Promise<BrowserActionResult> {
    const result = await this.playwright.scroll(direction, distancePx);
    if (result.success) await this.refreshIndex();
    return result;
  }

  async touch(type: 'tap' | 'double_tap' | 'swipe' | 'pinch', params: Record<string, unknown>): Promise<BrowserActionResult> {
    return this.playwright.touch(type, params);
  }

  async captureScreenshot(): Promise<string> {
    return this.playwright.captureScreenshot();
  }

  async extractContent(): Promise<ExtractedPageContent> {
    const content = await this.playwright.extractContent();
    content.metadata = { ...content.metadata, engine: 'browser_use', indexedElements: String(this.indexedElements.length) };
    return content;
  }

  async getInteractiveElements(): Promise<BrowserElement[]> {
    await this.refreshIndex();
    return this.indexedElements;
  }

  async close(): Promise<void> {
    await this.playwright.close();
  }
}
