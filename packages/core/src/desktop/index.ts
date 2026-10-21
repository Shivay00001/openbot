/**
 * OpenBot Agentic Desktop Mode 💻
 * "Own Computer" Mode: real OS-level control from Node.js.
 *
 * - Shell execution: real child processes (bash on macOS/Linux, PowerShell
 *   on Windows) with real stdout/stderr/exit codes.
 * - File exploration: real fs reads.
 * - App lifecycle: real process spawn (detached), tracked by PID.
 * - Mouse/keyboard/display: delegated to a UniversalComputerAdapter
 *   (PyAutoGUI bridge by default) — when no desktop bridge is available the
 *   methods return the adapter's honest failure instead of simulating.
 */

import { v4 as uuid } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { UniversalComputerAdapter } from '../computer/types.js';
import { PyAutoGUIAdapter } from '../computer/adapters/pyautogui-adapter.js';

const execAsync = promisify(exec);

export interface DesktopScreenBounds {
  width: number;
  height: number;
  scaleFactor: number;
}

export interface DesktopWindowInfo {
  id: string;
  title: string;
  processName: string;
  bounds: { x: number; y: number; width: number; height: number };
  isFocused: boolean;
  isMinimized: boolean;
}

export interface ShellExecutionResult {
  executionId: string;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface FileItemInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  updatedAt: Date;
  extension?: string;
}

export class AgenticDesktopController {
  private currentCwd: string = process.cwd ? process.cwd() : '/';
  private runningProcesses: Map<string, { id: string; command: string; startedAt: Date }> = new Map();
  private readonly adapter: UniversalComputerAdapter;

  constructor(adapter?: UniversalComputerAdapter) {
    this.adapter = adapter || new PyAutoGUIAdapter();
  }

  /**
   * Real display + window state from the desktop adapter.
   * `activeWindow` is null when no window information is available.
   */
  async getDisplayInfo(): Promise<{ screens: DesktopScreenBounds[]; activeWindow: DesktopWindowInfo | null }> {
    const displays = await this.adapter.getDisplays().catch(() => []);
    const windows = await this.adapter.getWindows().catch(() => []);
    const focused = windows.find((w) => w.isFocused) || windows[0];
    return {
      screens: displays.map((d) => ({
        width: d.bounds.width,
        height: d.bounds.height,
        scaleFactor: d.scaleFactor,
      })),
      activeWindow: focused
        ? {
            id: focused.id,
            title: focused.title,
            processName: focused.processName,
            bounds: focused.bounds,
            isFocused: focused.isFocused,
            isMinimized: focused.isMinimized,
          }
        : null,
    };
  }

  /**
   * Mouse action via the desktop adapter (real input injection when a
   * bridge is available; honest failure otherwise).
   */
  async mouseAction(action: {
    type: 'move' | 'click' | 'double_click' | 'right_click' | 'drag';
    x: number;
    y: number;
    toX?: number;
    toY?: number;
  }): Promise<{ success: boolean; message: string }> {
    let result;
    switch (action.type) {
      case 'move':
        result = await this.adapter.mouseMove(action.x, action.y);
        break;
      case 'click':
        result = await this.adapter.mouseClick('left', 1, { x: action.x, y: action.y });
        break;
      case 'double_click':
        result = await this.adapter.mouseClick('left', 2, { x: action.x, y: action.y });
        break;
      case 'right_click':
        result = await this.adapter.mouseClick('right', 1, { x: action.x, y: action.y });
        break;
      case 'drag':
        result = await this.adapter.mouseDrag(
          { x: action.x, y: action.y },
          { x: action.toX ?? action.x, y: action.toY ?? action.y }
        );
        break;
    }
    return { success: result.success, message: result.message };
  }

  /**
   * Keyboard action via the desktop adapter.
   */
  async keyboardAction(action: {
    type: 'type' | 'shortcut' | 'press';
    text?: string;
    keys?: string[];
  }): Promise<{ success: boolean; message: string }> {
    if (action.type === 'type') {
      const result = await this.adapter.keyboardType(action.text || '');
      return { success: result.success, message: result.message };
    }
    const keys = action.keys || (action.text ? [action.text] : []);
    const result = await this.adapter.keyboardHotkey(keys);
    return { success: result.success, message: result.message };
  }

  /**
   * Execute a real shell command on the host and capture its output.
   * NOTE: this intentionally runs through the host shell — it is the
   * desktop terminal feature and is approval-gated at the tool layer.
   */
  async executeShell(
    command: string,
    options?: { cwd?: string; timeoutMs?: number; env?: Record<string, string> }
  ): Promise<ShellExecutionResult> {
    const startTime = Date.now();
    const executionId = uuid();
    const cwd = options?.cwd || this.currentCwd;
    const isWindows = process.platform === 'win32';

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: options?.timeoutMs || 30000,
        maxBuffer: 10 * 1024 * 1024,
        shell: isWindows ? 'powershell.exe' : '/bin/bash',
        env: { ...process.env, ...options?.env },
      });
      return {
        executionId,
        command,
        cwd,
        stdout: (stdout as string).trim(),
        stderr: (stderr as string).trim(),
        exitCode: 0,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        executionId,
        command,
        cwd,
        stdout: ((err.stdout as string) || '').trim(),
        stderr: ((err.stderr as string) || err.message || '').trim(),
        exitCode: typeof err.code === 'number' ? err.code : 1,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * List the real contents of a directory.
   */
  async listFiles(dirPath: string): Promise<FileItemInfo[]> {
    const resolved = path.resolve(dirPath);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    const items: FileItemInfo[] = [];
    for (const entry of entries) {
      const fullPath = path.join(resolved, entry.name);
      let sizeBytes = 0;
      let updatedAt = new Date(0);
      try {
        const stat = await fs.stat(fullPath);
        sizeBytes = stat.size;
        updatedAt = stat.mtime;
      } catch {
        // Entry vanished or is unreadable — report it with zero size.
      }
      items.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        sizeBytes,
        updatedAt,
        extension: entry.isFile() ? path.extname(entry.name).replace('.', '') || undefined : undefined,
      });
    }
    return items.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
  }

  /**
   * Launch a desktop application as a real detached OS process.
   * Returns the real PID assigned by the OS.
   */
  async launchApplication(appName: string): Promise<{ success: boolean; pid: number; message: string }> {
    try {
      const child = spawn(appName, [], {
        shell: true,
        detached: true,
        stdio: 'ignore',
      });
      // Surface spawn errors (e.g. command not found) instead of assuming success.
      const spawnError = await new Promise<Error | null>((resolve) => {
        child.once('error', (err) => resolve(err));
        setTimeout(() => resolve(null), 250);
      });
      if (spawnError) {
        return { success: false, pid: -1, message: `Failed to launch "${appName}": ${spawnError.message}` };
      }
      const pid = child.pid ?? -1;
      child.unref();
      this.runningProcesses.set(appName, { id: String(pid), command: appName, startedAt: new Date() });
      return { success: pid > 0, pid, message: `Launched "${appName}" (PID ${pid})` };
    } catch (err: any) {
      return { success: false, pid: -1, message: `Failed to launch "${appName}": ${err.message}` };
    }
  }

  getRunningProcesses(): Array<{ id: string; command: string; startedAt: Date }> {
    return Array.from(this.runningProcesses.values());
  }
}
