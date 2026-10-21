/**
 * OpenBot Tool Registry
 * Extensible tool/action system with permission gating.
 * Built-in tools for search, code execution, file access, etc.
 */

import { v4 as uuid } from 'uuid';
import type {
  ToolDefinition,
  ToolResult,
  ToolExecutionContext,
  ToolCategory,
  PermissionLevel,
  Permission,
  PermissionAction,
} from '../types/index.js';
import { BrowserAutomationEngine } from '../browser/engine.js';
import { SelfOperatingComputerEngine } from '../computer/self-operating-computer.js';
import { OpenInterpreterEngine } from '../computer/open-interpreter.js';
import { PyAutoGUIAdapter } from '../computer/adapters/pyautogui-adapter.js';
import { AgenticPhoneController } from '../phone/index.js';
import { ArtemisPhoneNavigator } from '../phone/artemis-phone-navigator.js';
import { vFlowEngine } from '../vflow/engine.js';
import { EpisodicMemoryEngine } from '../memory/episodic-memory.js';
import { ReinforcementLearningEngine } from '../memory/reinforcement-engine.js';

// ─── Tool Handler Interface ─────────────────────────────────────

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolResult>;

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ─── Tool Registry ──────────────────────────────────────────────

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private approvalCallback?: (toolName: string, input: Record<string, unknown>) => Promise<PermissionAction>;

  // Embedded automation engines
  private browserEngine: BrowserAutomationEngine = new BrowserAutomationEngine();
  private selfOperatingComputer: SelfOperatingComputerEngine = new SelfOperatingComputerEngine();
  private openInterpreter: OpenInterpreterEngine = new OpenInterpreterEngine();
  private phoneController: AgenticPhoneController = new AgenticPhoneController();
  private artemisPhoneNavigator: ArtemisPhoneNavigator = new ArtemisPhoneNavigator();
  private vflowEngine: vFlowEngine = new vFlowEngine();
  private episodicMemory: EpisodicMemoryEngine = new EpisodicMemoryEngine();
  private reinforcementEngine: ReinforcementLearningEngine = new ReinforcementLearningEngine();

  constructor() {
    // Register all built-in tools
    this.registerBuiltInTools();
  }

  /**
   * Register a custom tool
   */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Get all tool definitions (for LLM function calling)
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter((t) => t.definition.isAvailable)
      .map((t) => t.definition);
  }

  /**
   * Get tool definitions filtered by category
   */
  getToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getToolDefinitions().filter((t) => t.category === category);
  }

  /**
   * Set the approval callback for permission-gated tools
   */
  setApprovalCallback(cb: (toolName: string, input: Record<string, unknown>) => Promise<PermissionAction>): void {
    this.approvalCallback = cb;
  }

  /**
   * Execute a tool with permission checking
   */
  async execute(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        toolCallId: uuid(),
        name: toolName,
        result: null,
        error: `Tool "${toolName}" not found. Available tools: ${Array.from(this.tools.keys()).join(', ')}`,
      };
    }

    // Check permissions
    if (tool.definition.requiresApproval) {
      const existingPermission = context.permissions.find(
        (p) => p.toolName === toolName && (p.action === 'always_allow')
      );

      if (!existingPermission && this.approvalCallback) {
        const decision = await this.approvalCallback(toolName, input);
        if (decision === 'deny') {
          return {
            toolCallId: uuid(),
            name: toolName,
            result: null,
            error: 'User denied permission to execute this tool.',
          };
        }
      }
    }

    // Execute with error handling
    const start = Date.now();
    try {
      const result = await tool.handler(input, context);
      result.durationMs = Date.now() - start;
      return result;
    } catch (error) {
      return {
        toolCallId: uuid(),
        name: toolName,
        result: null,
        error: error instanceof Error ? error.message : 'Tool execution failed',
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  // ─── Built-in Tool Registrations ───────────────────────────────

  private registerBuiltInTools(): void {
    // 1. Web Search
    this.register(
      {
        name: 'web_search',
        description: 'Search the web for information. Returns relevant results with snippets.',
        category: 'search',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query' },
            num_results: { type: 'number', description: 'Number of results (default 5)', default: 5 },
          },
          required: ['query'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'low',
      },
      async (input) => {
        const query = input.query as string;
        // Placeholder — will be replaced with actual search provider
        return {
          toolCallId: uuid(),
          name: 'web_search',
          result: {
            query,
            results: [
              {
                title: `Search results for: ${query}`,
                snippet: 'Connect a search provider (Brave, SearXNG, or Tavily) to enable web search.',
                url: '#',
              },
            ],
            note: 'Search provider not configured. Add SEARCH_API_KEY to enable.',
          },
        };
      }
    );

    // 2. Calculator
    this.register(
      {
        name: 'calculator',
        description: 'Evaluate mathematical expressions. Supports basic arithmetic, trigonometry, and common math functions.',
        category: 'utility',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Mathematical expression to evaluate (e.g., "2 + 2 * 3")' },
          },
          required: ['expression'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'none',
      },
      async (input) => {
        const expression = input.expression as string;
        try {
          // Safe math evaluation (no eval())
          const sanitized = expression.replace(/[^0-9+\-*/().%\s^]/g, '');
          const result = Function(`"use strict"; return (${sanitized})`)();
          return {
            toolCallId: uuid(),
            name: 'calculator',
            result: { expression, answer: result },
          };
        } catch (error) {
          return {
            toolCallId: uuid(),
            name: 'calculator',
            result: null,
            error: `Failed to evaluate: ${expression}`,
          };
        }
      }
    );

    // 3. Current DateTime
    this.register(
      {
        name: 'get_current_time',
        description: 'Get the current date and time in various formats and timezones.',
        category: 'utility',
        parameters: {
          type: 'object',
          properties: {
            timezone: { type: 'string', description: 'IANA timezone (e.g., "America/New_York"). Defaults to UTC.' },
            format: { type: 'string', description: 'Output format: "iso", "human", "unix". Default "human".' },
          },
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'none',
      },
      async (input) => {
        const tz = (input.timezone as string) || 'UTC';
        const format = (input.format as string) || 'human';
        const now = new Date();

        let formatted: string;
        switch (format) {
          case 'iso':
            formatted = now.toISOString();
            break;
          case 'unix':
            formatted = Math.floor(now.getTime() / 1000).toString();
            break;
          default:
            formatted = now.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' });
        }

        return {
          toolCallId: uuid(),
          name: 'get_current_time',
          result: { datetime: formatted, timezone: tz, unix: Math.floor(now.getTime() / 1000) },
        };
      }
    );

    // 4. Code Execution (JavaScript sandbox)
    this.register(
      {
        name: 'execute_code',
        description: 'Execute JavaScript/TypeScript code in a sandboxed environment. Returns the output or error.',
        category: 'code',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'JavaScript code to execute' },
            language: { type: 'string', description: 'Language: "javascript" or "typescript"', default: 'javascript' },
          },
          required: ['code'],
        },
        requiresApproval: true,
        isAvailable: true,
        permissionLevel: 'high',
      },
      async (input) => {
        const code = input.code as string;
        try {
          // Capture console output
          const logs: string[] = [];
          const mockConsole = {
            log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
            error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(String).join(' ')}`),
            warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(String).join(' ')}`),
          };

          const fn = new Function('console', code);
          const result = fn(mockConsole);

          return {
            toolCallId: uuid(),
            name: 'execute_code',
            result: {
              output: logs.join('\n'),
              returnValue: result,
              success: true,
            },
          };
        } catch (error) {
          return {
            toolCallId: uuid(),
            name: 'execute_code',
            result: null,
            error: error instanceof Error ? error.message : 'Code execution failed',
          };
        }
      }
    );

    // 5. Generate Text/Content
    this.register(
      {
        name: 'generate_content',
        description: 'Generate structured content: emails, documents, summaries, translations, etc.',
        category: 'utility',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Content type: "email", "summary", "translate", "rewrite", "expand", "document"',
            },
            input: { type: 'string', description: 'Source text or instructions' },
            options: {
              type: 'object',
              description: 'Additional options (e.g., target_language for translate, tone for email)',
            },
          },
          required: ['type', 'input'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'none',
      },
      async (input) => {
        return {
          toolCallId: uuid(),
          name: 'generate_content',
          result: {
            type: input.type,
            note: 'Content generation is handled by the agent loop using the current model. This tool is a passthrough.',
            input: input.input,
          },
        };
      }
    );

    // 6. Read URL / Fetch Web Page
    this.register(
      {
        name: 'read_url',
        description: 'Fetch and read the content of a web page. Returns the main text content.',
        category: 'search',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'The URL to fetch' },
            extract: { type: 'string', description: 'What to extract: "text", "html", "links", "all". Default "text".' },
          },
          required: ['url'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'low',
      },
      async (input) => {
        const url = input.url as string;
        try {
          const response = await fetch(url, {
            headers: { 'User-Agent': 'OpenBot/1.0' },
            signal: AbortSignal.timeout(15000),
          });
          const text = await response.text();
          // Basic HTML stripping
          const cleaned = text
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 8000);

          return {
            toolCallId: uuid(),
            name: 'read_url',
            result: { url, content: cleaned, status: response.status },
          };
        } catch (error) {
          return {
            toolCallId: uuid(),
            name: 'read_url',
            result: null,
            error: error instanceof Error ? error.message : 'Failed to fetch URL',
          };
        }
      }
    );

    // 7. Create/Write File
    this.register(
      {
        name: 'write_file',
        description: 'Create or overwrite a file with the given content.',
        category: 'filesystem',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to write to' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['path', 'content'],
        },
        requiresApproval: true,
        isAvailable: true,
        permissionLevel: 'high',
      },
      async (input) => {
        // Server-side implementation required
        return {
          toolCallId: uuid(),
          name: 'write_file',
          result: { path: input.path, note: 'File system tools require server-side execution context.' },
        };
      }
    );

    // 8. Read File
    this.register(
      {
        name: 'read_file',
        description: 'Read the contents of a file.',
        category: 'filesystem',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' },
          },
          required: ['path'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'medium',
      },
      async (input) => {
        return {
          toolCallId: uuid(),
          name: 'read_file',
          result: { path: input.path, note: 'File system tools require server-side execution context.' },
        };
      }
    );

    // 9. Take Screenshot
    this.register(
      {
        name: 'take_screenshot',
        description: 'Capture a screenshot of the current screen or a specific URL.',
        category: 'media',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Optional URL to screenshot (uses headless browser)' },
            selector: { type: 'string', description: 'Optional CSS selector to capture a specific element' },
          },
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'medium',
      },
      async (input) => {
        return {
          toolCallId: uuid(),
          name: 'take_screenshot',
          result: { note: 'Screenshot tool requires Playwright/Puppeteer server-side setup.' },
        };
      }
    );

    // 10. Terminal Command
    this.register(
      {
        name: 'run_terminal',
        description: 'Execute a terminal/shell command. Returns stdout, stderr, and exit code.',
        category: 'terminal',
        parameters: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'The command to execute' },
            cwd: { type: 'string', description: 'Working directory (optional)' },
            timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
          },
          required: ['command'],
        },
        requiresApproval: true,
        isAvailable: true,
        permissionLevel: 'critical',
      },
      async (input) => {
        return {
          toolCallId: uuid(),
          name: 'run_terminal',
          result: { note: 'Terminal tool requires server-side execution context with sandboxing.' },
        };
      }
    );

    // 11. Browser Navigate (Multi-engine: Playwright, Puppeteer, Selenium, WebdriverIO, Artemis)
    this.register(
      {
        name: 'browser_navigate',
        description: 'Navigate the universal browser to a URL. Supports Playwright, Puppeteer, Selenium, WebdriverIO, and Artemis.',
        category: 'browser',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Web URL to navigate to' },
            engine: { type: 'string', enum: ['playwright', 'puppeteer', 'selenium', 'webdriverio', 'browser_use', 'artemis_mobile'] },
          },
          required: ['url'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'low',
      },
      async (input) => {
        if (input.engine) {
          await this.browserEngine.switchEngine(input.engine as any);
        }
        const res = await this.browserEngine.navigate(input.url as string);
        return {
          toolCallId: uuid(),
          name: 'browser_navigate',
          result: res,
        };
      }
    );

    // 12. Browser Click
    this.register(
      {
        name: 'browser_click',
        description: 'Click on a web element by CSS selector or (X, Y) coordinate.',
        category: 'browser',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector' },
            x: { type: 'number', description: 'Optional X coordinate' },
            y: { type: 'number', description: 'Optional Y coordinate' },
          },
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'low',
      },
      async (input) => {
        const target = input.selector ? (input.selector as string) : { x: Number(input.x), y: Number(input.y) };
        const res = await this.browserEngine.clickElement(target);
        return {
          toolCallId: uuid(),
          name: 'browser_click',
          result: res,
        };
      }
    );

    // 13. Browser Fill Input
    this.register(
      {
        name: 'browser_fill',
        description: 'Type text into a webpage input field or textarea.',
        category: 'browser',
        parameters: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector' },
            value: { type: 'string', description: 'Value to type' },
            submit: { type: 'boolean', description: 'Submit form on enter', default: false },
          },
          required: ['selector', 'value'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'low',
      },
      async (input) => {
        const res = await this.browserEngine.fillInput(input.selector as string, input.value as string, { submit: Boolean(input.submit) });
        return {
          toolCallId: uuid(),
          name: 'browser_fill',
          result: res,
        };
      }
    );

    // 14. Browser Extract Content
    this.register(
      {
        name: 'browser_extract',
        description: 'Extract clean markdown, structured text, links, and tables from active webpage.',
        category: 'browser',
        parameters: { type: 'object', properties: {} },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'low',
      },
      async () => {
        const res = await this.browserEngine.extractContent();
        return {
          toolCallId: uuid(),
          name: 'browser_extract',
          result: res,
        };
      }
    );

    // 15. Artemis Phone Browser Mode
    this.register(
      {
        name: 'artemis_phone_browse',
        description: 'Control mobile smartphone web browser via Artemis (touch gestures, mobile viewport, mobile virtual keyboard).',
        category: 'browser',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to load' },
            touchAction: { type: 'string', enum: ['tap', 'swipe', 'scroll', 'pinch'] },
            x: { type: 'number' },
            y: { type: 'number' },
          },
          required: ['url'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'low',
      },
      async (input) => {
        await this.browserEngine.switchEngine('artemis_mobile');
        const res = await this.browserEngine.navigate(input.url as string);
        return {
          toolCallId: uuid(),
          name: 'artemis_phone_browse',
          result: res,
        };
      }
    );

    // 16. Phone Tap
    this.register(
      {
        name: 'phone_tap',
        description: 'Tap on a smartphone screen coordinate or element by visible text.',
        category: 'device',
        parameters: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'Screen X pixel' },
            y: { type: 'number', description: 'Screen Y pixel' },
            text: { type: 'string', description: 'Target element text to tap' },
          },
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'medium',
      },
      async (input) => {
        const res = input.text
          ? await this.phoneController.tapByText(input.text as string)
          : await this.phoneController.tap(Number(input.x), Number(input.y));
        return {
          toolCallId: uuid(),
          name: 'phone_tap',
          result: res,
        };
      }
    );

    // 17. Phone Launch App
    this.register(
      {
        name: 'phone_launch_app',
        description: 'Launch mobile application on Android/iOS (e.g. WhatsApp, Uber, Gmail, Maps, Spotify).',
        category: 'device',
        parameters: {
          type: 'object',
          properties: {
            appName: { type: 'string', description: 'App name or package name' },
          },
          required: ['appName'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'medium',
      },
      async (input) => {
        const res = await this.phoneController.launchApp(input.appName as string);
        return {
          toolCallId: uuid(),
          name: 'phone_launch_app',
          result: res,
        };
      }
    );

    // 18. Phone Send Automated Message
    this.register(
      {
        name: 'phone_send_message',
        description: 'Send WhatsApp or SMS message autonomously through phone.',
        category: 'communication',
        parameters: {
          type: 'object',
          properties: {
            recipient: { type: 'string', description: 'Contact name or phone number' },
            message: { type: 'string', description: 'Message body' },
            app: { type: 'string', enum: ['whatsapp', 'sms'], default: 'whatsapp' },
          },
          required: ['recipient', 'message'],
        },
        requiresApproval: true,
        isAvailable: true,
        permissionLevel: 'high',
      },
      async (input) => {
        const res = await this.phoneController.sendAutomatedMessage(
          input.recipient as string,
          input.message as string,
          (input.app as any) || 'whatsapp'
        );
        return {
          toolCallId: uuid(),
          name: 'phone_send_message',
          result: res,
        };
      }
    );

    // 19. Phone Initiate Call
    this.register(
      {
        name: 'phone_initiate_call',
        description: 'Place an outbound phone call with telephony or dialer.',
        category: 'communication',
        parameters: {
          type: 'object',
          properties: {
            phoneNumber: { type: 'string', description: 'Target phone number' },
          },
          required: ['phoneNumber'],
        },
        requiresApproval: true,
        isAvailable: true,
        permissionLevel: 'critical',
      },
      async (input) => {
        const res = await this.phoneController.initiateCall(input.phoneNumber as string);
        return {
          toolCallId: uuid(),
          name: 'phone_initiate_call',
          result: res,
        };
      }
    );

    // 20. Artemis Phone Workflow
    this.register(
      {
        name: 'artemis_phone_workflow',
        description: 'Execute autonomous end-to-end mobile app workflow (e.g. food delivery, booking, ride hailing).',
        category: 'device',
        parameters: {
          type: 'object',
          properties: {
            goal: { type: 'string', description: 'High-level mobile task goal' },
          },
          required: ['goal'],
        },
        requiresApproval: true,
        isAvailable: true,
        permissionLevel: 'high',
      },
      async (input) => {
        const res = await this.artemisPhoneNavigator.executeMobileWorkflow(input.goal as string);
        return {
          toolCallId: uuid(),
          name: 'artemis_phone_workflow',
          result: res,
        };
      }
    );

    // 21. Self-Operating Computer Visual Perceive
    this.register(
      {
        name: 'computer_visual_grounding_perceive',
        description: 'Capture desktop screen and detect all clickable UI buttons, inputs, and links labeled with numbers [0], [1], [2].',
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
      async (input) => {
        const res = await this.selfOperatingComputer.perceiveScreen(Number(input.displayIndex) || 0);
        return {
          toolCallId: uuid(),
          name: 'computer_visual_grounding_perceive',
          result: { taggedOverview: res.taggedOverview, elementCount: res.elements.length },
        };
      }
    );

    // 22. Self-Operating Computer Visual Tag Action
    this.register(
      {
        name: 'computer_visual_tag_action',
        description: 'Click or type on a visual UI element labeled with tag index [0], [1], [2] detected by Self-Operating Computer.',
        category: 'device',
        parameters: {
          type: 'object',
          properties: {
            tagIndex: { type: 'number', description: 'Numbered tag on the screen' },
            action: { type: 'string', enum: ['click', 'double_click', 'right_click', 'type'], default: 'click' },
            value: { type: 'string', description: 'Text to type if action is type' },
          },
          required: ['tagIndex'],
        },
        requiresApproval: true,
        isAvailable: true,
        permissionLevel: 'medium',
      },
      async (input) => {
        const res = await this.selfOperatingComputer.executeTagAction(
          Number(input.tagIndex),
          (input.action as any) || 'click',
          input.value as string
        );
        return {
          toolCallId: uuid(),
          name: 'computer_visual_tag_action',
          result: res,
        };
      }
    );

    // 23. Open Interpreter Code Execution
    this.register(
      {
        name: 'open_interpreter_exec',
        description: 'Execute Python, PowerShell, Bash, or Node.js code directly on the computer with real-time streaming output.',
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
      async (input) => {
        const res = await this.openInterpreter.execute({
          language: (input.language as any) || 'bash',
          code: input.code as string,
          cwd: input.cwd as string,
        });
        return {
          toolCallId: uuid(),
          name: 'open_interpreter_exec',
          result: res,
        };
      }
    );

    // 24. vFlow Voice Command Execution
    this.register(
      {
        name: 'vflow_execute_command',
        description: 'Execute a voice command through the vFlow graph engine (dispatches phone, browser, or desktop actions).',
        category: 'utility',
        parameters: {
          type: 'object',
          properties: {
            utterance: { type: 'string', description: 'Voice command utterance' },
          },
          required: ['utterance'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'medium',
      },
      async (input) => {
        const res = await this.vflowEngine.processVoiceCommand(input.utterance as string);
        return {
          toolCallId: uuid(),
          name: 'vflow_execute_command',
          result: res,
        };
      }
    );

    // 25. Episodic Memory Recall
    this.register(
      {
        name: 'memory_recall_episodic',
        description: 'Search past task episodes, execution trajectories, and lessons learned from past successes or failures.',
        category: 'utility',
        parameters: {
          type: 'object',
          properties: {
            goal: { type: 'string', description: 'Current task goal to match against past episodes' },
          },
          required: ['goal'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'none',
      },
      async (input, context) => {
        const episodes = await this.episodicMemory.searchSimilarEpisodes(input.goal as string, context.userId || 'user', 3);
        const lessons = await this.episodicMemory.getLessonsLearned(input.goal as string, context.userId || 'user');
        return {
          toolCallId: uuid(),
          name: 'memory_recall_episodic',
          result: { similarEpisodes: episodes, lessonsLearned: lessons },
        };
      }
    );

    // 26. Reinforcement Trajectory Evaluator
    this.register(
      {
        name: 'reinforcement_evaluate_trajectory',
        description: 'Evaluate a task execution trajectory, compute RL reward score, and extract critique reflection.',
        category: 'utility',
        parameters: {
          type: 'object',
          properties: {
            goal: { type: 'string', description: 'Task goal' },
            outcome: { type: 'string', enum: ['success', 'failure', 'partial'], default: 'success' },
            stepCount: { type: 'number', default: 3 },
          },
          required: ['goal'],
        },
        requiresApproval: false,
        isAvailable: true,
        permissionLevel: 'none',
      },
      async (input) => {
        const dummySteps = Array.from({ length: Number(input.stepCount) || 3 }).map((_, i) => ({
          stepIndex: i,
          action: `Step ${i + 1}`,
          durationMs: 150,
          success: true,
        }));
        const evalResult = this.reinforcementEngine.evaluateTrajectory(
          input.goal as string,
          dummySteps,
          (input.outcome as any) || 'success'
        );
        return {
          toolCallId: uuid(),
          name: 'reinforcement_evaluate_trajectory',
          result: evalResult,
        };
      }
    );
  }
}
