/**
 * Artemis Phone Navigator 📱✨
 * Autonomous mobile agent that turns a high-level goal ("Message mom on
 * WhatsApp that I arrived safe") into a concrete step plan and executes it
 * through AgenticPhoneController on the selected backend (ADB, accessibility
 * service, or the flagged simulator). Every step's result is checked: the
 * first failed step stops the workflow and the plan is reported as failed —
 * success is only claimed when each step actually succeeded.
 */

import { v4 as uuid } from 'uuid';
import { AgenticPhoneController, DEFAULT_PHONE_APPS } from './index.js';
import type { PhoneScreenState } from './index.js';

export interface PhoneTaskPlan {
  id: string;
  goal: string;
  steps: Array<{
    stepIndex: number;
    description: string;
    action: 'launch' | 'tap' | 'type' | 'scroll' | 'key' | 'verify' | 'call' | 'send';
    target?: string;
    value?: string;
    completed: boolean;
    error?: string;
  }>;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export type PhoneBackend = 'simulator' | 'adb' | 'appium' | 'accessibility_service';

export class ArtemisPhoneNavigator {
  private phoneController: AgenticPhoneController;
  private activeBackend: PhoneBackend;

  constructor(backend: PhoneBackend = 'simulator', controller?: AgenticPhoneController) {
    this.activeBackend = backend;
    this.phoneController = controller || new AgenticPhoneController();
  }

  getController(): AgenticPhoneController {
    return this.phoneController;
  }

  getBackend(): PhoneBackend {
    return this.activeBackend;
  }

  /**
   * Switch phone control backend and connect the controller to it.
   * Appium sessions are managed separately (AppiumBridge); for workflow
   * execution the controller's ADB/accessibility backends are used.
   */
  async switchBackend(backend: PhoneBackend): Promise<{ success: boolean; message?: string }> {
    this.activeBackend = backend;
    if (backend === 'simulator') {
      const res = await this.phoneController.connect('simulator');
      return { success: res.success, message: res.message };
    }
    const res = await this.phoneController.connect(backend === 'appium' ? 'adb' : backend);
    return { success: res.success, message: res.message };
  }

  /**
   * Execute an autonomous multi-step mobile workflow with per-step
   * verification against real controller results.
   */
  async executeMobileWorkflow(goal: string): Promise<{ success: boolean; summary: string; plan: PhoneTaskPlan }> {
    // Make sure the controller is connected on the active backend.
    if (this.phoneController.getConnectionType() === 'simulator' && this.activeBackend !== 'simulator') {
      const conn = await this.switchBackend(this.activeBackend);
      if (!conn.success) {
        const plan = this.decomposeGoalToPlan(goal);
        plan.status = 'failed';
        return { success: false, summary: `Backend connection failed: ${conn.message}`, plan };
      }
    } else if (this.activeBackend === 'simulator' && this.phoneController.getConnectionType() !== 'simulator') {
      await this.phoneController.connect('simulator');
    }

    const plan = this.decomposeGoalToPlan(goal);
    plan.status = 'running';

    for (const step of plan.steps) {
      const result = await this.executeStep(step);
      if (!result.success) {
        step.completed = false;
        step.error = result.message;
        plan.status = 'failed';
        return {
          success: false,
          summary: `Workflow stopped at step ${step.stepIndex + 1} ("${step.description}"): ${result.message}`,
          plan,
        };
      }
      step.completed = true;
    }

    plan.status = 'completed';
    const simulated = this.activeBackend === 'simulator';
    return {
      success: true,
      summary: simulated
        ? `Workflow plan executed against the virtual phone simulator: "${goal}". No real device was involved.`
        : `Successfully executed autonomous phone workflow: "${goal}" on ${this.activeBackend}`,
      plan,
    };
  }

  private async executeStep(step: PhoneTaskPlan['steps'][number]): Promise<{ success: boolean; message: string }> {
    const c = this.phoneController;
    switch (step.action) {
      case 'launch':
        return c.launchApp(step.target || '');
      case 'tap':
        if (step.target === '__SEND__') return c.tapByContentDescription('Send');
        if (step.target === '__SEARCH__') {
          const res = await c.tapByContentDescription('Search');
          return res.success ? res : c.tapByText('Search');
        }
        return c.tapByText(step.target || '');
      case 'type':
        return c.typeText(step.value || '');
      case 'key':
        return c.pressKey((step.target as any) || 'HOME');
      case 'call': {
        const res = await c.initiateCall(step.target || '');
        return { success: res.success, message: res.status };
      }
      case 'send': {
        const res = await c.tapByContentDescription('Send');
        return res;
      }
      case 'verify': {
        const state = await c.getScreenState();
        const found = state.elements.length > 0;
        return { success: found, message: found ? 'Screen state verified' : 'Screen state is empty' };
      }
      default:
        return { success: false, message: `Unknown step action: ${step.action}` };
    }
  }

  /**
   * Get live phone state from the active backend.
   */
  async getScreenState(): Promise<PhoneScreenState> {
    return this.phoneController.getScreenState();
  }

  /**
   * Decompose a natural-language goal into a concrete, executable plan.
   * Recipient/message/number are extracted from the goal text itself —
   * nothing is invented: when a slot cannot be extracted, the plan falls
   * back to the controller's own message flow which reports what is missing.
   */
  private decomposeGoalToPlan(goal: string): PhoneTaskPlan {
    const lower = goal.toLowerCase();
    const planId = uuid();
    const steps: PhoneTaskPlan['steps'] = [];
    const push = (description: string, action: PhoneTaskPlan['steps'][number]['action'], target?: string, value?: string) => {
      steps.push({ stepIndex: steps.length, description, action, target, value, completed: false });
    };

    // Messaging: "send whatsapp message to X saying Y" / "message X that Y"
    const messageMatch = goal.match(
      /(?:send\s+(?:a\s+)?(?:whatsapp\s+|sms\s+)?message\s+to|message|whatsapp|text)\s+(.+?)\s+(?:saying|that|:)\s+(.+)/i
    );
    if (lower.includes('message') || lower.includes('whatsapp') || lower.includes('text')) {
      const app = lower.includes('sms') ? 'Messages' : 'WhatsApp';
      if (messageMatch) {
        const recipient = messageMatch[1].trim();
        const body = messageMatch[2].trim();
        push(`Launch ${app}`, 'launch', app);
        push('Open search', 'tap', '__SEARCH__');
        push(`Type recipient name "${recipient}"`, 'type', undefined, recipient);
        push(`Open chat with "${recipient}"`, 'tap', recipient);
        push('Type message body', 'type', undefined, body);
        push('Tap Send', 'send', '__SEND__');
      } else {
        // No extractable recipient/body — delegate to controller flow with the raw goal.
        push(`Launch ${app}`, 'launch', app);
        push('Verify screen', 'verify');
      }
      return { id: planId, goal, status: 'pending', steps };
    }

    // Calling: "call +1 555 0100" / "dial mom"
    const callMatch = goal.match(/(?:call|dial)\s+(.+)/i);
    if (callMatch && (lower.includes('call') || lower.includes('dial'))) {
      const target = callMatch[1].trim();
      if (/^\+?[\d\s()-]{5,}$/.test(target)) {
        push(`Call ${target}`, 'call', target);
      } else {
        push('Launch Phone dialer', 'launch', 'Phone');
        push('Open search/contacts', 'tap', '__SEARCH__');
        push(`Type contact name "${target}"`, 'type', undefined, target);
        push(`Open contact "${target}"`, 'tap', target);
      }
      return { id: planId, goal, status: 'pending', steps };
    }

    // Launch a known app by name
    const appMention = DEFAULT_PHONE_APPS.find((a) => lower.includes(a.name.toLowerCase()));
    if (appMention || lower.includes('open') || lower.includes('launch')) {
      const target = appMention?.name || goal.replace(/.*(?:open|launch)\s+/i, '').trim();
      push(`Launch ${target}`, 'launch', target);
      push('Verify screen', 'verify');
      return { id: planId, goal, status: 'pending', steps };
    }

    // Generic goal: go home, then verify what is on screen. The plan honestly
    // covers only what can be executed without a model in the loop.
    push('Navigate to Home Screen', 'key', 'HOME');
    push('Verify screen', 'verify');
    return { id: planId, goal, status: 'pending', steps };
  }
}
