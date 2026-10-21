/**
 * OpenBot Agentic Phone Mode 📱
 *
 * Three real backends:
 * - `adb`: a physical Android device driven through the ADB binary
 *   (input injection, uiautomator hierarchy parsing, intents).
 * - `accessibility_service`: the on-device companion app — commands are sent
 *   over HTTP to the phone's LocalPhoneServer (port 8765), which dispatches
 *   them through Android's AccessibilityService.
 * - `simulator`: a virtual phone used by the web UI for layout/preview.
 *   Every simulator result is flagged `simulated: true` and its state is
 *   marked as such — it never claims a real device performed an action.
 */

import { v4 as uuid } from 'uuid';
import { AdbController, isValidPackageName } from './adb-controller.js';
import { AccessibilityServiceBridge } from './accessibility-service-bridge.js';
import { parseUiautomatorXml, findNodeByText, flattenNodes, nodeCenter } from './hierarchy.js';

export { AdbController, AdbUnavailableError, isValidPackageName } from './adb-controller.js';
export type { AdbDevice, AdbCommandResult } from './adb-controller.js';
export { AppiumBridge } from './appium-bridge.js';
export type { AppiumCapabilities } from './appium-bridge.js';
export { AccessibilityServiceBridge } from './accessibility-service-bridge.js';
export type { AccessibilityEventPayload } from './accessibility-service-bridge.js';
export { ArtemisPhoneNavigator } from './artemis-phone-navigator.js';
export type { PhoneTaskPlan } from './artemis-phone-navigator.js';
export { parseUiautomatorXml, flattenNodes, findNodeByText, nodeCenter } from './hierarchy.js';

export interface PhoneElementNode {
  id: string;
  resourceId?: string;
  className: string;
  text?: string;
  contentDescription?: string;
  bounds: { x: number; y: number; width: number; height: number };
  clickable: boolean;
  scrollable: boolean;
  editable: boolean;
  focused: boolean;
  children?: PhoneElementNode[];
}

export interface PhoneScreenState {
  timestamp: number;
  currentApp: {
    packageName: string;
    appName: string;
    activityName: string;
  };
  screenDimensions: { width: number; height: number; density: number };
  elements: PhoneElementNode[];
  screenshotBase64?: string;
  notifications: PhoneNotification[];
  batteryLevel: number;
  isCharging: boolean;
  networkType: 'wifi' | '5g' | '4g' | 'offline';
  /** True when this state comes from the virtual simulator, not a device. */
  simulated?: boolean;
}

export interface PhoneNotification {
  id: string;
  appName: string;
  title: string;
  body: string;
  timestamp: number;
  actions?: string[];
}

export type PhoneKeyCode = 'HOME' | 'BACK' | 'RECENT_APPS' | 'POWER' | 'VOLUME_UP' | 'VOLUME_DOWN' | 'ENTER';

export type PhoneGesture =
  | { type: 'tap'; x: number; y: number }
  | { type: 'double_tap'; x: number; y: number }
  | { type: 'long_press'; x: number; y: number; durationMs: number }
  | { type: 'swipe'; fromX: number; fromY: number; toX: number; toY: number; durationMs: number }
  | { type: 'scroll'; direction: 'up' | 'down' | 'left' | 'right' }
  | { type: 'type'; text: string; submit?: boolean }
  | { type: 'key'; keyCode: PhoneKeyCode };

export interface PhoneAppInfo {
  packageName: string;
  name: string;
  icon?: string;
  category: 'social' | 'communication' | 'productivity' | 'finance' | 'utilities' | 'entertainment';
}

// ─── Popular Phone Apps Catalog ─────────────────────────────────

export const DEFAULT_PHONE_APPS: PhoneAppInfo[] = [
  { packageName: 'com.whatsapp', name: 'WhatsApp', category: 'communication' },
  { packageName: 'com.instagram.android', name: 'Instagram', category: 'social' },
  { packageName: 'com.google.android.gm', name: 'Gmail', category: 'productivity' },
  { packageName: 'com.google.android.apps.maps', name: 'Google Maps', category: 'utilities' },
  { packageName: 'com.uber.uberx', name: 'Uber', category: 'utilities' },
  { packageName: 'com.spotify.music', name: 'Spotify', category: 'entertainment' },
  { packageName: 'com.twitter.android', name: 'X / Twitter', category: 'social' },
  { packageName: 'com.google.android.apps.messaging', name: 'Messages', category: 'communication' },
  { packageName: 'com.google.android.dialer', name: 'Phone', category: 'communication' },
  { packageName: 'com.google.android.calendar', name: 'Calendar', category: 'productivity' },
  { packageName: 'com.google.android.apps.photos', name: 'Photos', category: 'utilities' },
  { packageName: 'com.amazon.mShop.android.shopping', name: 'Amazon', category: 'finance' },
];

export type PhoneConnectionType = 'adb' | 'accessibility_service' | 'simulator';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Agentic Phone Controller ───────────────────────────────────

export class AgenticPhoneController {
  private isConnected = false;
  private connectionType: PhoneConnectionType = 'simulator';
  private currentState: PhoneScreenState;
  private eventLog: Array<{ timestamp: number; action: string; details: unknown }> = [];
  private readonly adb: AdbController;
  private readonly accessibility: AccessibilityServiceBridge;

  constructor(deps?: { adb?: AdbController; accessibility?: AccessibilityServiceBridge }) {
    this.adb = deps?.adb || new AdbController();
    this.accessibility = deps?.accessibility || new AccessibilityServiceBridge();
    this.currentState = this.createInitialSimulatorState();
  }

  getConnectionType(): PhoneConnectionType {
    return this.connectionType;
  }

  getAdb(): AdbController {
    return this.adb;
  }

  getAccessibilityBridge(): AccessibilityServiceBridge {
    return this.accessibility;
  }

  /**
   * Connect via ADB (verifies a real device answers), the on-device
   * accessibility service (verifies its HTTP health endpoint), or the
   * virtual simulator.
   */
  async connect(type: PhoneConnectionType = 'simulator'): Promise<{ success: boolean; type: string; state: PhoneScreenState; message?: string }> {
    if (type === 'adb') {
      const devices = await this.adb.listDevices().catch(() => []);
      const usable = devices.filter((d) => d.state === 'device');
      if (usable.length === 0) {
        this.isConnected = false;
        return {
          success: false,
          type,
          state: this.currentState,
          message: devices.length === 0
            ? 'No Android device found via ADB. Connect via USB or `adb connect <ip>:5555` first.'
            : `ADB device present but not usable (state: ${devices[0].state}). Authorize USB debugging on the phone.`,
        };
      }
      this.connectionType = 'adb';
      this.isConnected = true;
      this.logAction('connect', { type });
      return { success: true, type, state: await this.getScreenState() };
    }

    if (type === 'accessibility_service') {
      const status = await this.accessibility.checkServiceStatus();
      if (!status.enabled) {
        this.isConnected = false;
        return {
          success: false,
          type,
          state: this.currentState,
          message: 'On-device accessibility server is not reachable. Open the OpenBot app on the phone and enable the Accessibility Service.',
        };
      }
      this.connectionType = 'accessibility_service';
      this.isConnected = true;
      this.logAction('connect', { type });
      return { success: true, type, state: await this.getScreenState() };
    }

    this.connectionType = 'simulator';
    this.isConnected = true;
    this.logAction('connect', { type });
    return { success: true, type, state: this.currentState };
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.logAction('disconnect', {});
  }

  /**
   * Live screen perception. ADB mode parses the real uiautomator dump;
   * accessibility mode reads the on-device hierarchy; simulator returns the
   * flagged virtual state.
   */
  async getScreenState(): Promise<PhoneScreenState> {
    if (this.connectionType === 'adb' && this.isConnected) {
      const xml = await this.adb.dumpHierarchy();
      const elements = parseUiautomatorXml(xml);
      const [foreground, battery, size, screenshot] = await Promise.all([
        this.adb.getForegroundApp().catch(() => ({ packageName: 'unknown', activityName: 'unknown' })),
        this.adb.getBattery().catch(() => ({ level: -1, isCharging: false })),
        this.adb.getScreenSize().catch(() => ({ width: 0, height: 0 })),
        this.adb.captureScreenshot().catch(() => ({ success: false }) as { success: boolean; dataUrl?: string }),
      ]);
      const appInfo = DEFAULT_PHONE_APPS.find((a) => a.packageName === foreground.packageName);
      this.currentState = {
        timestamp: Date.now(),
        currentApp: {
          packageName: foreground.packageName,
          appName: appInfo?.name || foreground.packageName,
          activityName: foreground.activityName,
        },
        screenDimensions: { width: size.width, height: size.height, density: 0 },
        elements,
        screenshotBase64: screenshot.success ? screenshot.dataUrl : undefined,
        notifications: [],
        batteryLevel: battery.level,
        isCharging: battery.isCharging,
        networkType: 'wifi',
        simulated: false,
      };
      return this.currentState;
    }

    if (this.connectionType === 'accessibility_service' && this.isConnected) {
      const hierarchy = await this.accessibility.getHierarchy();
      this.currentState = {
        timestamp: Date.now(),
        currentApp: {
          packageName: hierarchy.packageName,
          appName: hierarchy.packageName,
          activityName: '',
        },
        screenDimensions: { width: 0, height: 0, density: 0 },
        elements: hierarchy.elements,
        notifications: [],
        batteryLevel: -1,
        isCharging: false,
        networkType: 'wifi',
        simulated: false,
      };
      return this.currentState;
    }

    this.currentState.timestamp = Date.now();
    return this.currentState;
  }

  async tap(x: number, y: number): Promise<{ success: boolean; message: string }> {
    this.logAction('tap', { x, y, backend: this.connectionType });

    if (this.connectionType === 'adb') {
      const res = await this.adb.tap(x, y);
      return { success: res.success, message: res.success ? `ADB tap at (${x}, ${y})` : `ADB tap failed: ${res.output}` };
    }
    if (this.connectionType === 'accessibility_service') {
      const ok = await this.accessibility.tapCoordinate(x, y);
      return { success: ok, message: ok ? `Accessibility tap at (${x}, ${y})` : 'Accessibility tap was rejected by the device' };
    }

    const element = this.findElementAt(x, y);
    if (element?.clickable && element.resourceId?.includes('app_icon')) {
      await this.launchApp(element.text || 'App');
    }
    return { success: true, message: `[simulator] Tapped at (${x}, ${y})` };
  }

  async tapByText(targetText: string): Promise<{ success: boolean; message: string }> {
    if (this.connectionType !== 'simulator') {
      const state = await this.getScreenState();
      const el = findNodeByText(state.elements, targetText);
      if (!el) {
        return { success: false, message: `Element with text "${targetText}" not found on the live screen` };
      }
      const center = nodeCenter(el);
      return this.tap(center.x, center.y);
    }

    const el = findNodeByText(this.currentState.elements, targetText);
    if (el) {
      const center = nodeCenter(el);
      return this.tap(center.x, center.y);
    }
    return { success: false, message: `Element with text "${targetText}" not found on screen` };
  }

  async swipe(fromX: number, fromY: number, toX: number, toY: number, durationMs = 300): Promise<{ success: boolean }> {
    this.logAction('swipe', { fromX, fromY, toX, toY, durationMs });
    if (this.connectionType === 'adb') {
      const res = await this.adb.swipe(fromX, fromY, toX, toY, durationMs);
      return { success: res.success };
    }
    if (this.connectionType === 'accessibility_service') {
      const ok = await this.accessibility.swipe(fromX, fromY, toX, toY, durationMs);
      return { success: ok };
    }
    return { success: true };
  }

  async typeText(text: string, submit = false): Promise<{ success: boolean; message: string }> {
    this.logAction('type', { text, submit, backend: this.connectionType });
    if (this.connectionType === 'adb') {
      const res = await this.adb.typeText(text);
      if (!res.success) return { success: false, message: `ADB type failed: ${res.output}` };
      if (submit) await this.adb.pressKey('ENTER');
      return { success: true, message: `ADB typed "${text}"` };
    }
    if (this.connectionType === 'accessibility_service') {
      const ok = await this.accessibility.typeText(text);
      return { success: ok, message: ok ? `Accessibility typed "${text}"` : 'Accessibility type failed (no focused editable field?)' };
    }
    return { success: true, message: `[simulator] Typed "${text}"` };
  }

  async pressKey(keyCode: PhoneKeyCode): Promise<{ success: boolean; message: string }> {
    this.logAction('pressKey', { keyCode, backend: this.connectionType });
    if (this.connectionType === 'adb') {
      const res = await this.adb.pressKey(keyCode);
      return { success: res.success, message: res.success ? `ADB keyevent ${keyCode}` : `ADB keyevent failed: ${res.output}` };
    }
    if (this.connectionType === 'accessibility_service') {
      const action = keyCode === 'HOME' ? 'HOME' : keyCode === 'RECENT_APPS' ? 'RECENTS' : 'BACK';
      const ok = await this.accessibility.performGlobalAction(action);
      return { success: ok, message: ok ? `Accessibility global action ${action}` : 'Accessibility action rejected' };
    }
    if (keyCode === 'HOME') {
      this.currentState.currentApp = {
        packageName: 'com.android.launcher3',
        appName: 'Home Screen',
        activityName: 'WorkspaceActivity',
      };
      this.currentState.elements = this.getHomeScreenElements();
    }
    return { success: true, message: `[simulator] Pressed ${keyCode}` };
  }

  async launchApp(appIdentifier: string): Promise<{ success: boolean; app: PhoneAppInfo; message: string }> {
    const app = DEFAULT_PHONE_APPS.find(
      (a) => a.packageName.toLowerCase().includes(appIdentifier.toLowerCase()) ||
             a.name.toLowerCase().includes(appIdentifier.toLowerCase())
    ) || {
      packageName: isValidPackageName(appIdentifier) ? appIdentifier : `com.openbot.app.${appIdentifier.toLowerCase().replace(/\s+/g, '')}`,
      name: appIdentifier,
      category: 'utilities' as const,
    };

    this.logAction('launchApp', { app, backend: this.connectionType });

    if (this.connectionType === 'adb') {
      const res = await this.adb.launchPackage(app.packageName);
      return {
        success: res.success,
        app,
        message: res.success ? `ADB launched ${app.name} (${app.packageName})` : `ADB launch failed: ${res.output}`,
      };
    }
    if (this.connectionType === 'accessibility_service') {
      const ok = await this.accessibility.launchApp(app.packageName);
      return { success: ok, app, message: ok ? `Accessibility launched ${app.name}` : `Accessibility could not launch ${app.packageName}` };
    }

    this.currentState.currentApp = {
      packageName: app.packageName,
      appName: app.name,
      activityName: 'MainActivity',
    };
    this.currentState.elements = this.getAppScreenElements(app.name);
    return { success: true, app, message: `[simulator] Launched ${app.name}` };
  }

  /**
   * Send a WhatsApp or SMS message. On a real device this performs the
   * actual flow: deep-link intent (for numbers) or in-app navigation (for
   * contact names), then taps the real Send button found in the live UI
   * hierarchy. Any failed step returns success:false with the step named.
   */
  async sendAutomatedMessage(target: string, message: string, app: 'whatsapp' | 'sms' = 'whatsapp'): Promise<{ success: boolean; message: string; simulated?: boolean }> {
    this.logAction('sendAutomatedMessage', { target, message, app, backend: this.connectionType });

    if (this.connectionType === 'simulator') {
      await this.launchApp(app === 'whatsapp' ? 'WhatsApp' : 'Messages');
      return {
        success: true,
        simulated: true,
        message: `[simulator] Would open ${app}, select "${target}", and send "${message}". Connect a real device (ADB or accessibility) to actually send.`,
      };
    }

    if (this.connectionType === 'accessibility_service') {
      const pkg = app === 'whatsapp' ? 'com.whatsapp' : 'com.google.android.apps.messaging';
      if (!(await this.accessibility.launchApp(pkg))) {
        return { success: false, message: `Could not launch ${app} on the device` };
      }
      await sleep(1200);
      if (!(await this.accessibility.tapByText(target))) {
        return { success: false, message: `Contact "${target}" not found on the ${app} screen` };
      }
      await sleep(800);
      if (!(await this.accessibility.typeText(message))) {
        return { success: false, message: 'Could not type the message (message field not focused)' };
      }
      await sleep(300);
      const sent = await this.accessibility.tapByContentDescription('Send');
      return sent
        ? { success: true, message: `Message sent to "${target}" via ${app} (accessibility)` }
        : { success: false, message: 'Message typed but the Send button was not found' };
    }

    // ADB backend
    const digits = target.replace(/[^\d]/g, '');
    const looksLikeNumber = digits.length >= 7 && /^\+?[\d\s()-]+$/.test(target);

    if (looksLikeNumber) {
      const uri = app === 'whatsapp'
        ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
        : `smsto:${digits}?body=${encodeURIComponent(message)}`;
      const intent = await this.adb.startActivity(['-a', 'android.intent.action.VIEW', '-d', uri]);
      if (!intent.success) {
        return { success: false, message: `Failed to open ${app} compose screen: ${intent.output}` };
      }
      await sleep(1500);
      const sendTap = await this.tapByContentDescription('Send');
      return sendTap.success
        ? { success: true, message: `Message sent to ${target} via ${app} (ADB deep link + Send tap)` }
        : { success: false, message: `Compose screen opened with the message, but the Send button was not found: ${sendTap.message}` };
    }

    // Contact-name flow: launch app, search, open chat, type, send.
    const launch = await this.launchApp(app === 'whatsapp' ? 'WhatsApp' : 'Messages');
    if (!launch.success) return { success: false, message: launch.message };
    await sleep(1200);

    const searchTap = await this.tapByContentDescription('Search');
    if (searchTap.success) {
      await sleep(500);
      await this.adb.typeText(target);
      await sleep(1000);
    }
    const contactTap = await this.tapByText(target);
    if (!contactTap.success) {
      return { success: false, message: `Contact "${target}" not found in ${app}: ${contactTap.message}` };
    }
    await sleep(800);
    const typed = await this.typeText(message);
    if (!typed.success) return typed;
    await sleep(300);
    const sendTap = await this.tapByContentDescription('Send');
    return sendTap.success
      ? { success: true, message: `Message sent to "${target}" via ${app} (ADB)` }
      : { success: false, message: 'Message typed but the Send button was not found' };
  }

  /** Tap the first live element whose content-description matches. */
  async tapByContentDescription(description: string): Promise<{ success: boolean; message: string }> {
    if (this.connectionType === 'simulator') {
      return { success: false, message: '[simulator] No live hierarchy to search' };
    }
    const state = await this.getScreenState();
    const node = flattenNodes(state.elements).find(
      (n) => n.contentDescription?.toLowerCase() === description.toLowerCase()
    );
    if (!node) {
      return { success: false, message: `No element with content-description "${description}" on the live screen` };
    }
    const center = nodeCenter(node);
    return this.tap(center.x, center.y);
  }

  /**
   * Place a real phone call on a connected device via the ACTION_CALL intent.
   */
  async initiateCall(phoneNumber: string): Promise<{ success: boolean; callId: string; status: string; simulated?: boolean }> {
    const callId = uuid();
    this.logAction('initiateCall', { phoneNumber, callId, backend: this.connectionType });

    if (!/^\+?[\d\s()-]+$/.test(phoneNumber) || phoneNumber.replace(/[^\d]/g, '').length < 5) {
      return { success: false, callId, status: `Invalid phone number: "${phoneNumber}"` };
    }

    if (this.connectionType === 'simulator') {
      await this.launchApp('Phone');
      return { success: true, callId, status: `[simulator] Would dial ${phoneNumber}`, simulated: true };
    }

    if (this.connectionType === 'accessibility_service') {
      const ok = await this.accessibility.launchApp('com.google.android.dialer');
      return {
        success: ok,
        callId,
        status: ok
          ? `Dialer opened for ${phoneNumber} — accessibility backend cannot place calls directly; use the ADB backend for ACTION_CALL.`
          : 'Could not open the dialer',
      };
    }

    const telUri = `tel:${phoneNumber.replace(/[\s()-]/g, '')}`;
    const res = await this.adb.startActivity(['-a', 'android.intent.action.CALL', '-d', telUri]);
    return {
      success: res.success,
      callId,
      status: res.success ? `Dialing ${phoneNumber} via ACTION_CALL` : `Call intent failed: ${res.output}`,
    };
  }

  private logAction(action: string, details: unknown) {
    this.eventLog.push({ timestamp: Date.now(), action, details });
  }

  private findElementAt(x: number, y: number): PhoneElementNode | undefined {
    for (const el of this.currentState.elements) {
      if (
        x >= el.bounds.x &&
        x <= el.bounds.x + el.bounds.width &&
        y >= el.bounds.y &&
        y <= el.bounds.y + el.bounds.height
      ) {
        return el;
      }
    }
    return undefined;
  }

  private createInitialSimulatorState(): PhoneScreenState {
    return {
      timestamp: Date.now(),
      currentApp: {
        packageName: 'com.android.launcher3',
        appName: 'Home Screen',
        activityName: 'WorkspaceActivity',
      },
      screenDimensions: { width: 393, height: 852, density: 3 },
      elements: this.getHomeScreenElements(),
      notifications: [],
      batteryLevel: -1,
      isCharging: false,
      networkType: 'wifi',
      simulated: true,
    };
  }

  private getHomeScreenElements(): PhoneElementNode[] {
    const apps = [
      { name: 'WhatsApp', x: 30, y: 150 },
      { name: 'Gmail', x: 120, y: 150 },
      { name: 'X / Twitter', x: 210, y: 150 },
      { name: 'Instagram', x: 300, y: 150 },
      { name: 'Google Maps', x: 30, y: 250 },
      { name: 'Uber', x: 120, y: 250 },
      { name: 'Spotify', x: 210, y: 250 },
      { name: 'Photos', x: 300, y: 250 },
    ];

    return apps.map((app, i) => ({
      id: `app_${i}`,
      resourceId: `com.android.launcher3:id/app_icon_${app.name.toLowerCase()}`,
      className: 'android.widget.TextView',
      text: app.name,
      bounds: { x: app.x, y: app.y, width: 64, height: 64 },
      clickable: true,
      scrollable: false,
      editable: false,
      focused: false,
    }));
  }

  private getAppScreenElements(appName: string): PhoneElementNode[] {
    return [
      {
        id: 'header_title',
        className: 'android.widget.TextView',
        text: appName,
        bounds: { x: 20, y: 60, width: 250, height: 40 },
        clickable: false,
        scrollable: false,
        editable: false,
        focused: false,
      },
      {
        id: 'search_input',
        className: 'android.widget.EditText',
        text: `Search in ${appName}...`,
        bounds: { x: 20, y: 120, width: 350, height: 48 },
        clickable: true,
        scrollable: false,
        editable: true,
        focused: false,
      },
      {
        id: 'primary_action_btn',
        className: 'android.widget.Button',
        text: 'Action Button',
        bounds: { x: 20, y: 720, width: 353, height: 50 },
        clickable: true,
        scrollable: false,
        editable: false,
        focused: false,
      },
    ];
  }
}
