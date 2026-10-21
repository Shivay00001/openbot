/**
 * OpenBot Universal Browser Automation Suite 🌐
 * Inspired by Manus, Hark AI, and Artemis mobile phone browser control.
 * 
 * Supports:
 * - Playwright (Chromium, WebKit, Firefox)
 * - Puppeteer & CDP (Chrome DevTools Protocol)
 * - Selenium WebDriver 4
 * - WebdriverIO
 * - Browser-Use agentic automation
 * - Artemis Phone Browser Controller for mobile phone browser control
 */

export * from './types.js';
export { ArtemisPhoneBrowserController } from './artemis-phone-browser.js';
export type { ArtemisMobileTouchGesture, ArtemisPhoneBrowserOptions } from './artemis-phone-browser.js';
export { PlaywrightAdapter } from './adapters/playwright-adapter.js';
export { PuppeteerAdapter } from './adapters/puppeteer-adapter.js';
export { SeleniumAdapter } from './adapters/selenium-adapter.js';
export { WebdriverIOAdapter } from './adapters/webdriverio-adapter.js';
export { BrowserUseAdapter } from './adapters/browser-use-adapter.js';
export { BrowserAutomationEngine } from './engine.js';
export type { BrowserEngineOptions } from './engine.js';

// Backwards-compatible alias for existing agent code
import { BrowserAutomationEngine } from './engine.js';
export class MultiTabBrowserAgent extends BrowserAutomationEngine {}
