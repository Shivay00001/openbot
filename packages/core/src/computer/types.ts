/**
 * OpenBot OS & Computer Control Types 💻
 * Supports Self-Operating Computer, Open Interpreter, MCP Computer Server, PyAutoGUI, and RobotJS.
 */

export type MouseButton = 'left' | 'right' | 'middle';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DisplayInfo {
  id: string;
  name: string;
  bounds: ScreenBounds;
  scaleFactor: number;
  isPrimary: boolean;
}

export interface WindowInfo {
  id: string;
  handle?: string | number; // HWND on Windows
  title: string;
  processName: string;
  processId: number;
  bounds: ScreenBounds;
  isFocused: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
}

export interface VisualGroundingElement {
  id: string;
  labelIndex: number; // e.g. [14] in visual grid
  tagName?: string;
  text?: string;
  bounds: ScreenBounds;
  center: ScreenPoint;
  confidence: number;
  role: 'button' | 'input' | 'icon' | 'link' | 'window' | 'menu';
}

export interface ComputerActionOptions {
  smoothMove?: boolean;
  durationMs?: number;
  delayAfterMs?: number;
}

export interface ComputerActionResult {
  success: boolean;
  action: string;
  message: string;
  cursorPosition?: ScreenPoint;
  screenshotBase64?: string;
  durationMs: number;
  error?: string;
}

export interface InterpreterExecutionOptions {
  language: 'bash' | 'powershell' | 'python' | 'node' | 'applescript';
  code: string;
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  sandbox?: boolean;
}

export interface InterpreterExecutionResult {
  executionId: string;
  language: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}

export interface UniversalComputerAdapter {
  initialize(): Promise<void>;
  getDisplays(): Promise<DisplayInfo[]>;
  getWindows(): Promise<WindowInfo[]>;
  focusWindow(windowId: string): Promise<boolean>;
  getCursorPosition(): Promise<ScreenPoint>;
  mouseMove(x: number, y: number, options?: ComputerActionOptions): Promise<ComputerActionResult>;
  mouseClick(button?: MouseButton, clickCount?: number, point?: ScreenPoint): Promise<ComputerActionResult>;
  mouseDrag(from: ScreenPoint, to: ScreenPoint): Promise<ComputerActionResult>;
  mouseScroll(deltaY: number, deltaX?: number): Promise<ComputerActionResult>;
  keyboardType(text: string, delayBetweenKeysMs?: number): Promise<ComputerActionResult>;
  keyboardHotkey(keys: string[]): Promise<ComputerActionResult>;
  captureScreenshot(displayIndex?: number): Promise<string>;
}
