/**
 * Android Accessibility Service Bridge 📲♿
 * HTTP client for the on-device companion server (LocalPhoneServer.kt,
 * port 8765) that runs inside the OpenBot Android app. Every method performs
 * a real request to the phone; when the server is unreachable the bridge
 * reports the service as disabled / actions as failed — never success.
 *
 * Protocol (from LocalPhoneServer.kt):
 *   GET  /health            → { success, serviceActive, version }
 *   GET  /screen/hierarchy  → { packageName, elements: [...] }
 *   POST /action/tap        → { text } | { viewId } | { x, y }
 *   POST /action/type       → { text }
 *   POST /action/swipe      → { fromX, fromY, toX, toY, duration }
 *   POST /action/key        → { key: BACK | HOME | RECENTS }
 *   POST /action/launch     → { packageName }
 */

import type { PhoneElementNode } from './index.js';
import { zeroCloudGuard } from '../security/zero-cloud.js';
import { proxiedFetch } from '../net/http.js';

export interface AccessibilityEventPayload {
  eventType:
    | 'TYPE_VIEW_CLICKED'
    | 'TYPE_VIEW_FOCUSED'
    | 'TYPE_VIEW_TEXT_CHANGED'
    | 'TYPE_WINDOW_STATE_CHANGED'
    | 'TYPE_NOTIFICATION_STATE_CHANGED';
  packageName: string;
  className: string;
  text?: string;
  contentDescription?: string;
  timestamp: number;
}

interface KotlinHierarchyElement {
  text?: string;
  contentDescription?: string;
  viewId?: string;
  className?: string;
  isClickable?: boolean;
  isEditable?: boolean;
  bounds?: { left: number; top: number; right: number; bottom: number };
}

export class AccessibilityServiceBridge {
  private readonly baseUrl: string;
  private eventListeners: Array<(event: AccessibilityEventPayload) => void> = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastPackageName = '';

  constructor(baseUrl = 'http://127.0.0.1:8765') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(method: string, route: string, body?: unknown): Promise<T | null> {
    try {
      zeroCloudGuard.assertAllowed(this.baseUrl);
      const response = await proxiedFetch(`${this.baseUrl}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }

  /**
   * Check whether the on-device server answers and the Accessibility
   * Service is enabled on the phone.
   */
  async checkServiceStatus(): Promise<{ enabled: boolean; permissionGranted: boolean }> {
    const health = await this.request<{ success: boolean; serviceActive: boolean }>('GET', '/health');
    const enabled = Boolean(health?.success && health?.serviceActive);
    return { enabled, permissionGranted: enabled };
  }

  /**
   * Start event delivery: polls the live hierarchy and emits
   * TYPE_WINDOW_STATE_CHANGED whenever the foreground package changes.
   */
  async activateService(pollIntervalMs = 1500): Promise<void> {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      const hierarchy = await this.getHierarchy().catch(() => null);
      if (!hierarchy) return;
      if (hierarchy.packageName && hierarchy.packageName !== this.lastPackageName) {
        this.lastPackageName = hierarchy.packageName;
        const event: AccessibilityEventPayload = {
          eventType: 'TYPE_WINDOW_STATE_CHANGED',
          packageName: hierarchy.packageName,
          className: '',
          timestamp: Date.now(),
        };
        for (const listener of this.eventListeners) listener(event);
      }
    }, pollIntervalMs);
    if (typeof this.pollTimer.unref === 'function') this.pollTimer.unref();
  }

  deactivateService(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  onEvent(listener: (event: AccessibilityEventPayload) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  /** Read the live hierarchy from the device, converted to PhoneElementNode[]. */
  async getHierarchy(): Promise<{ packageName: string; elements: PhoneElementNode[] }> {
    const data = await this.request<{ packageName?: string; elements?: KotlinHierarchyElement[] }>(
      'GET',
      '/screen/hierarchy'
    );
    if (!data) {
      throw new Error(
        `Accessibility phone server unreachable at ${this.baseUrl}. Is the OpenBot app running with the Accessibility Service enabled?`
      );
    }
    const elements: PhoneElementNode[] = (data.elements || []).map((el, i) => ({
      id: `acc_${i}`,
      resourceId: el.viewId || undefined,
      className: el.className || '',
      text: el.text || undefined,
      contentDescription: el.contentDescription || undefined,
      bounds: {
        x: el.bounds?.left || 0,
        y: el.bounds?.top || 0,
        width: Math.max(0, (el.bounds?.right || 0) - (el.bounds?.left || 0)),
        height: Math.max(0, (el.bounds?.bottom || 0) - (el.bounds?.top || 0)),
      },
      clickable: Boolean(el.isClickable),
      scrollable: false,
      editable: Boolean(el.isEditable),
      focused: false,
    }));
    return { packageName: data.packageName || '', elements };
  }

  async performGlobalAction(action: 'BACK' | 'HOME' | 'RECENTS' | 'NOTIFICATIONS' | 'QUICK_SETTINGS'): Promise<boolean> {
    if (action === 'NOTIFICATIONS' || action === 'QUICK_SETTINGS') {
      // The on-device server exposes BACK/HOME/RECENTS only.
      return false;
    }
    const res = await this.request<{ success: boolean }>('POST', '/action/key', { key: action });
    return Boolean(res?.success);
  }

  async tapCoordinate(x: number, y: number): Promise<boolean> {
    const res = await this.request<{ success: boolean }>('POST', '/action/tap', { x, y });
    return Boolean(res?.success);
  }

  async tapByText(text: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>('POST', '/action/tap', { text });
    return Boolean(res?.success);
  }

  async tapByContentDescription(description: string): Promise<boolean> {
    // The server matches by visible text or viewId; content descriptions are
    // resolved against the live hierarchy first.
    const hierarchy = await this.getHierarchy().catch(() => null);
    const node = hierarchy?.elements.find(
      (el) => el.contentDescription?.toLowerCase() === description.toLowerCase()
    );
    if (!node) return false;
    return this.tapCoordinate(
      Math.round(node.bounds.x + node.bounds.width / 2),
      Math.round(node.bounds.y + node.bounds.height / 2)
    );
  }

  async performNodeClick(nodeId: string): Promise<boolean> {
    const hierarchy = await this.getHierarchy().catch(() => null);
    const node = hierarchy?.elements.find((el) => el.id === nodeId);
    if (!node) return false;
    return this.tapCoordinate(
      Math.round(node.bounds.x + node.bounds.width / 2),
      Math.round(node.bounds.y + node.bounds.height / 2)
    );
  }

  async setNodeText(nodeId: string, text: string): Promise<boolean> {
    const clicked = await this.performNodeClick(nodeId);
    if (!clicked) return false;
    return this.typeText(text);
  }

  async typeText(text: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>('POST', '/action/type', { text });
    return Boolean(res?.success);
  }

  async swipe(fromX: number, fromY: number, toX: number, toY: number, durationMs = 300): Promise<boolean> {
    const res = await this.request<{ success: boolean }>('POST', '/action/swipe', {
      fromX, fromY, toX, toY, duration: durationMs,
    });
    return Boolean(res?.success);
  }

  async launchApp(packageName: string): Promise<boolean> {
    const res = await this.request<{ success: boolean }>('POST', '/action/launch', { packageName });
    return Boolean(res?.success);
  }
}
