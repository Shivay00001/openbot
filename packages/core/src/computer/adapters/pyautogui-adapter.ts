/**
 * PyAutoGUI Computer Control Adapter 🐍
 * REAL desktop automation through a Python bridge process: each operation
 * runs a fixed bridge script (parameters passed as JSON on stdin, never
 * string-interpolated) that drives pyautogui / pygetwindow / Pillow on the
 * host. Requires python3 with `pip install pyautogui pygetwindow pillow`
 * and a live display session. When the bridge is unavailable, actions return
 * honest failures — coordinates and screenshots are never fabricated.
 */

import { execFile } from 'child_process';
import type {
  UniversalComputerAdapter,
  DisplayInfo,
  WindowInfo,
  ScreenPoint,
  MouseButton,
  ComputerActionResult,
  ComputerActionOptions,
} from '../types.js';
import { WindowsNativeDriver } from '../windows-native-driver.js';

const BRIDGE_SCRIPT = `
import sys, json, base64, io
try:
    import pyautogui
    pyautogui.FAILSAFE = False
except Exception as e:
    print(json.dumps({"ok": False, "error": "pyautogui unavailable: " + str(e)}))
    sys.exit(0)

req = json.loads(sys.stdin.read() or "{}")
op = req.get("op")

def out(obj):
    print(json.dumps(obj))

try:
    if op == "size":
        s = pyautogui.size()
        out({"ok": True, "width": s.width, "height": s.height})
    elif op == "position":
        p = pyautogui.position()
        out({"ok": True, "x": p.x, "y": p.y})
    elif op == "moveTo":
        pyautogui.moveTo(req["x"], req["y"], duration=(req.get("durationMs", 0) / 1000.0))
        p = pyautogui.position()
        out({"ok": True, "x": p.x, "y": p.y})
    elif op == "click":
        if "x" in req and "y" in req:
            pyautogui.moveTo(req["x"], req["y"])
        pyautogui.click(button=req.get("button", "left"), clicks=req.get("clicks", 1))
        p = pyautogui.position()
        out({"ok": True, "x": p.x, "y": p.y})
    elif op == "drag":
        pyautogui.moveTo(req["fromX"], req["fromY"])
        pyautogui.dragTo(req["toX"], req["toY"], duration=0.25, button="left")
        p = pyautogui.position()
        out({"ok": True, "x": p.x, "y": p.y})
    elif op == "scroll":
        pyautogui.scroll(req.get("deltaY", 0))
        out({"ok": True})
    elif op == "typewrite":
        pyautogui.typewrite(req.get("text", ""), interval=0.01)
        out({"ok": True})
    elif op == "hotkey":
        pyautogui.hotkey(*[k.lower() for k in req.get("keys", [])])
        out({"ok": True})
    elif op == "screenshot":
        img = pyautogui.screenshot()
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        out({"ok": True, "base64": base64.b64encode(buf.getvalue()).decode("ascii")})
    elif op == "windows":
        wins = []
        try:
            import pygetwindow as gw
            for i, w in enumerate(gw.getAllWindows()):
                if w.title:
                    wins.append({"id": str(i), "title": w.title, "left": w.left, "top": w.top, "width": w.width, "height": w.height})
        except ImportError:
            pass
        out({"ok": True, "windows": wins})
    elif op == "focus":
        import pygetwindow as gw
        candidates = gw.getWindowsWithTitle(req.get("title", ""))
        if candidates:
            candidates[0].activate()
            out({"ok": True})
        else:
            out({"ok": False, "error": "window not found"})
    else:
        out({"ok": False, "error": "unknown op: " + str(op)})
except Exception as e:
    out({"ok": False, "error": str(e)})
`;

interface BridgeResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

export class PyAutoGUIAdapter implements UniversalComputerAdapter {
  private windowsDriver = new WindowsNativeDriver();
  private bridgeError: string | null = null;
  private bridgeChecked = false;

  async initialize(): Promise<void> {
    await this.checkBridge();
  }

  private async checkBridge(): Promise<boolean> {
    if (this.bridgeChecked) return this.bridgeError === null;
    this.bridgeChecked = true;
    try {
      const res = await this.runBridge({ op: 'size' });
      this.bridgeError = res.ok ? null : res.error || 'pyautogui bridge failed';
    } catch (err: any) {
      this.bridgeError = err.message;
    }
    return this.bridgeError === null;
  }

  private runBridge(payload: Record<string, unknown>): Promise<BridgeResponse> {
    const python = process.platform === 'win32' ? 'python' : 'python3';
    return new Promise((resolve, reject) => {
      const child = execFile(
        python,
        ['-c', BRIDGE_SCRIPT],
        { timeout: 20000, maxBuffer: 30 * 1024 * 1024 },
        (error, stdout) => {
          if (error) {
            if ((error as any).code === 'ENOENT') {
              reject(new Error('python3 not found on PATH — the PyAutoGUI adapter needs Python 3 with pyautogui installed.'));
            } else {
              reject(error);
            }
            return;
          }
          const lastLine = String(stdout).trim().split('\n').filter(Boolean).pop() || '{}';
          try {
            resolve(JSON.parse(lastLine) as BridgeResponse);
          } catch {
            reject(new Error(`PyAutoGUI bridge returned unparseable output: ${lastLine.slice(0, 200)}`));
          }
        }
      );
      child.stdin?.end(JSON.stringify(payload));
    });
  }

  private async bridgeResult(
    action: string,
    payload: Record<string, unknown>,
    successMessage: (res: BridgeResponse) => string
  ): Promise<ComputerActionResult> {
    const start = Date.now();
    if (process.platform === 'win32') {
      // On Windows the native driver is the primary path.
      return this.windowsFallback(action, payload, start);
    }
    if (!(await this.checkBridge())) {
      return {
        success: false,
        action,
        message: `PyAutoGUI bridge unavailable: ${this.bridgeError}`,
        durationMs: Date.now() - start,
        error: this.bridgeError || undefined,
      };
    }
    try {
      const res = await this.runBridge(payload);
      if (!res.ok) {
        return { success: false, action, message: `PyAutoGUI ${action} failed: ${res.error}`, durationMs: Date.now() - start, error: res.error };
      }
      return {
        success: true,
        action,
        message: successMessage(res),
        cursorPosition: typeof res.x === 'number' ? { x: res.x as number, y: res.y as number } : undefined,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return { success: false, action, message: `PyAutoGUI ${action} failed: ${err.message}`, durationMs: Date.now() - start, error: err.message };
    }
  }

  private async windowsFallback(action: string, payload: Record<string, unknown>, start: number): Promise<ComputerActionResult> {
    // Delegate to the real Windows native driver where an equivalent exists.
    switch (payload.op) {
      case 'moveTo':
        return this.windowsDriver.mouseMove(payload.x as number, payload.y as number);
      case 'click':
        return this.windowsDriver.mouseClick(
          (payload.button as MouseButton) || 'left',
          (payload.clicks as number) || 1,
          typeof payload.x === 'number' ? { x: payload.x as number, y: payload.y as number } : undefined
        );
      case 'typewrite':
        return this.windowsDriver.keyboardType(payload.text as string);
      case 'hotkey':
        return this.windowsDriver.keyboardHotkey(payload.keys as string[]);
      default:
        return {
          success: false,
          action,
          message: `Operation ${String(payload.op)} is not available through the Windows fallback driver`,
          durationMs: Date.now() - start,
        };
    }
  }

  async getDisplays(): Promise<DisplayInfo[]> {
    if (process.platform === 'win32') {
      // Windows driver does not enumerate displays; PyAutoGUI bridge reports primary size.
    }
    if (!(await this.checkBridge())) return [];
    const res = await this.runBridge({ op: 'size' });
    if (!res.ok) return [];
    return [
      {
        id: 'display_primary',
        name: 'Primary Display',
        bounds: { x: 0, y: 0, width: res.width as number, height: res.height as number },
        scaleFactor: 1.0,
        isPrimary: true,
      },
    ];
  }

  async getWindows(): Promise<WindowInfo[]> {
    if (process.platform === 'win32') {
      const realWindows = await this.windowsDriver.getActiveWindows();
      if (realWindows.length > 0) return realWindows;
    }
    if (!(await this.checkBridge())) return [];
    const res = await this.runBridge({ op: 'windows' });
    if (!res.ok) return [];
    const wins = (res.windows as Array<Record<string, unknown>>) || [];
    return wins.map((w) => ({
      id: String(w.id),
      title: String(w.title),
      processName: 'unknown',
      processId: 0,
      bounds: {
        x: Number(w.left) || 0,
        y: Number(w.top) || 0,
        width: Number(w.width) || 0,
        height: Number(w.height) || 0,
      },
      isFocused: false,
      isMinimized: false,
      isMaximized: false,
    }));
  }

  async focusWindow(windowId: string): Promise<boolean> {
    if (process.platform === 'win32') {
      return this.windowsDriver.focusWindow(windowId);
    }
    if (!(await this.checkBridge())) return false;
    const windows = await this.getWindows();
    const target = windows.find((w) => w.id === windowId);
    if (!target) return false;
    const res = await this.runBridge({ op: 'focus', title: target.title });
    return res.ok;
  }

  async getCursorPosition(): Promise<ScreenPoint> {
    if (process.platform === 'win32') {
      return this.windowsDriver.getCursorPosition();
    }
    if (!(await this.checkBridge())) {
      throw new Error(`PyAutoGUI bridge unavailable: ${this.bridgeError}`);
    }
    const res = await this.runBridge({ op: 'position' });
    if (!res.ok) throw new Error(`Failed to read cursor position: ${res.error}`);
    return { x: res.x as number, y: res.y as number };
  }

  async mouseMove(x: number, y: number, options?: ComputerActionOptions): Promise<ComputerActionResult> {
    return this.bridgeResult('mouse_move', { op: 'moveTo', x, y, durationMs: options?.durationMs || 0 }, () => `Mouse moved to (${x}, ${y})`);
  }

  async mouseClick(button: MouseButton = 'left', clickCount = 1, point?: ScreenPoint): Promise<ComputerActionResult> {
    return this.bridgeResult(
      'mouse_click',
      { op: 'click', button, clicks: clickCount, ...(point ? { x: point.x, y: point.y } : {}) },
      () => `Clicked ${button} x${clickCount}`
    );
  }

  async mouseDrag(from: ScreenPoint, to: ScreenPoint): Promise<ComputerActionResult> {
    return this.bridgeResult('mouse_drag', { op: 'drag', fromX: from.x, fromY: from.y, toX: to.x, toY: to.y }, () => `Dragged from (${from.x}, ${from.y}) to (${to.x}, ${to.y})`);
  }

  async mouseScroll(deltaY: number, _deltaX = 0): Promise<ComputerActionResult> {
    return this.bridgeResult('mouse_scroll', { op: 'scroll', deltaY }, () => `Scrolled deltaY: ${deltaY}`);
  }

  async keyboardType(text: string, _delayBetweenKeysMs = 10): Promise<ComputerActionResult> {
    return this.bridgeResult('keyboard_type', { op: 'typewrite', text }, () => `Typed ${text.length} characters`);
  }

  async keyboardHotkey(keys: string[]): Promise<ComputerActionResult> {
    return this.bridgeResult('keyboard_hotkey', { op: 'hotkey', keys }, () => `Hotkey sent: ${keys.join('+')}`);
  }

  async captureScreenshot(_displayIndex = 0): Promise<string> {
    if (process.platform === 'win32') {
      return this.windowsDriver.captureScreenshot();
    }
    if (!(await this.checkBridge())) {
      throw new Error(`PyAutoGUI bridge unavailable: ${this.bridgeError}`);
    }
    const res = await this.runBridge({ op: 'screenshot' });
    if (!res.ok || typeof res.base64 !== 'string') {
      throw new Error(`Screenshot failed: ${res.error || 'no image returned'}`);
    }
    return `data:image/png;base64,${res.base64}`;
  }
}
