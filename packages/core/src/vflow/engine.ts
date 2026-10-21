/**
 * vFlow Workflow Execution Engine ⚡🎙️
 * Executes voice action graphs and duplex voice interaction cycles.
 */

import { v4 as uuid } from 'uuid';
import type {
  vFlowWorkflow,
  vFlowExecutionSession,
  vFlowExecutionStep,
  vFlowCommand,
  vFlowIntent,
} from './types.js';
import { vFlowCommandParser } from './parser.js';
import { AgenticPhoneController } from '../phone/index.js';
import { BrowserAutomationEngine } from '../browser/engine.js';
import { OpenInterpreterEngine } from '../computer/open-interpreter.js';

export class vFlowEngine {
  private parser: vFlowCommandParser;
  private phoneController: AgenticPhoneController;
  private browserEngine: BrowserAutomationEngine;
  private interpreter: OpenInterpreterEngine;
  private workflows: Map<string, vFlowWorkflow> = new Map();

  constructor() {
    this.parser = new vFlowCommandParser();
    this.phoneController = new AgenticPhoneController();
    this.browserEngine = new BrowserAutomationEngine();
    this.interpreter = new OpenInterpreterEngine();
  }

  /**
   * Register custom or community vFlow workflow
   */
  registerWorkflow(workflow: vFlowWorkflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * List all available vFlow workflows
   */
  getWorkflows(): vFlowWorkflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Main entrypoint: process spoken voice utterance end-to-end
   */
  async processVoiceCommand(rawUtterance: string): Promise<vFlowExecutionSession> {
    const start = Date.now();
    const command = this.parser.parseUtterance(rawUtterance);
    const intent = this.parser.classifyIntent(command);

    const session: vFlowExecutionSession = {
      sessionId: uuid(),
      workflowId: `flow_${intent.intentName}`,
      command,
      intent,
      status: 'executing',
      steps: [],
      variables: { ...intent.slots },
      durationMs: 0,
    };

    // Execute corresponding action based on intent
    try {
      if (intent.intentName === 'phone_send_message') {
        const stepStart = Date.now();
        const res = await this.phoneController.sendAutomatedMessage(
          intent.slots.recipient,
          intent.slots.message,
          (intent.slots.app as any) || 'whatsapp'
        );
        session.steps.push({
          nodeId: 'step_phone_msg',
          nodeType: 'action_phone',
          status: res.success ? 'completed' : 'failed',
          input: intent.slots,
          output: res,
          durationMs: Date.now() - stepStart,
        });
        if (!res.success) {
          session.status = 'failed';
          session.spokenFeedback = `Could not send the message to ${intent.slots.recipient}: ${res.message}`;
          session.durationMs = Date.now() - start;
          return session;
        }
        session.spokenFeedback = `Message successfully sent to ${intent.slots.recipient} via ${intent.slots.app || 'WhatsApp'}${res.simulated ? ' (simulated phone — no real device was used)' : ''}.`;
      } else if (intent.intentName === 'phone_make_call') {
        const stepStart = Date.now();
        const res = await this.phoneController.initiateCall(intent.slots.target);
        session.steps.push({
          nodeId: 'step_phone_call',
          nodeType: 'action_phone',
          status: res.success ? 'completed' : 'failed',
          input: intent.slots,
          output: res,
          durationMs: Date.now() - stepStart,
        });
        if (!res.success) {
          session.status = 'failed';
          session.spokenFeedback = `Could not start the call to ${intent.slots.target}: ${res.status}`;
          session.durationMs = Date.now() - start;
          return session;
        }
        session.spokenFeedback = `Initiated automated call to ${intent.slots.target} for ${intent.slots.purpose}${res.simulated ? ' (simulated phone — no real device was used)' : ''}.`;
      } else if (intent.intentName === 'browser_web_search') {
        const stepStart = Date.now();
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(intent.slots.query)}`;
        const res = await this.browserEngine.navigate(searchUrl);
        session.steps.push({
          nodeId: 'step_browser_search',
          nodeType: 'action_browser',
          status: res.success ? 'completed' : 'failed',
          input: { query: intent.slots.query, url: searchUrl },
          output: res,
          durationMs: Date.now() - stepStart,
        });
        if (!res.success) {
          session.status = 'failed';
          session.spokenFeedback = `Browser search failed: ${res.error || 'navigation failed'}`;
          session.durationMs = Date.now() - start;
          return session;
        }
        session.spokenFeedback = `Searched for ${intent.slots.query} in browser workspace.`;
      } else if (intent.intentName === 'desktop_execute_command') {
        const stepStart = Date.now();
        const res = await this.interpreter.execute({
          language: 'bash',
          code: intent.slots.command,
        });
        session.steps.push({
          nodeId: 'step_terminal_cmd',
          nodeType: 'action_terminal',
          status: res.exitCode === 0 ? 'completed' : 'failed',
          input: { command: intent.slots.command },
          output: res,
          durationMs: Date.now() - stepStart,
        });
        session.spokenFeedback = res.exitCode === 0
          ? `Command completed successfully.`
          : `Command finished with an error.`;
      } else {
        session.status = 'failed';
        session.spokenFeedback = `I heard: "${command.transcript}", but no executable action is wired for intent "${intent.intentName}" yet.`;
        session.durationMs = Date.now() - start;
        return session;
      }

      session.status = 'completed';
    } catch (err: any) {
      session.status = 'failed';
      session.spokenFeedback = `Sorry, I encountered an issue: ${err.message}`;
    }

    session.durationMs = Date.now() - start;
    return session;
  }
}
