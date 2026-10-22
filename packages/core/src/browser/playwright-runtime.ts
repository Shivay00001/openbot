/**
 * Playwright runtime loader 🎭
 * Loads the `playwright` package lazily and locates a Chromium executable:
 * explicit env override → Playwright browser cache → system Chrome/Chromium.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type PlaywrightModule = typeof import('playwright');

let cachedModule: PlaywrightModule | null = null;

export async function loadPlaywright(): Promise<PlaywrightModule> {
  if (cachedModule) return cachedModule;
  try {
    cachedModule = (await import('playwright')) as PlaywrightModule;
    return cachedModule;
  } catch {
    throw new Error(
      'The "playwright" package is not installed. Run `npm install playwright` in @openbot/core ' +
        '(and `npx playwright install chromium` if no browser is cached) to enable real browser automation.'
    );
  }
}

function candidateExecutablePaths(): string[] {
  const candidates: string[] = [];
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) {
    candidates.push(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE);
  }
  if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH);

  const cacheRoots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), '.cache', 'ms-playwright'),
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : '',
    path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright'),
  ].filter(Boolean) as string[];

  for (const cacheRoot of cacheRoots) {
    try {
      if (fs.existsSync(cacheRoot)) {
        const entries = fs
          .readdirSync(cacheRoot)
          .filter((e) => e.startsWith('chromium'))
          .sort()
          .reverse();
        for (const entry of entries) {
          candidates.push(
            path.join(cacheRoot, entry, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
            path.join(cacheRoot, entry, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
            path.join(cacheRoot, entry, 'chrome-linux64', 'chrome'),
            path.join(cacheRoot, entry, 'chrome-linux', 'chrome'),
            path.join(cacheRoot, entry, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
            path.join(cacheRoot, entry, 'chrome-win', 'chrome.exe'),
            path.join(cacheRoot, entry, 'chrome-win64', 'chrome.exe')
          );
        }
      }
    } catch {
      // cache dir unreadable — fall through
    }
  }

  candidates.push(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  );
  return candidates;
}

/** Locate a usable Chromium executable, or undefined to let Playwright resolve its own. */
export function findChromiumExecutable(): string | undefined {
  for (const candidate of candidateExecutablePaths()) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      // keep searching
    }
  }
  return undefined;
}
