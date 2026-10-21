/**
 * Selenium WebDriver Adapter 🧪
 * REAL automation through a Selenium Grid / standalone server speaking the
 * W3C WebDriver protocol (default endpoint http://localhost:4444, override
 * with OPENBOT_WEBDRIVER_URL). Without a running server, actions return the
 * real connection error instead of pretending to succeed.
 */

import type { BrowserEngineType } from '../types.js';
import { WebDriverAdapterBase } from './webdriver-adapter-base.js';

export class SeleniumAdapter extends WebDriverAdapterBase {
  readonly engineType: BrowserEngineType = 'selenium';
  protected readonly label = 'Selenium WebDriver';

  constructor(endpoint?: string) {
    super('http://localhost:4444', endpoint);
  }
}
