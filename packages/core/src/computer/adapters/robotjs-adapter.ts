/**
 * RobotJS Computer Control Adapter 🤖
 * Drives the real `robotjs` native module when it is installed
 * (`npm install robotjs` in @openbot/core). When the module is absent, every
 * action returns an honest failure — no simulated cursor state.
 */

import type {
  UniversalComputerAdapter,
  DisplayInfo,
  WindowInfo,
  ScreenPoint,
  MouseButton,
  ComputerActionResult,
  ComputerActionOptions,
} from '../types.js';

interface RobotModule {
  moveMouse(x: number, y: number): void;
  mouseClick(button?: string, double?: boolean): void;
  dragMouse(x: number, y: number, button?: string): void;
  scrollMouse(x: number, y: number): void;
  typeString(text: string): void;
  keyTap(key: string, modifier?: string | string[]): void;
  getMousePos(): { x: number; y: number };
  getScreenSize(): { width: number; height: number };
}

export class RobotJSAdapter implements UniversalComputerAdapter {
  private robot: RobotModule | null = null;
  private loadError: string | null = null;
  private loadAttempted = false;

  async initialize(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<RobotModule | null> {
    if (this.loadAttempted) return this.robot;
    this.loadAttempted = true;
    try {
      // Non-literal specifier: robotjs is an OPTIONAL native dependency that
      // is not part of @openbot/core's package.json; it is loaded only when
      // the host application installed it.
      const specifier: string = 'robotjs';
      const mod = (await import(specifier)) as unknown as { default?: RobotModule } & RobotModule;
      this.robot = (mod.default || mod) as RobotModule;
    } catch (err: any) {
      this.loadError =
        'The "robotjs" native module is not installed. Run `npm install robotjs` in @openbot/core, or use the PyAutoGUI/Tauri desktop engines instead.';
      this.robot = null;
    }
    return this.robot;
  }

  private async run(action: string, fn: (robot: RobotModule) => { message: string; cursor?: ScreenPoint }): Promise<ComputerActionResult> {
    const start = Date.now();
    const robot = await this.load();
    if (!robot) {
      return { success: false, action, message: this.loadError!, durationMs: Date.now() - start, error: 'robotjs_unavailable' };
    }
    try {
      const { message, cursor } = fn(robot);
      return { success: true, action, message, cursorPosition: cursor, durationMs: Date.now() - start };
    } catch (err: any) {
      return { success: false, action, message: `RobotJS ${action} failed: ${err.message}`, durationMs: Date.now() - start, error: err.message };
    }
  }

  async getDisplays(): Promise<DisplayInfo[]> {
    const robot = await this.load();
    if (!robot) return [];
    const size = robot.getScreenSize();
    return [
      { id: 'display_0', name: 'Primary Display', bounds: { x: 0, y: 0, width: size.width, height: size.height }, scaleFactor: 1, isPrimary: true },
    ];
  }

  async getWindows(): Promise<WindowInfo[]> {
    // robotjs cannot enumerate windows — report none rather than inventing one.
    return [];
  }

  async focusWindow(_windowId: string): Promise<boolean> {
    // robotjs has no window-focus API.
    return false;
  }

  async getCursorPosition(): Promise<ScreenPoint> {
    const robot = await this.load();
    if (!robot) throw new Error(this.loadError!);
    return robot.getMousePos();
  }

  async mouseMove(x: number, y: number, _options?: ComputerActionOptions): Promise<ComputerActionResult> {
    return this.run('mouse_move', (robot) => {
      robot.moveMouse(x, y);
      return { message: `[RobotJS] robot.moveMouse(${x}, ${y})`, cursor: { x, y } };
    });
  }

  async mouseClick(button: MouseButton = 'left', clickCount = 1, point?: ScreenPoint): Promise<ComputerActionResult> {
    return this.run('mouse_click', (robot) => {
      if (point) robot.moveMouse(point.x, point.y);
      robot.mouseClick(button, clickCount === 2);
      return { message: `[RobotJS] robot.mouseClick("${button}", ${clickCount === 2})`, cursor: robot.getMousePos() };
    });
  }

  async mouseDrag(from: ScreenPoint, to: ScreenPoint): Promise<ComputerActionResult> {
    return this.run('mouse_drag', (robot) => {
      robot.moveMouse(from.x, from.y);
      robot.dragMouse(to.x, to.y, 'left');
      return { message: `[RobotJS] robot.dragMouse(${to.x}, ${to.y})`, cursor: to };
    });
  }

  async mouseScroll(deltaY: number, deltaX = 0): Promise<ComputerActionResult> {
    return this.run('mouse_scroll', (robot) => {
      robot.scrollMouse(deltaX, deltaY);
      return { message: `[RobotJS] robot.scrollMouse(${deltaX}, ${deltaY})` };
    });
  }

  async keyboardType(text: string, _delayBetweenKeysMs = 10): Promise<ComputerActionResult> {
    return this.run('keyboard_type', (robot) => {
      robot.typeString(text);
      return { message: `[RobotJS] robot.typeString(${text.length} chars)` };
    });
  }

  async keyboardHotkey(keys: string[]): Promise<ComputerActionResult> {
    return this.run('keyboard_hotkey', (robot) => {
      const key = keys[keys.length - 1];
      const modifiers = keys.slice(0, -1).map((k) => k.toLowerCase());
      robot.keyTap(key.toLowerCase(), modifiers);
      return { message: `[RobotJS] robot.keyTap("${key}", [${modifiers.join(', ')}])` };
    });
  }

  async captureScreenshot(_displayIndex = 0): Promise<string> {
    throw new Error(
      'RobotJSAdapter cannot encode screenshots to PNG without an image encoder. Use PyAutoGUIAdapter (Pillow) or the Tauri desktop engine for screenshots.'
    );
  }
}
