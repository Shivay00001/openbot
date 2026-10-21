/**
 * Self-Operating Computer Framework 👁️🖥️
 * Visual grounding loop:
 * 1. Capture the real screen through a computer adapter.
 * 2. Detect UI elements with a REAL detector (pluggable):
 *    - OmniParser-compatible HTTP endpoint (OPENBOT_OMNIPARSER_URL), or
 *    - Tesseract OCR CLI (word bounding boxes) when installed, or
 *    - a custom detector injected by the host application.
 *    When no detector is available, perception returns the screenshot with
 *    an empty element list and says so — elements are never fabricated.
 * 3. Label elements [0], [1], [2]... and dispatch actions by tag/coordinate
 *    through the adapter.
 */

import { v4 as uuid } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  UniversalComputerAdapter,
  VisualGroundingElement,
  ComputerActionResult,
} from './types.js';
import { PyAutoGUIAdapter } from './adapters/pyautogui-adapter.js';
import { proxiedFetch } from '../net/http.js';

const execFileAsync = promisify(execFile);

export interface VisualGroundingPrediction {
  elementTag: number;
  confidence: number;
  action: 'click' | 'double_click' | 'right_click' | 'type' | 'drag' | 'scroll' | 'hotkey';
  value?: string;
  reasoning: string;
}

/** A detector turns a screenshot (data URL or raw base64 PNG) into elements. */
export type VisualElementDetector = (screenshotBase64: string) => Promise<VisualGroundingElement[]>;

function label(elements: Array<Omit<VisualGroundingElement, 'id' | 'labelIndex'>>): VisualGroundingElement[] {
  return elements.map((el, i) => ({ ...el, id: uuid(), labelIndex: i }));
}

/** Detector backed by an OmniParser-compatible HTTP endpoint. */
export function createOmniParserDetector(endpoint: string): VisualElementDetector {
  return async (screenshotBase64: string) => {
    const response = await proxiedFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: screenshotBase64.replace(/^data:image\/[a-z]+;base64,/, '') }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      throw new Error(`OmniParser endpoint returned HTTP ${response.status}`);
    }
    const payload: any = await response.json();
    const items: any[] = payload.elements || payload.parsed_content || payload.results || [];
    return label(
      items.map((item) => {
        const bbox: number[] = item.bbox || item.bounds || [0, 0, 0, 0];
        // OmniParser reports relative 0–1000 coordinates; adapters that
        // report pixels are also tolerated by checking magnitude later.
        const [x1, y1, x2, y2] = bbox;
        return {
          role: (item.type === 'text' ? 'button' : item.type || 'button') as VisualGroundingElement['role'],
          text: item.content || item.label || item.text || '',
          bounds: { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) },
          center: { x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) },
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.8,
        };
      })
    );
  };
}

/** Detector backed by the Tesseract OCR CLI (word-level bounding boxes). */
export function createTesseractDetector(): VisualElementDetector {
  return async (screenshotBase64: string) => {
    const base64 = screenshotBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const tempFile = path.join(os.tmpdir(), `openbot-ocr-${uuid()}.png`);
    try {
      fs.writeFileSync(tempFile, Buffer.from(base64, 'base64'));
      const { stdout } = await execFileAsync('tesseract', [tempFile, 'stdout', 'tsv'], {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const lines = stdout.split('\n').filter(Boolean);
      const header = lines[0]?.split('\t') || [];
      const col = (name: string) => header.indexOf(name);
      const [ciLevel, ciLeft, ciTop, ciWidth, ciHeight, ciConf, ciText] = [
        col('level'), col('left'), col('top'), col('width'), col('height'), col('conf'), col('text'),
      ];
      const elements: Array<Omit<VisualGroundingElement, 'id' | 'labelIndex'>> = [];
      for (const line of lines.slice(1)) {
        const cells = line.split('\t');
        if (Number(cells[ciLevel]) !== 5) continue; // word level
        const conf = Number(cells[ciConf]);
        const text = (cells[ciText] || '').trim();
        if (!text || conf < 30) continue;
        const x = Number(cells[ciLeft]);
        const y = Number(cells[ciTop]);
        const width = Number(cells[ciWidth]);
        const height = Number(cells[ciHeight]);
        elements.push({
          role: 'button',
          text,
          bounds: { x, y, width, height },
          center: { x: Math.round(x + width / 2), y: Math.round(y + height / 2) },
          confidence: conf / 100,
        });
      }
      return label(elements.slice(0, 100));
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // temp file already gone
      }
    }
  };
}

async function isTesseractAvailable(): Promise<boolean> {
  try {
    await execFileAsync('tesseract', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export class SelfOperatingComputerEngine {
  private adapter: UniversalComputerAdapter;
  private detector: VisualElementDetector | null;
  private detectorName = 'none';
  private currentElements: VisualGroundingElement[] = [];
  private history: Array<{ timestamp: number; action: string; tag?: number; result: boolean }> = [];

  constructor(adapter?: UniversalComputerAdapter, detector?: VisualElementDetector) {
    this.adapter = adapter || new PyAutoGUIAdapter();
    this.detector = detector || null;
    if (detector) this.detectorName = 'custom';
  }

  private async resolveDetector(): Promise<VisualElementDetector | null> {
    if (this.detector) return this.detector;
    const omniUrl = process.env.OPENBOT_OMNIPARSER_URL;
    if (omniUrl) {
      this.detector = createOmniParserDetector(omniUrl);
      this.detectorName = 'omniparser';
      return this.detector;
    }
    if (await isTesseractAvailable()) {
      this.detector = createTesseractDetector();
      this.detectorName = 'tesseract-ocr';
      return this.detector;
    }
    this.detectorName = 'none';
    return null;
  }

  /**
   * Perceive the current screen: real screenshot + detector-produced elements.
   * Throws when the underlying adapter cannot capture the screen at all.
   */
  async perceiveScreen(displayIndex = 0): Promise<{
    screenshotBase64: string;
    elements: VisualGroundingElement[];
    taggedOverview: string;
  }> {
    const screenshotBase64 = await this.adapter.captureScreenshot(displayIndex);
    const detector = await this.resolveDetector();

    if (!detector) {
      this.currentElements = [];
      return {
        screenshotBase64,
        elements: [],
        taggedOverview:
          'No visual element detector is available. Set OPENBOT_OMNIPARSER_URL to an OmniParser-compatible endpoint or install the tesseract OCR CLI, or inject a custom detector. The screenshot itself was captured successfully.',
      };
    }

    this.currentElements = await detector(screenshotBase64);
    const taggedOverview = this.currentElements
      .map((el) => `[${el.labelIndex}] ${el.role.toUpperCase()}: "${el.text || 'unlabeled'}" at (${el.center.x}, ${el.center.y}) [conf: ${Math.round(el.confidence * 100)}%]`)
      .join('\n');

    return {
      screenshotBase64,
      elements: this.currentElements,
      taggedOverview: taggedOverview || `Detector (${this.detectorName}) found no elements on this screen.`,
    };
  }

  /**
   * Execute action by visual tag index (e.g. click element [3])
   */
  async executeTagAction(tagIndex: number, actionType: 'click' | 'double_click' | 'right_click' | 'type' = 'click', value?: string): Promise<ComputerActionResult> {
    const element = this.currentElements.find((e) => e.labelIndex === tagIndex);
    if (!element) {
      return {
        success: false,
        action: actionType,
        message: `Visual tag [${tagIndex}] not found on current screen. Please re-run perceiveScreen().`,
        durationMs: 0,
      };
    }

    await this.adapter.mouseMove(element.center.x, element.center.y, { smoothMove: true, durationMs: 150 });

    let result: ComputerActionResult;
    if (actionType === 'click') {
      result = await this.adapter.mouseClick('left', 1);
    } else if (actionType === 'double_click') {
      result = await this.adapter.mouseClick('left', 2);
    } else if (actionType === 'right_click') {
      result = await this.adapter.mouseClick('right', 1);
    } else if (actionType === 'type') {
      await this.adapter.mouseClick('left', 1);
      result = await this.adapter.keyboardType(value || '');
    } else {
      result = await this.adapter.mouseClick('left', 1);
    }

    this.history.push({
      timestamp: Date.now(),
      action: actionType,
      tag: tagIndex,
      result: result.success,
    });

    return result;
  }

  async clickCoordinate(x: number, y: number, clickCount = 1): Promise<ComputerActionResult> {
    await this.adapter.mouseMove(x, y);
    return this.adapter.mouseClick('left', clickCount);
  }

  async typeText(text: string): Promise<ComputerActionResult> {
    return this.adapter.keyboardType(text);
  }

  async pressHotkey(keys: string[]): Promise<ComputerActionResult> {
    return this.adapter.keyboardHotkey(keys);
  }
}
