/**
 * OpenBot Phone Edge Node Client 📱⚡
 * Connects directly to the on-device Android server (LocalPhoneServer.kt) running on port 8765.
 * Enables zero-cable, standalone rootless human-like phone automation over Wi-Fi / local network.
 * Falls back seamlessly to ADB if direct HTTP connection is unavailable.
 */

import { AdbController } from './adb-controller.js';

export interface PhoneNodeConfig {
  phoneIp?: string;
  phonePort?: number;
  useAdbFallback?: boolean;
}

export interface PhoneScreenNode {
  text?: string;
  id?: string;
  class?: string;
  bounds?: string;
  children?: PhoneScreenNode[];
}

export class PhoneNodeClient {
  private phoneIp: string;
  private phonePort: number;
  private adb: AdbController;
  private isDirectServerOnline = false;

  constructor(config?: PhoneNodeConfig) {
    this.phoneIp = config?.phoneIp || process.env.PHONE_IP || '127.0.0.1';
    this.phonePort = config?.phonePort || parseInt(process.env.PHONE_PORT || '8765', 10);
    this.adb = new AdbController();
    this.checkDirectConnection();
  }

  private get baseUrl(): string {
    return `http://${this.phoneIp}:${this.phonePort}`;
  }

  /**
   * Check if direct Android HTTP server (LocalPhoneServer.kt) is reachable
   */
  async checkDirectConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(1200) });
      if (res.ok) {
        const data = await res.json();
        this.isDirectServerOnline = !!data.success;
        return this.isDirectServerOnline;
      }
    } catch {
      this.isDirectServerOnline = false;
    }
    return false;
  }

  /**
   * Health status of the phone edge node
   */
  async getHealth(): Promise<{ status: string; mode: 'direct_http' | 'adb_bridge'; phoneIp: string; port: number }> {
    const isDirect = await this.checkDirectConnection();
    if (isDirect) {
      return { status: 'online', mode: 'direct_http', phoneIp: this.phoneIp, port: this.phonePort };
    }
    const adbDevices = await this.adb.listDevices();
    const hasAdbDevice = adbDevices.length > 0;
    return {
      status: hasAdbDevice ? 'online' : 'offline',
      mode: 'adb_bridge',
      phoneIp: this.phoneIp,
      port: this.phonePort,
    };
  }

  /**
   * Dump active UI hierarchy (Accessibility Node Tree)
   */
  async getScreenHierarchy(): Promise<string> {
    if (await this.checkDirectConnection()) {
      try {
        const res = await fetch(`${this.baseUrl}/screen/hierarchy`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) return await res.text();
      } catch {
        // fallback to adb
      }
    }
    return this.adb.dumpHierarchy();
  }

  /**
   * Human-like tap at coordinates (x, y)
   */
  async tap(x: number, y: number): Promise<{ success: boolean; message: string }> {
    if (await this.checkDirectConnection()) {
      try {
        const res = await fetch(`${this.baseUrl}/action/tap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x, y }),
        });
        const data = await res.json();
        return { success: !!data.success, message: `Direct Phone Server tap at (${x}, ${y})` };
      } catch {
        // fallback
      }
    }
    const result = await this.adb.tap(x, y);
    return { success: result.success, message: result.output || 'ADB tap executed' };
  }

  /**
   * Tap element by visible text label (e.g. "Send", "Login", "Search")
   */
  async tapByText(text: string): Promise<{ success: boolean; message: string }> {
    if (await this.checkDirectConnection()) {
      try {
        const res = await fetch(`${this.baseUrl}/action/tap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        return { success: !!data.success, message: `Clicked element with text "${text}"` };
      } catch {
        // fallback
      }
    }
    // Fallback: try dumping hierarchy and computing bounds
    return { success: false, message: 'Tap by text requires active Phone Accessibility Daemon' };
  }

  /**
   * Human-like text typing into active input field
   */
  async typeText(text: string): Promise<{ success: boolean; message: string }> {
    if (await this.checkDirectConnection()) {
      try {
        const res = await fetch(`${this.baseUrl}/action/type`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        return { success: !!data.success, message: `Typed "${text}" via Phone Accessibility Server` };
      } catch {
        // fallback
      }
    }
    const result = await this.adb.typeText(text);
    return { success: result.success, message: result.output || 'Typed via ADB' };
  }

  /**
   * Gesture swipe from (fromX, fromY) to (toX, toY)
   */
  async swipe(fromX: number, fromY: number, toX: number, toY: number, durationMs = 300): Promise<{ success: boolean; message: string }> {
    if (await this.checkDirectConnection()) {
      try {
        const res = await fetch(`${this.baseUrl}/action/swipe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromX, fromY, toX, toY, duration: durationMs }),
        });
        const data = await res.json();
        return { success: !!data.success, message: `Swiped via Phone Server` };
      } catch {
        // fallback
      }
    }
    const result = await this.adb.swipe(fromX, fromY, toX, toY, durationMs);
    return { success: result.success, message: result.output || 'Swiped via ADB' };
  }

  /**
   * Hardware navigation key: HOME, BACK, RECENTS
   */
  async pressKey(key: 'HOME' | 'BACK' | 'RECENTS' | 'POWER'): Promise<{ success: boolean; message: string }> {
    if (await this.checkDirectConnection()) {
      try {
        const res = await fetch(`${this.baseUrl}/action/key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });
        const data = await res.json();
        return { success: !!data.success, message: `Key ${key} executed via Phone Server` };
      } catch {
        // fallback
      }
    }
    const adbKey = key === 'RECENTS' ? 'RECENT_APPS' : key;
    const result = await this.adb.pressKey(adbKey as any);
    return { success: result.success, message: result.output || `Key ${key} executed via ADB` };
  }

  /**
   * Launch application package on phone
   */
  async launchApp(packageName: string): Promise<{ success: boolean; message: string }> {
    if (await this.checkDirectConnection()) {
      try {
        const res = await fetch(`${this.baseUrl}/action/launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageName }),
        });
        const data = await res.json();
        return { success: !!data.success, message: `Launched package ${packageName} via Phone Server` };
      } catch {
        // fallback
      }
    }
    const result = await this.adb.launchPackage(packageName);
    return { success: result.success, message: result.output || `Launched package ${packageName} via ADB` };
  }

  /**
   * Read OTP or 2FA code from active screen or recent SMS/Notification
   */
  async readOtp(): Promise<{ success: boolean; otp?: string; source?: string }> {
    try {
      const hierarchy = await this.getScreenHierarchy();
      // Regex for 4 to 8 digit OTP codes
      const otpMatch = hierarchy.match(/\b\d{4,8}\b/);
      if (otpMatch) {
        return { success: true, otp: otpMatch[0], source: 'screen_hierarchy' };
      }
    } catch {
      // fallback
    }
    return { success: false };
  }

  /**
   * Capture high-res screen frame
   */
  async captureScreen(): Promise<string> {
    const res = await this.adb.captureScreenshot();
    return res.dataUrl || '';
  }
}
