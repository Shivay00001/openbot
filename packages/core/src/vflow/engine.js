"use strict";
/**
 * vFlow Workflow Execution Engine ⚡🎙️
 * Executes voice action graphs and duplex voice interaction cycles.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.vFlowEngine = void 0;
const uuid_1 = require("uuid");
const parser_js_1 = require("./parser.js");
const index_js_1 = require("../phone/index.js");
const engine_js_1 = require("../browser/engine.js");
const open_interpreter_js_1 = require("../computer/open-interpreter.js");
class vFlowEngine {
    parser;
    phoneController;
    browserEngine;
    interpreter;
    workflows = new Map();
    constructor() {
        this.parser = new parser_js_1.vFlowCommandParser();
        this.phoneController = new index_js_1.AgenticPhoneController();
        this.browserEngine = new engine_js_1.BrowserAutomationEngine();
        this.interpreter = new open_interpreter_js_1.OpenInterpreterEngine();
    }
    /**
     * Register custom or community vFlow workflow
     */
    registerWorkflow(workflow) {
        this.workflows.set(workflow.id, workflow);
    }
    /**
     * List all available vFlow workflows
     */
    getWorkflows() {
        return Array.from(this.workflows.values());
    }
    /**
     * Main entrypoint: process spoken voice utterance end-to-end
     */
    async processVoiceCommand(rawUtterance) {
        const start = Date.now();
        const command = this.parser.parseUtterance(rawUtterance);
        const intent = this.parser.classifyIntent(command);
        const session = {
            sessionId: (0, uuid_1.v4)(),
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
                const res = await this.phoneController.sendAutomatedMessage(intent.slots.recipient, intent.slots.message, intent.slots.app || 'whatsapp');
                session.steps.push({
                    nodeId: 'step_phone_msg',
                    nodeType: 'action_phone',
                    status: 'completed',
                    input: intent.slots,
                    output: res,
                    durationMs: Date.now() - stepStart,
                });
                session.spokenFeedback = `Message successfully sent to ${intent.slots.recipient} via ${intent.slots.app || 'WhatsApp'}.`;
            }
            else if (intent.intentName === 'phone_make_call') {
                const stepStart = Date.now();
                const res = await this.phoneController.initiateCall(intent.slots.target);
                session.steps.push({
                    nodeId: 'step_phone_call',
                    nodeType: 'action_phone',
                    status: 'completed',
                    input: intent.slots,
                    output: res,
                    durationMs: Date.now() - stepStart,
                });
                session.spokenFeedback = `Initiated automated call to ${intent.slots.target} for ${intent.slots.purpose}.`;
            }
            else if (intent.intentName === 'browser_web_search') {
                const stepStart = Date.now();
                const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(intent.slots.query)}`;
                const res = await this.browserEngine.navigate(searchUrl);
                session.steps.push({
                    nodeId: 'step_browser_search',
                    nodeType: 'action_browser',
                    status: 'completed',
                    input: { query: intent.slots.query, url: searchUrl },
                    output: res,
                    durationMs: Date.now() - stepStart,
                });
                session.spokenFeedback = `Searched for ${intent.slots.query} in browser workspace.`;
            }
            else if (intent.intentName === 'desktop_execute_command') {
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
            }
            else {
                session.spokenFeedback = `I heard: "${command.transcript}". Processing with universal intelligence engine.`;
            }
            session.status = 'completed';
        }
        catch (err) {
            session.status = 'failed';
            session.spokenFeedback = `Sorry, I encountered an issue: ${err.message}`;
        }
        session.durationMs = Date.now() - start;
        return session;
    }
}
exports.vFlowEngine = vFlowEngine;
//# sourceMappingURL=engine.js.map