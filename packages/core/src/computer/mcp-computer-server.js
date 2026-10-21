"use strict";
/**
 * Model Context Protocol (MCP) Computer Control Server 🔌🖥️
 * Standard MCP specification provider for OS Computer Control and Open Interpreter tools.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpComputerServer = void 0;
const pyautogui_adapter_js_1 = require("./adapters/pyautogui-adapter.js");
const open_interpreter_js_1 = require("./open-interpreter.js");
const self_operating_computer_js_1 = require("./self-operating-computer.js");
class McpComputerServer {
    adapter;
    interpreter;
    selfOperating;
    constructor(adapter) {
        this.adapter = adapter || new pyautogui_adapter_js_1.PyAutoGUIAdapter();
        this.interpreter = new open_interpreter_js_1.OpenInterpreterEngine();
        this.selfOperating = new self_operating_computer_js_1.SelfOperatingComputerEngine(this.adapter);
    }
    /**
     * Get MCP tool specifications ready to expose to AI models or MCP clients
     */
    getMcpToolDefinitions() {
        return [
            {
                name: 'mcp_computer_screenshot',
                description: 'Capture screenshot of the desktop screen for visual perception and inspection.',
                category: 'media',
                parameters: {
                    type: 'object',
                    properties: {
                        displayIndex: { type: 'number', description: 'Monitor index (default 0)', default: 0 },
                    },
                },
                requiresApproval: false,
                isAvailable: true,
                permissionLevel: 'low',
            },
            {
                name: 'mcp_computer_mouse_click',
                description: 'Click mouse at coordinate or current position. Supports left, right, middle, and double click.',
                category: 'device',
                parameters: {
                    type: 'object',
                    properties: {
                        x: { type: 'number', description: 'Screen X coordinate' },
                        y: { type: 'number', description: 'Screen Y coordinate' },
                        button: { type: 'string', enum: ['left', 'right', 'middle'], default: 'left' },
                        clickCount: { type: 'number', default: 1 },
                    },
                },
                requiresApproval: true,
                isAvailable: true,
                permissionLevel: 'medium',
            },
            {
                name: 'mcp_computer_mouse_move',
                description: 'Move mouse cursor to specific screen coordinates.',
                category: 'device',
                parameters: {
                    type: 'object',
                    properties: {
                        x: { type: 'number', description: 'Target X coordinate' },
                        y: { type: 'number', description: 'Target Y coordinate' },
                    },
                    required: ['x', 'y'],
                },
                requiresApproval: false,
                isAvailable: true,
                permissionLevel: 'low',
            },
            {
                name: 'mcp_computer_keyboard_type',
                description: 'Type text string using simulated keyboard strokes into active window.',
                category: 'device',
                parameters: {
                    type: 'object',
                    properties: {
                        text: { type: 'string', description: 'Text string to type' },
                    },
                    required: ['text'],
                },
                requiresApproval: true,
                isAvailable: true,
                permissionLevel: 'medium',
            },
            {
                name: 'mcp_computer_keyboard_hotkey',
                description: 'Press keyboard shortcut combination (e.g. ["Control", "C"] or ["Alt", "Tab"]).',
                category: 'device',
                parameters: {
                    type: 'object',
                    properties: {
                        keys: { type: 'array', items: { type: 'string' }, description: 'Array of key names' },
                    },
                    required: ['keys'],
                },
                requiresApproval: true,
                isAvailable: true,
                permissionLevel: 'medium',
            },
            {
                name: 'mcp_computer_visual_grounding_perceive',
                description: 'Run Self-Operating Computer visual perception: detects all UI elements, buttons, and inputs, assigning labeled numbers [0], [1], [2] for reliable agent interaction.',
                category: 'device',
                parameters: {
                    type: 'object',
                    properties: {
                        displayIndex: { type: 'number', default: 0 },
                    },
                },
                requiresApproval: false,
                isAvailable: true,
                permissionLevel: 'low',
            },
            {
                name: 'mcp_computer_visual_tag_action',
                description: 'Execute click or type action targeting a labeled visual tag index [0], [1], [2] detected by Self-Operating Computer.',
                category: 'device',
                parameters: {
                    type: 'object',
                    properties: {
                        tagIndex: { type: 'number', description: 'The labeled element index' },
                        action: { type: 'string', enum: ['click', 'double_click', 'right_click', 'type'], default: 'click' },
                        value: { type: 'string', description: 'Text value if action is type' },
                    },
                    required: ['tagIndex'],
                },
                requiresApproval: true,
                isAvailable: true,
                permissionLevel: 'medium',
            },
            {
                name: 'mcp_open_interpreter_exec',
                description: 'Open Interpreter code execution: execute Python, PowerShell, Bash, or Node.js scripts directly on the operating system with live stdout/stderr.',
                category: 'terminal',
                parameters: {
                    type: 'object',
                    properties: {
                        language: { type: 'string', enum: ['python', 'bash', 'powershell', 'node'], default: 'bash' },
                        code: { type: 'string', description: 'Code to execute' },
                        cwd: { type: 'string', description: 'Optional working directory' },
                    },
                    required: ['code'],
                },
                requiresApproval: true,
                isAvailable: true,
                permissionLevel: 'high',
            },
        ];
    }
    /**
     * Handle incoming MCP tool call
     */
    async handleMcpToolCall(request) {
        const args = request.arguments || {};
        switch (request.name) {
            case 'mcp_computer_screenshot': {
                const base64 = await this.adapter.captureScreenshot(Number(args.displayIndex) || 0);
                return {
                    toolCallId: request.id,
                    content: [
                        { type: 'text', text: 'Screenshot captured successfully.' },
                        { type: 'image', data: base64, mimeType: 'image/png' },
                    ],
                };
            }
            case 'mcp_computer_mouse_click': {
                const x = args.x !== undefined ? Number(args.x) : undefined;
                const y = args.y !== undefined ? Number(args.y) : undefined;
                const point = x !== undefined && y !== undefined ? { x, y } : undefined;
                const result = await this.adapter.mouseClick(args.button || 'left', Number(args.clickCount) || 1, point);
                return {
                    toolCallId: request.id,
                    content: [{ type: 'text', text: result.message }],
                };
            }
            case 'mcp_computer_mouse_move': {
                const result = await this.adapter.mouseMove(Number(args.x), Number(args.y));
                return {
                    toolCallId: request.id,
                    content: [{ type: 'text', text: result.message }],
                };
            }
            case 'mcp_computer_keyboard_type': {
                const result = await this.adapter.keyboardType(String(args.text || ''));
                return {
                    toolCallId: request.id,
                    content: [{ type: 'text', text: result.message }],
                };
            }
            case 'mcp_computer_keyboard_hotkey': {
                const result = await this.adapter.keyboardHotkey(args.keys || []);
                return {
                    toolCallId: request.id,
                    content: [{ type: 'text', text: result.message }],
                };
            }
            case 'mcp_computer_visual_grounding_perceive': {
                const result = await this.selfOperating.perceiveScreen(Number(args.displayIndex) || 0);
                return {
                    toolCallId: request.id,
                    content: [
                        { type: 'text', text: `Visual Grounding State:\n${result.taggedOverview}` },
                        { type: 'image', data: result.screenshotBase64, mimeType: 'image/png' },
                    ],
                };
            }
            case 'mcp_computer_visual_tag_action': {
                const result = await this.selfOperating.executeTagAction(Number(args.tagIndex), args.action || 'click', args.value ? String(args.value) : undefined);
                return {
                    toolCallId: request.id,
                    content: [{ type: 'text', text: result.message }],
                    isError: !result.success,
                };
            }
            case 'mcp_open_interpreter_exec': {
                const result = await this.interpreter.execute({
                    language: args.language || 'bash',
                    code: String(args.code || ''),
                    cwd: args.cwd ? String(args.cwd) : undefined,
                });
                const output = result.stderr ? `Error:\n${result.stderr}` : `Output:\n${result.stdout}`;
                return {
                    toolCallId: request.id,
                    content: [
                        { type: 'text', text: `[Open Interpreter ${result.language.toUpperCase()} (Risk: ${result.riskLevel})]\n${output}` },
                    ],
                    isError: result.exitCode !== 0,
                };
            }
            default:
                return {
                    toolCallId: request.id,
                    content: [{ type: 'text', text: `Unknown MCP Computer tool: ${request.name}` }],
                    isError: true,
                };
        }
    }
}
exports.McpComputerServer = McpComputerServer;
//# sourceMappingURL=mcp-computer-server.js.map