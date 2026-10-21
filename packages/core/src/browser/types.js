"use strict";
/**
 * OpenBot Universal Browser Automation Types 🌐
 * Supports Playwright, Puppeteer, Selenium, WebdriverIO, Browser-Use, and Artemis Phone Browser.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BROWSER_DEVICE_PRESETS = void 0;
exports.BROWSER_DEVICE_PRESETS = {
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
//# sourceMappingURL=types.js.map