/**
 * WebdriverIO / chromedriver Adapter 🚗
 * REAL automation through a WebDriver-protocol endpoint — by default a local
 * chromedriver on http://localhost:9515 (override with OPENBOT_WEBDRIVER_URL
 * or the constructor argument). Without a running driver, actions return the
 * real connection error instead of pretending to succeed.
 */

import type { BrowserEngineType } from '../types.js';
import { WebDriverAdapterBase } from './webdriver-adapter-base.js';

export class WebdriverIOAdapter extends WebDriverAdapterBase {
  readonly engineType: BrowserEngineType = 'webdriverio';
  protected readonly label = 'WebdriverIO (chromedriver)';

  constructor(endpoint?: string) {
    super('http://localhost:9515', endpoint);
  }
}
