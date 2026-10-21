/**
 * Android Debug Bridge (ADB) Protocol Controller 📱🔧
 * Real hardware bridge for physical Android devices via USB or Wi-Fi TCP/IP.
 * Every operation executes the actual `adb` binary with argv arrays (never a
 * shell string, so device/user input cannot inject commands). When ADB or a
 * device is unavailable, methods return/throw the real error — no simulated
 * screenshots, no fake UI trees.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { PhoneKeyCode } from './index.js';

const execFileAsync = promisify(execFile);

export interface AdbDevice {
  serial: string;
  state: 'device' | 'offline' | 'unauthorized' | 'bootloader';
  model?: string;
  product?: string;
  ipAddress?: string;
}

export interface AdbCommandResult {
  success: boolean;
  command: string;
  output?: string;
}

export class AdbUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdbUnavailableError';
  }
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const HOSTNAME = /^[a-zA-Z0-9._-]+$/;
const PACKAGE_NAME = /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/;

export function isValidPackageName(name: string): boolean {
  return PACKAGE_NAME.test(name);
}

export class AdbController {
  private activeDeviceSerial?: string;
  private connectedDevices: AdbDevice[] = [];

  private args(...rest: string[]): string[] {
    return this.activeDeviceSerial ? ['-s', this.activeDeviceSerial, ...rest] : rest;
  }

  private display(args: string[]): string {
    return `adb ${args.join(' ')}`;
  }

  /** Run adb with argv; throws AdbUnavailableError with the real stderr on failure. */
  async run(argv: string[], options?: { maxBuffer?: number }): Promise<string> {
    try {
      const { stdout } = await execFileAsync('adb', argv, {
        maxBuffer: options?.maxBuffer || 10 * 1024 * 1024,
        timeout: 30000,
      });
      return stdout as string;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw new AdbUnavailableError(
          'adb binary not found on PATH. Install Android platform-tools to use Agentic Phone Mode over ADB.'
        );
      }
      const stderr = (err.stderr || '').toString().trim();
      throw new AdbUnavailableError(
        `adb ${argv.join(' ')} failed: ${stderr || err.message}`
      );
    }
  }

  /** Run an `adb shell` command on the active device. */
  async shell(shellArgs: string[]): Promise<string> {
    return this.run(this.args('shell', ...shellArgs));
  }

  async isAdbAvailable(): Promise<boolean> {
    try {
      const stdout = await this.run(['version']);
      return stdout.includes('Android Debug Bridge');
    } catch {
      return false;
    }
  }

  /**
   * Discover and list connected physical Android devices and emulators
   */
  async listDevices(): Promise<AdbDevice[]> {
    const stdout = await this.run(['devices', '-l']);
    const lines = stdout.split('\n').filter((l) => l.trim() && !l.startsWith('*') && !l.startsWith('List of'));

    this.connectedDevices = lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      const serial = parts[0];
      const state = (parts[1] as AdbDevice['state']) || 'device';
      const modelMatch = line.match(/model:([^\s]+)/);
      const productMatch = line.match(/product:([^\s]+)/);
      return {
        serial,
        state,
        model: modelMatch ? modelMatch[1] : 'Android Device',
        product: productMatch ? productMatch[1] : 'generic',
        ipAddress: serial.includes(':') ? serial.split(':')[0] : undefined,
      };
    });

    if (this.connectedDevices.length > 0 && !this.activeDeviceSerial) {
      this.activeDeviceSerial = this.connectedDevices[0].serial;
    }

    return this.connectedDevices;
  }

  /**
   * Connect to Android device over Wi-Fi TCP/IP
   */
  async connectTcp(ipAddress: string, port = 5555): Promise<{ success: boolean; message: string }> {
    if (!IPV4.test(ipAddress) && !HOSTNAME.test(ipAddress)) {
      return { success: false, message: `Invalid IP address or hostname: "${ipAddress}"` };
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { success: false, message: `Invalid port: ${port}` };
    }
    try {
      const output = (await this.run(['connect', `${ipAddress}:${port}`])).trim();
      const success = output.includes('connected to');
      if (success) {
        this.activeDeviceSerial = `${ipAddress}:${port}`;
        await this.listDevices();
      }
      return { success, message: output };
    } catch (err: any) {
      return { success: false, message: `Failed to connect via TCP: ${err.message}` };
    }
  }

  selectDevice(serial: string): void {
    this.activeDeviceSerial = serial;
  }

  getActiveDevice(): string | undefined {
    return this.activeDeviceSerial;
  }

  private async inputResult(argv: string[]): Promise<AdbCommandResult> {
    const full = this.args('shell', 'input', ...argv);
    try {
      const output = await this.run(full);
      return { success: true, command: this.display(full), output };
    } catch (err: any) {
      return { success: false, command: this.display(full), output: err.message };
    }
  }

  /** Real screen coordinate tap via `adb shell input tap x y` */
  async tap(x: number, y: number): Promise<AdbCommandResult> {
    return this.inputResult(['tap', String(Math.round(x)), String(Math.round(y))]);
  }

  /** Real swipe/fling via `adb shell input swipe x1 y1 x2 y2 duration` */
  async swipe(fromX: number, fromY: number, toX: number, toY: number, durationMs = 300): Promise<AdbCommandResult> {
    return this.inputResult([
      'swipe',
      String(Math.round(fromX)), String(Math.round(fromY)),
      String(Math.round(toX)), String(Math.round(toY)),
      String(Math.round(durationMs)),
    ]);
  }

  /** Real text input via `adb shell input text` (%s encodes spaces) */
  async typeText(text: string): Promise<AdbCommandResult> {
    const encoded = text
      .replace(/%/g, '\\%')
      .replace(/ /g, '%s')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/&/g, '\\&')
      .replace(/</g, '\\<')
      .replace(/>/g, '\\>')
      .replace(/;/g, '\\;');
    return this.inputResult(['text', encoded]);
  }

  /** Real hardware/navigation key event via `adb shell input keyevent` */
  async pressKey(key: PhoneKeyCode): Promise<AdbCommandResult> {
    const keyMap: Record<PhoneKeyCode, number> = {
      HOME: 3,
      BACK: 4,
      RECENT_APPS: 187,
      POWER: 26,
      VOLUME_UP: 24,
      VOLUME_DOWN: 25,
      ENTER: 66,
    };
    return this.inputResult(['keyevent', String(keyMap[key] || 3)]);
  }

  /** Real application launch via monkey (validates the package name first) */
  async launchPackage(packageName: string): Promise<AdbCommandResult> {
    if (!isValidPackageName(packageName)) {
      return { success: false, command: '', output: `Invalid package name: "${packageName}"` };
    }
    const full = this.args('shell', 'monkey', '-p', packageName, '1');
    try {
      const output = await this.run(full);
      return { success: true, command: this.display(full), output };
    } catch (err: any) {
      return { success: false, command: this.display(full), output: err.message };
    }
  }

  /** Start an Android activity via `am start` with explicit argv (intents, deep links). */
  async startActivity(amArgs: string[]): Promise<AdbCommandResult> {
    const full = this.args('shell', 'am', 'start', ...amArgs);
    try {
      const output = await this.run(full);
      const failed = /Error|Exception|does not exist/i.test(output);
      return { success: !failed, command: this.display(full), output: output.trim() };
    } catch (err: any) {
      return { success: false, command: this.display(full), output: err.message };
    }
  }

  /**
   * Real screenshot capture via `adb exec-out screencap -p`.
   * Returns a failure result (never a placeholder image) when capture fails.
   */
  async captureScreenshot(): Promise<{ success: boolean; dataUrl?: string; error?: string }> {
    try {
      const { stdout } = await execFileAsync('adb', this.args('exec-out', 'screencap', '-p'), {
        encoding: 'buffer',
        maxBuffer: 25 * 1024 * 1024,
        timeout: 30000,
      });
      const buffer = stdout as unknown as Buffer;
      if (!buffer || buffer.length < 100) {
        return { success: false, error: 'screencap returned an empty image (no device connected?)' };
      }
      return { success: true, dataUrl: `data:image/png;base64,${buffer.toString('base64')}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Real UIAutomator dump. Throws with the real error when the dump fails —
   * callers must not substitute a simulated tree.
   */
  async dumpHierarchy(): Promise<string> {
    await this.shell(['uiautomator', 'dump', '/sdcard/window_dump.xml']);
    const xml = await this.shell(['cat', '/sdcard/window_dump.xml']);
    if (!xml.includes('<hierarchy')) {
      throw new AdbUnavailableError('uiautomator dump did not return a hierarchy document.');
    }
    return xml;
  }

  /** Battery level + charging state from `dumpsys battery`. */
  async getBattery(): Promise<{ level: number; isCharging: boolean }> {
    const output = await this.shell(['dumpsys', 'battery']);
    const levelMatch = output.match(/level:\s*(\d+)/);
    const statusMatch = output.match(/status:\s*(\d+)/);
    return {
      level: levelMatch ? Number(levelMatch[1]) : -1,
      isCharging: statusMatch ? Number(statusMatch[1]) === 2 || Number(statusMatch[1]) === 5 : false,
    };
  }

  /** Foreground app package/activity from `dumpsys activity activities`. */
  async getForegroundApp(): Promise<{ packageName: string; activityName: string }> {
    const output = await this.shell(['dumpsys', 'activity', 'activities']);
    const match = output.match(/topResumedActivity=ActivityRecord\{[^}]*?\s([a-zA-Z0-9_.]+)\/([a-zA-Z0-9_.$]+)/)
      || output.match(/mResumedActivity: ActivityRecord\{[^}]*?\s([a-zA-Z0-9_.]+)\/([a-zA-Z0-9_.$]+)/);
    if (match) {
      return { packageName: match[1], activityName: match[2] };
    }
    return { packageName: 'unknown', activityName: 'unknown' };
  }

  /** Screen size from `wm size`. */
  async getScreenSize(): Promise<{ width: number; height: number }> {
    const output = await this.shell(['wm', 'size']);
    const match = output.match(/(\d+)x(\d+)/);
    if (match) return { width: Number(match[1]), height: Number(match[2]) };
    return { width: 0, height: 0 };
  }
}
