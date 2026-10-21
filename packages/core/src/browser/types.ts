/**
 * OpenBot Universal Browser Automation Types 🌐
 * Supports Playwright, Puppeteer, Selenium, WebdriverIO, Browser-Use, and Artemis Phone Browser.
 */

export type BrowserEngineType =
  | 'playwright'
  | 'puppeteer'
  | 'selenium'
  | 'webdriverio'
  | 'browser_use'
  | 'artemis_mobile'
  | 'cdp';

export interface BrowserDevicePreset {
  name: string;
  userAgent: string;
  viewport: { width: number; height: number; deviceScaleFactor: number };
  isMobile: boolean;
  hasTouch: boolean;
}

export const BROWSER_DEVICE_PRESETS: Record<string, BrowserDevicePreset> = {
  desktop_hd: {
    name: 'Desktop 1080p',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    isMobile: false,
    hasTouch: false,
  },
  iphone_15_pro: {
    name: 'iPhone 15 Pro',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852, deviceScaleFactor: 3 },
    isMobile: true,
    hasTouch: true,
  },
  pixel_8: {
    name: 'Google Pixel 8',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915, deviceScaleFactor: 2.625 },
    isMobile: true,
    hasTouch: true,
  },
  ipad_pro: {
    name: 'iPad Pro 11',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    viewport: { width: 834, height: 1194, deviceScaleFactor: 2 },
    isMobile: true,
    hasTouch: true,
  },
};

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  createdAt: number;
}

export interface BrowserElement {
  id: string;
  selector: string;
  tagName: string;
  text: string;
  attributes: Record<string, string>;
  isInteractive: boolean;
  isVisible: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  accessibilityLabel?: string;
}

export interface BrowserViewportState {
  activeTabId: string;
  tabs: BrowserTab[];
  currentUrl: string;
  pageTitle: string;
  viewportDimensions: { width: number; height: number };
  screenshotBase64?: string;
  interactiveElements: BrowserElement[];
  engine: BrowserEngineType;
  isHeadless: boolean;
  devicePreset?: string;
}

export interface BrowserActionOptions {
  timeoutMs?: number;
  waitForSelector?: string;
  waitForNavigation?: boolean;
}

export interface BrowserActionResult {
  success: boolean;
  message: string;
  currentUrl?: string;
  screenshotBase64?: string;
  durationMs: number;
  error?: string;
}

export interface ExtractedPageContent {
  title: string;
  url: string;
  markdown: string;
  text: string;
  links: Array<{ text: string; href: string }>;
  tables: Array<{ headers: string[]; rows: string[][] }>;
  metadata: Record<string, string>;
}

export interface UniversalBrowserAdapter {
  readonly engineType: BrowserEngineType;
  initialize(options?: { headless?: boolean; devicePreset?: string; proxyUrl?: string }): Promise<void>;
  navigate(url: string, options?: BrowserActionOptions): Promise<BrowserActionResult>;
  click(selectorOrCoord: string | { x: number; y: number }): Promise<BrowserActionResult>;
  type(selector: string, text: string, options?: { clearFirst?: boolean; submit?: boolean }): Promise<BrowserActionResult>;
  scroll(direction: 'up' | 'down' | 'top' | 'bottom', distancePx?: number): Promise<BrowserActionResult>;
  touch(type: 'tap' | 'double_tap' | 'swipe' | 'pinch', params: Record<string, unknown>): Promise<BrowserActionResult>;
  captureScreenshot(): Promise<string>;
  extractContent(): Promise<ExtractedPageContent>;
  getInteractiveElements(): Promise<BrowserElement[]>;
  close(): Promise<void>;
}
