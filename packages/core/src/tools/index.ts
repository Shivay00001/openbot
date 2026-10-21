/**
 * OpenBot Tool Registry
 * Extensible tool/action system with permission gating.
 *
 * 27 built-in tools, every one backed by a real implementation:
 * - File I/O runs against the real filesystem inside a workspace jail.
 * - Shell/code execution runs real child processes (temp-file argv model).
 * - Web search uses the keyless DuckDuckGo HTML endpoint; fetch_url reads
 *   real pages through the zero-cloud-aware fetch guard.
 * - Browser tools drive a real Chromium via the Playwright adapter.
 * - Phone tools drive AgenticPhoneController (ADB / accessibility / flagged
 *   simulator); computer tools drive the PyAutoGUI desktop bridge.
 * - The calculator is a real recursive-descent parser (no eval/Function).
 */

import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as fsp from 'fs/promises';
import type {
  ToolDefinition,
  ToolResult,
  ToolExecutionContext,
  ToolCategory,
  PermissionAction,
} from '../types/index.js';
import { BrowserAutomationEngine } from '../browser/engine.js';
import { ArtemisPhoneBrowserController } from '../browser/artemis-phone-browser.js';
import { SelfOperatingComputerEngine } from '../computer/self-operating-computer.js';
import { OpenInterpreterEngine } from '../computer/open-interpreter.js';
import { PyAutoGUIAdapter } from '../computer/adapters/pyautogui-adapter.js';
import { AgenticPhoneController } from '../phone/index.js';
import { ArtemisPhoneNavigator } from '../phone/artemis-phone-navigator.js';
import { AgenticDesktopController } from '../desktop/index.js';
import { vFlowEngine } from '../vflow/engine.js';
import { MemoryManager, InMemoryStore, EpisodicMemoryEngine } from '../memory/index.js';
import { ReinforcementLearningEngine } from '../memory/reinforcement-engine.js';
import type { EpisodicStep } from '../memory/types.js';
import { zeroCloudGuard } from '../security/zero-cloud.js';

// ─── Tool Handler Interface ─────────────────────────────────────

export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolResult>;

interface RegisteredTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ─── Content generator hook (wired by OpenBotAgent to the ModelRouter) ───

export type ContentGenerator = (params: {
  prompt: string;
  format?: string;
  maxLength?: number;
}) => Promise<string>;

let contentGenerator: ContentGenerator | null = null;

/** Wire generate_content to a real model (called by AgentLoop). */
export function setDefaultContentGenerator(generator: ContentGenerator | null): void {
  contentGenerator = generator;
}

// ─── Workspace jail for file tools ──────────────────────────────

function workspaceRoot(): string {
  return path.resolve(process.env.OPENBOT_WORKSPACE_ROOT || process.cwd());
}

function resolveInsideWorkspace(input: string): string {
  const root = workspaceRoot();
  const resolved = path.resolve(root, input);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path "${input}" escapes the workspace root (${root}). File tools are jailed to the workspace.`);
  }
  return resolved;
}

// ─── Safe arithmetic parser (no eval, no Function constructor) ─

export function evaluateArithmetic(expression: string): number {
  const tokens: (string | number)[] = [];
  let i = 0;
  const src = expression.trim();
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      const value = Number(num);
      if (Number.isNaN(value)) throw new Error(`Invalid number: "${num}"`);
      tokens.push(value);
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) ident += src[i++];
      tokens.push(ident);
      continue;
    }
    if ('+-*/%^(),'.includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }
    throw new Error(`Unsupported character in expression: "${ch}"`);
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  const FUNCTIONS: Record<string, (x: number) => number> = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sqrt: Math.sqrt, log: Math.log, log10: Math.log10, exp: Math.exp,
    abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  };
  const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E, tau: Math.PI * 2 };

  function parseExpression(): number {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }
  function parseTerm(): number {
    let value = parsePower();
    while (peek() === '*' || peek() === '/' || peek() === '%') {
      const op = next();
      const rhs = parsePower();
      value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs;
    }
    return value;
  }
  function parsePower(): number {
    const base = parseUnary();
    if (peek() === '^') {
      next();
      const exponent = parsePower();
      return Math.pow(base, exponent);
    }
    return base;
  }
  function parseUnary(): number {
    if (peek() === '-') {
      next();
      return -parseUnary();
    }
    if (peek() === '+') {
      next();
      return parseUnary();
    }
    return parsePrimary();
  }
  function parsePrimary(): number {
    const token = next();
    if (token === undefined) throw new Error('Unexpected end of expression');
    if (typeof token === 'number') return token;
    if (token === '(') {
      const value = parseExpression();
      if (next() !== ')') throw new Error('Missing closing parenthesis');
      return value;
    }
    if (typeof token === 'string') {
      const lower = token.toLowerCase();
      if (lower in CONSTANTS) return CONSTANTS[lower];
      if (lower in FUNCTIONS) {
        if (next() !== '(') throw new Error(`Expected "(" after function ${token}`);
        const arg = parseExpression();
        if (next() !== ')') throw new Error(`Missing ")" after ${token} argument`);
        return FUNCTIONS[lower](arg);
      }
      throw new Error(`Unknown identifier: ${token}`);
    }
    throw new Error(`Unexpected token: ${token}`);
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new Error('Unexpected trailing tokens in expression');
  return result;
}

// ─── HTML helpers ───────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function ok(name: string, result: unknown): ToolResult {
  return { toolCallId: uuid(), name, result };
}

// ─── Tool Registry ──────────────────────────────────────────────

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private approvalCallback?: (toolName: string, input: Record<string, unknown>) => Promise<PermissionAction>;

  // Embedded automation engines
  private browserEngine: BrowserAutomationEngine = new BrowserAutomationEngine();
  private selfOperatingComputer: SelfOperatingComputerEngine = new SelfOperatingComputerEngine(new PyAutoGUIAdapter());
  private openInterpreter: OpenInterpreterEngine = new OpenInterpreterEngine();
  private desktopController: AgenticDesktopController = new AgenticDesktopController();
  private phoneController: AgenticPhoneController = new AgenticPhoneController();
  private memoryStore: InMemoryStore = new InMemoryStore();
  private memoryManager: MemoryManager = new MemoryManager(this.memoryStore);
  private reinforcementEngine: ReinforcementLearningEngine = new ReinforcementLearningEngine();
  private artemisBrowser: ArtemisPhoneBrowserController = new ArtemisPhoneBrowserController();
  private phoneNavigator: ArtemisPhoneNavigator = new ArtemisPhoneNavigator('simulator');
  private vflowEngine: vFlowEngine = new vFlowEngine();
  private episodicMemory: EpisodicMemoryEngine = new EpisodicMemoryEngine();

  constructor() {
    this.registerBuiltInTools();
  }

  register(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter((t) => t.definition.isAvailable)
      .map((t) => t.definition);
  }

  getToolsByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getToolDefinitions().filter((t) => t.category === category);
  }

  setApprovalCallback(cb: (toolName: string, input: Record<string, unknown>) => Promise<PermissionAction>): void {
    this.approvalCallback = cb;
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

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

    if (tool.definition.requiresApproval) {
      const existingPermission = context.permissions.find(
        (p) => p.toolName === toolName && p.action === 'always_allow'
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

    // Hard block for catastrophic shell patterns, regardless of approvals.
    if (toolName === 'run_terminal' || toolName === 'execute_code') {
      const payload = String(input.command || input.code || '').toLowerCase();
      const dangerous = ['rm -rf /', 'format c:', 'del /f /s /q c:', 'mkfs', 'dd if=/dev/zero', ':(){ :|:& };:'];
      if (dangerous.some((p) => payload.includes(p))) {
        return {
          toolCallId: uuid(),
          name: toolName,
          result: null,
          error: `Blocked dangerous command pattern in ${toolName}.`,
        };
      }
    }

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

  /** Connect the shared phone controller to the configured backend on first use. */
  private async ensurePhoneConnected(): Promise<void> {
    if (this.phoneController.getConnectionType() !== 'simulator') return;
    const backend = (process.env.OPENBOT_PHONE_BACKEND || 'adb') as 'adb' | 'accessibility_service' | 'simulator';
    if (backend === 'simulator') return;
    const res = await this.phoneController.connect(backend);
    if (!res.success) {
      throw new Error(`Phone backend "${backend}" is not available: ${res.message}`);
    }
  }

  // ─── Built-in Tool Registrations ─────────────────────────────

  private registerBuiltInTools(): void {
    const def = (
      name: string,
      description: string,
      category: ToolCategory,
      properties: Record<string, unknown>,
      required: string[],
      opts: { approval?: boolean; level?: ToolDefinition['permissionLevel'] } = {}
    ): ToolDefinition => ({
      name,
      description,
      category,
      parameters: { type: 'object', properties, required },
      requiresApproval: opts.approval ?? false,
      isAvailable: true,
      permissionLevel: opts.level ?? 'low',
    });

    // 1. Web Search — real keyless search (Bing HTML, DuckDuckGo fallback)
    this.register(
      def('web_search', 'Search the web with keyless public search endpoints (Bing HTML first, DuckDuckGo HTML fallback). Returns real results (title, URL, snippet).', 'search', {
        query: { type: 'string', description: 'The search query' },
        num_results: { type: 'number', description: 'Number of results (default 5)', default: 5 },
      }, ['query']),
      async (input) => {
        const query = String(input.query || '');
        const maxResults = Math.min(20, Math.max(1, Number(input.num_results) || 5));
        const headers = {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        };
        type SearchResult = { title: string; url: string; snippet: string };

        const parseBing = (html: string): SearchResult[] => {
          const results: SearchResult[] = [];
          const blocks = html.split(/<li class="b_algo"/).slice(1);
          for (const block of blocks) {
            const linkMatch = block.match(/<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
            if (!linkMatch) continue;
            let href = linkMatch[1].replace(/&amp;/g, '&');
            const uParam = href.match(/[?&]u=a1([A-Za-z0-9_-]+)/);
            if (uParam) {
              try {
                href = Buffer.from(uParam[1], 'base64').toString('utf8');
              } catch {
                // keep redirect URL
              }
            }
            const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
            results.push({
              title: stripHtml(linkMatch[2]),
              url: href,
              snippet: snippetMatch ? stripHtml(snippetMatch[1]) : '',
            });
            if (results.length >= maxResults) break;
          }
          return results;
        };

        const parseDdg = (html: string): SearchResult[] => {
          const results: SearchResult[] = [];
          const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
          let match: RegExpExecArray | null;
          while ((match = resultRegex.exec(html)) && results.length < maxResults) {
            let href = match[1];
            const uddg = href.match(/[?&]uddg=([^&]+)/);
            if (uddg) href = decodeURIComponent(uddg[1]);
            results.push({ title: stripHtml(match[2]), url: href, snippet: stripHtml(match[3]) });
          }
          return results;
        };

        const providers: Array<{ name: string; url: string; parse: (html: string) => SearchResult[] }> = [
          { name: 'Bing', url: `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${maxResults + 5}`, parse: parseBing },
          { name: 'DuckDuckGo', url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, parse: parseDdg },
        ];

        const failures: string[] = [];
        for (const provider of providers) {
          try {
            const response = await zeroCloudGuard.guardedFetch(provider.url, {
              headers,
              // Bounded per provider attempt: a dead/blackholed route must
              // surface as a provider failure (and fall through to the next
              // provider) within seconds, never hang the tool call.
              signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) {
              failures.push(`${provider.name}: HTTP ${response.status}`);
              continue;
            }
            const results = provider.parse(await response.text());
            if (results.length > 0) {
              return ok('web_search', { query, provider: provider.name, results });
            }
            failures.push(`${provider.name}: no results parsed (provider may be rate-limiting or served a bot check)`);
          } catch (err: any) {
            failures.push(`${provider.name}: ${err.message}`);
          }
        }
        throw new Error(`Web search failed on all keyless providers — ${failures.join('; ')}`);
      }
    );

    // 2. Fetch URL (canonical name: read_url)
    const fetchUrlHandler: ToolHandler = async (input) => {
      const maxChars = Math.min(50000, Math.max(500, Number(input.maxChars) || 8000));
      const response = await zeroCloudGuard.guardedFetch(String(input.url), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OpenBot/0.1)' },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Fetch failed: HTTP ${response.status} for ${input.url}`);
      const contentType = response.headers.get('content-type') || '';
      const raw = await response.text();
      const text = contentType.includes('html') ? stripHtml(raw) : raw;
      return ok('read_url', text.slice(0, maxChars));
    };
    const fetchUrlDef = (name: string) =>
      def(name, 'Fetch a URL and return its readable text content (HTML stripped to text). Blocked for remote hosts when Zero-Cloud mode is on.', 'search', {
        url: { type: 'string', description: 'URL to fetch' },
        maxChars: { type: 'number', description: 'Maximum characters to return (default 8000)' },
      }, ['url']);
    this.register(fetchUrlDef('read_url'), fetchUrlHandler);
    this.register(fetchUrlDef('fetch_url'), fetchUrlHandler);

    // 3. Browser Navigate (real Playwright Chromium)
    this.register(
      def('browser_navigate', 'Navigate the real Chromium browser (Playwright) to a URL. Returns page title and URL.', 'browser', {
        url: { type: 'string', description: 'URL to navigate to' },
      }, ['url']),
      async (input) => {
        const result = await this.browserEngine.navigate(String(input.url));
        if (!result.success) throw new Error(result.error || 'Navigation failed');
        return ok('browser_navigate', { url: result.currentUrl, title: result.pageTitle });
      }
    );

    // 4. Browser Click
    this.register(
      def('browser_click', 'Click an element in the browser by CSS selector or visible text (Playwright).', 'browser', {
        selector: { type: 'string', description: 'CSS selector or visible text' },
      }, ['selector']),
      async (input) => {
        const result = await this.browserEngine.clickElement(String(input.selector));
        if (!result.success) throw new Error(result.error || 'Click failed');
        return ok('browser_click', `Clicked "${input.selector}"`);
      }
    );

    // 5. Browser Fill (canonical name: browser_fill)
    const browserFillHandler: ToolHandler = async (input) => {
      const result = await this.browserEngine.fillInput(
        String(input.selector),
        String(input.value ?? input.text ?? '')
      );
      if (!result.success) throw new Error(result.error || 'Fill failed');
      return ok('browser_fill', `Filled "${input.selector}"`);
    };
    this.register(
      def('browser_fill', 'Fill a form field in the browser by CSS selector (Playwright).', 'browser', {
        selector: { type: 'string', description: 'CSS selector of the input field' },
        value: { type: 'string', description: 'Value to type' },
      }, ['selector', 'value']),
      browserFillHandler
    );
    this.register(
      def('browser_type', 'Type text into a form field in the browser by CSS selector (Playwright).', 'browser', {
        selector: { type: 'string', description: 'CSS selector of the input field' },
        text: { type: 'string', description: 'Text to type' },
      }, ['selector', 'text']),
      browserFillHandler
    );

    // 6. Browser Extract
    this.register(
      def('browser_extract', 'Extract visible text content of the current browser page (optionally scoped to a CSS selector).', 'browser', {
        selector: { type: 'string', description: 'Optional CSS selector' },
      }, []),
      async (input) => {
        const content = await this.browserEngine.extractContent();
        if (content.metadata?.error) throw new Error(content.metadata.error);
        return ok('browser_extract', (content.text || '').slice(0, 8000));
      }
    );

    // 7. Screenshot (canonical name: take_screenshot)
    const screenshotHandler: ToolHandler = async (input) => {
      if (input.url) {
        const nav = await this.browserEngine.navigate(String(input.url));
        if (!nav.success) throw new Error(nav.error || 'Navigation failed');
      }
      const dataUrl = await this.browserEngine.captureScreenshot();
      return ok('take_screenshot', dataUrl);
    };
    this.register(
      def('take_screenshot', 'Take a screenshot of a web page (or the current browser page) via Playwright; returns a PNG data URL.', 'browser', {
        url: { type: 'string', description: 'URL to open first (optional if a page is already open)' },
      }, []),
      screenshotHandler
    );
    this.register(
      def('browser_screenshot', 'Screenshot of the current browser page or a URL; returns a PNG data URL.', 'browser', {
        url: { type: 'string', description: 'Optional URL to open first' },
      }, []),
      screenshotHandler
    );

    // 7b. Artemis Phone Browse (real Playwright mobile emulation)
    this.register(
      def('artemis_phone_browse', 'Control a mobile smartphone web browser via Artemis (Playwright mobile emulation: touch gestures, mobile viewport). Navigates to a URL and optionally performs one touch action.', 'browser', {
        url: { type: 'string', description: 'URL to load' },
        touchAction: { type: 'string', description: 'tap | swipe | scroll | pinch (optional)' },
        x: { type: 'number', description: 'X coordinate for tap' },
        y: { type: 'number', description: 'Y coordinate for tap' },
      }, ['url']),
      async (input) => {
        const nav = await this.artemisBrowser.navigate(String(input.url));
        if (!nav.success) throw new Error(nav.error || 'Artemis navigation failed');
        let touch: unknown = undefined;
        if (input.touchAction === 'tap') {
          const tap = await this.artemisBrowser.click({ x: Number(input.x) || 0, y: Number(input.y) || 0 });
          if (!tap.success) throw new Error(tap.error || 'Tap failed');
          touch = tap.message;
        } else if (input.touchAction === 'scroll') {
          const scroll = await this.artemisBrowser.scroll('down', 300);
          if (!scroll.success) throw new Error(scroll.error || 'Scroll failed');
          touch = scroll.message;
        } else if (input.touchAction) {
          throw new Error(`Touch action "${input.touchAction}" is not supported by the Artemis browser (supported: tap, scroll).`);
        }
        const viewport = await this.artemisBrowser.getViewportState();
        return ok('artemis_phone_browse', { message: nav.message, url: nav.currentUrl, title: nav.pageTitle, touch, viewport });
      }
    );

    // 8. Read File (workspace-jailed)
    this.register(
      def('read_file', 'Read a text file from inside the workspace (paths outside the workspace root are rejected).', 'filesystem', {
        filePath: { type: 'string', description: 'Path relative to the workspace root' },
      }, ['filePath']),
      async (input) => {
        const resolved = resolveInsideWorkspace(String(input.filePath));
        const content = await fsp.readFile(resolved, 'utf8');
        return ok('read_file', content.slice(0, 50000));
      }
    );

    // 9. Write File (workspace-jailed, approval)
    this.register(
      def('write_file', 'Write text content to a file inside the workspace (creates parent directories).', 'filesystem', {
        filePath: { type: 'string', description: 'Path relative to the workspace root' },
        content: { type: 'string', description: 'Content to write' },
      }, ['filePath', 'content'], { approval: true, level: 'medium' }),
      async (input) => {
        const resolved = resolveInsideWorkspace(String(input.filePath));
        await fsp.mkdir(path.dirname(resolved), { recursive: true });
        await fsp.writeFile(resolved, String(input.content), 'utf8');
        return ok('write_file', `Wrote ${String(input.content).length} bytes to ${resolved}`);
      }
    );

    // 10. List Directory
    this.register(
      def('list_directory', 'List the real contents of a directory inside the workspace.', 'filesystem', {
        dirPath: { type: 'string', description: 'Directory path (default: workspace root)' },
      }, []),
      async (input) => {
        const resolved = resolveInsideWorkspace(String(input.dirPath || '.'));
        const items = await this.desktopController.listFiles(resolved);
        return ok('list_directory', items.map((item) => ({ name: item.name, path: item.path, isDirectory: item.isDirectory, sizeBytes: item.sizeBytes })));
      }
    );

    // 11. Run Terminal (real shell, approval)
    this.register(
      def('run_terminal', 'Run a real shell command on the host and return stdout, stderr, and exit code.', 'terminal', {
        command: { type: 'string', description: 'Shell command to run' },
        timeoutMs: { type: 'number', description: 'Timeout in ms (default 30000)' },
      }, ['command'], { approval: true, level: 'high' }),
      async (input) => {
        const result = await this.desktopController.executeShell(String(input.command), {
          timeoutMs: Number(input.timeoutMs) || 30000,
        });
        return ok('run_terminal', result);
      }
    );

    // 12. Execute Code / Open Interpreter (same real engine, approval)
    const interpreterHandler: ToolHandler = async (input) => {
      const result = await this.openInterpreter.execute({
        code: String(input.code),
        language: (input.language as any) || 'python',
      });
      return ok('execute_code', result);
    };
    const interpreterDef = (name: string, description: string) =>
      def(name, description, 'code', {
        code: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', description: 'python | node | bash | powershell (default python)' },
      }, ['code'], { approval: true, level: 'high' });
    this.register(
      interpreterDef('execute_code', 'Execute code in python, node, bash, or powershell via the Open Interpreter engine (temp-file execution, no shell interpolation).'),
      interpreterHandler
    );
    this.register(
      interpreterDef('open_interpreter_exec', 'Open Interpreter code execution: execute Python, PowerShell, Bash, or Node.js directly on the OS with live stdout/stderr.'),
      interpreterHandler
    );

    // 13. Calculator (canonical name: calculator; safe parser, no eval)
    const calculatorHandler: ToolHandler = async (input) =>
      ok('calculator', evaluateArithmetic(String(input.expression)));
    const calculatorDef = (name: string) =>
      def(name, 'Evaluate an arithmetic expression with a safe parser (+ - * / % ^, parentheses, sin/cos/tan/sqrt/log/exp/abs/floor/ceil/round, pi/e).', 'utility', {
        expression: { type: 'string', description: 'e.g. "sqrt(144) + 2^10"' },
      }, ['expression'], { level: 'none' });
    this.register(calculatorDef('calculator'), calculatorHandler);
    this.register(calculatorDef('evaluate_expression'), calculatorHandler);

    // 14. Generate Content (model-wired)
    this.register(
      def('generate_content', 'Generate text content with the connected model (wired by the agent to its ModelRouter). Errors clearly when no model is connected.', 'utility', {
        prompt: { type: 'string', description: 'What to generate' },
        format: { type: 'string', description: 'Format hint (paragraph, list, code, ...)' },
        maxLength: { type: 'number', description: 'Rough maximum length in characters' },
      }, ['prompt']),
      async (input) => {
        if (!contentGenerator) {
          throw new Error('generate_content is not connected to a model. It is wired automatically when tools run inside an AgentLoop; standalone use requires setDefaultContentGenerator().');
        }
        const text = await contentGenerator({
          prompt: String(input.prompt),
          format: input.format ? String(input.format) : undefined,
          maxLength: input.maxLength ? Number(input.maxLength) : undefined,
        });
        return ok('generate_content', text);
      }
    );

    // 15. Current Time
    this.register(
      def('get_current_time', 'Get the current date and time (ISO 8601, local string, unix timestamp).', 'utility', {}, [], { level: 'none' }),
      async () => {
        const now = new Date();
        return ok('get_current_time', { iso: now.toISOString(), local: now.toString(), unixMs: now.getTime() });
      }
    );

    // 16. Memory Store
    this.register(
      def('memory_store', 'Store a fact in long-term semantic memory (TF-IDF indexed, searchable via memory_recall).', 'data', {
        content: { type: 'string', description: 'Fact to remember' },
        category: { type: 'string', description: 'fact | preference | conversation | task | context (default fact)' },
      }, ['content']),
      async (input, context) => {
        const memory = await this.memoryManager.remember(
          context.userId,
          String(input.content),
          ((input.category as string) || 'fact') as any
        );
        return ok('memory_store', { id: memory.id, content: memory.content });
      }
    );

    // 17. Memory Recall
    this.register(
      def('memory_recall', 'Recall memories relevant to a query (TF-IDF similarity search over stored memories).', 'data', {
        query: { type: 'string', description: 'What to recall' },
      }, ['query']),
      async (input, context) => {
        const results = await this.memoryStore.search(String(input.query), context.userId, 5);
        return ok('memory_recall', results.map((m) => ({ category: m.category, content: m.content })));
      }
    );

    // 18. Phone Tap
    this.register(
      def('phone_tap', 'Tap at coordinates on the connected Android phone (ADB or accessibility backend).', 'device', {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
      }, ['x', 'y'], { level: 'medium' }),
      async (input) => {
        await this.ensurePhoneConnected();
        const result = await this.phoneController.tap(Number(input.x), Number(input.y));
        if (!result.success) throw new Error(result.message);
        return ok('phone_tap', result.message);
      }
    );

    // 19. Phone Type
    this.register(
      def('phone_type', 'Type text on the connected phone via the active backend.', 'device', {
        text: { type: 'string', description: 'Text to type' },
      }, ['text'], { level: 'medium' }),
      async (input) => {
        await this.ensurePhoneConnected();
        const result = await this.phoneController.typeText(String(input.text));
        if (!result.success) throw new Error(result.message);
        return ok('phone_type', result.message);
      }
    );

    // 20. Phone Launch App
    this.register(
      def('phone_launch_app', 'Launch an app on the phone by friendly name (WhatsApp, Chrome, ...) or package id.', 'device', {
        appName: { type: 'string', description: 'App name or package id' },
      }, ['appName'], { level: 'medium' }),
      async (input) => {
        await this.ensurePhoneConnected();
        const result = await this.phoneController.launchApp(String(input.appName));
        if (!result.success) throw new Error(result.message);
        return ok('phone_launch_app', result.message);
      }
    );

    // 21. Phone Screenshot
    this.register(
      def('phone_screenshot', 'Capture the phone screen via ADB screencap; returns a PNG data URL. Fails honestly when no device is attached.', 'device', {}, []),
      async () => {
        await this.ensurePhoneConnected();
        const state = await this.phoneController.getScreenState();
        if (!state.screenshotBase64) {
          throw new Error('No screenshot available from the current phone backend (ADB screencap failed or the accessibility service cannot capture).');
        }
        return ok('phone_screenshot', state.screenshotBase64);
      }
    );

    // 22. Phone Send Message (approval)
    this.register(
      def('phone_send_message', 'Send a WhatsApp/SMS message through the phone UI: opens the chat via deep link, types, and taps Send; each step verified against the live UI hierarchy.', 'communication', {
        recipient: { type: 'string', description: 'Contact name or phone number' },
        message: { type: 'string', description: 'Message body' },
        app: { type: 'string', description: 'WhatsApp | Messages (default WhatsApp)' },
      }, ['recipient', 'message'], { approval: true, level: 'high' }),
      async (input) => {
        await this.ensurePhoneConnected();
        const result = await this.phoneController.sendAutomatedMessage(
          String(input.recipient),
          String(input.message),
          String(input.app || 'WhatsApp').toLowerCase() === 'messages' || String(input.app || '').toLowerCase() === 'sms' ? 'sms' : 'whatsapp'
        );
        if (!result.success) throw new Error(result.message);
        return ok('phone_send_message', result.message);
      }
    );

    // 23. Phone Call (canonical name: phone_initiate_call, approval)
    const phoneCallHandler: ToolHandler = async (input) => {
      await this.ensurePhoneConnected();
      const result = await this.phoneController.initiateCall(String(input.phoneNumber));
      if (!result.success) throw new Error(result.status);
      return ok('phone_initiate_call', result.status + (result.simulated ? ' (simulated backend)' : ''));
    };
    const phoneCallDef = (name: string) =>
      def(name, 'Initiate a phone call via the dialer intent (ACTION_CALL — places a real call on a real device).', 'communication', {
        phoneNumber: { type: 'string', description: 'Number to call' },
      }, ['phoneNumber'], { approval: true, level: 'high' });
    this.register(phoneCallDef('phone_initiate_call'), phoneCallHandler);
    this.register(phoneCallDef('phone_call'), phoneCallHandler);

    // 23b. Artemis Phone Workflow (plan + verified step execution)
    this.register(
      def('artemis_phone_workflow', 'Execute an autonomous multi-step phone workflow from a natural-language goal (e.g. "Message mom on WhatsApp saying I arrived"). Steps are planned from the goal text and each step result is verified; the first failure stops the workflow.', 'device', {
        goal: { type: 'string', description: 'Natural-language phone goal' },
        backend: { type: 'string', description: 'simulator | adb | accessibility_service (default: OPENBOT_PHONE_BACKEND or simulator)' },
      }, ['goal'], { level: 'medium' }),
      async (input) => {
        const backend = (input.backend as string) || process.env.OPENBOT_PHONE_BACKEND || 'simulator';
        if (backend !== 'simulator') {
          const switched = await this.phoneNavigator.switchBackend(backend as any);
          if (!switched.success) throw new Error(switched.message || `Backend ${backend} unavailable`);
        }
        const result = await this.phoneNavigator.executeMobileWorkflow(String(input.goal));
        if (!result.success) throw new Error(result.summary);
        return ok('artemis_phone_workflow', result);
      }
    );

    // 24. Computer Screenshot
    this.register(
      def('computer_screenshot', 'Capture the desktop screen via the PyAutoGUI bridge (requires python3 + pyautogui + a display); returns a PNG data URL.', 'device', {}, []),
      async () => {
        const perception = await this.selfOperatingComputer.perceiveScreen();
        return ok('computer_screenshot', perception.screenshotBase64);
      }
    );

    // 25. Computer Click (approval)
    this.register(
      def('computer_click', 'Click at desktop coordinates via the PyAutoGUI bridge.', 'device', {
        x: { type: 'number', description: 'X coordinate' },
        y: { type: 'number', description: 'Y coordinate' },
      }, ['x', 'y'], { approval: true, level: 'medium' }),
      async (input) => {
        const result = await this.selfOperatingComputer.clickCoordinate(Number(input.x), Number(input.y));
        if (!result.success) throw new Error(result.message);
        return ok('computer_click', result.message);
      }
    );

    // 26. Computer Type (approval)
    this.register(
      def('computer_type', 'Type text at the current desktop focus via the PyAutoGUI bridge.', 'device', {
        text: { type: 'string', description: 'Text to type' },
      }, ['text'], { approval: true, level: 'medium' }),
      async (input) => {
        const result = await this.selfOperatingComputer.typeText(String(input.text));
        if (!result.success) throw new Error(result.message);
        return ok('computer_type', result.message);
      }
    );

    // 26b. Computer Visual Grounding — Perceive
    this.register(
      def('computer_visual_grounding_perceive', 'Run Self-Operating Computer visual perception: capture the real screen and detect UI elements with the configured detector (OmniParser endpoint or Tesseract OCR), assigning labels [0], [1], [2]... Returns the tagged overview (no elements are fabricated when no detector is available).', 'device', {
        displayIndex: { type: 'number', description: 'Monitor index (default 0)' },
      }, []),
      async (input) => {
        const perception = await this.selfOperatingComputer.perceiveScreen(Number(input.displayIndex) || 0);
        return ok('computer_visual_grounding_perceive', {
          elementsDetected: perception.elements.length,
          taggedOverview: perception.taggedOverview,
          screenshotBase64: perception.screenshotBase64,
        });
      }
    );

    // 26c. Computer Visual Grounding — Tag Action (approval)
    this.register(
      def('computer_visual_tag_action', 'Execute a click/type action on a labeled visual tag [n] detected by computer_visual_grounding_perceive.', 'device', {
        tagIndex: { type: 'number', description: 'The labeled element index' },
        action: { type: 'string', description: 'click | double_click | right_click | type (default click)' },
        value: { type: 'string', description: 'Text value when action is type' },
      }, ['tagIndex'], { approval: true, level: 'medium' }),
      async (input) => {
        const result = await this.selfOperatingComputer.executeTagAction(
          Number(input.tagIndex),
          (input.action as any) || 'click',
          input.value ? String(input.value) : undefined
        );
        if (!result.success) throw new Error(result.message);
        return ok('computer_visual_tag_action', result.message);
      }
    );

    // 26d. vFlow Voice Command Execution
    this.register(
      def('vflow_execute_command', 'Parse and execute a natural-language voice command through the vFlow engine (wake word, intent classification, slot extraction, action graph).', 'utility', {
        utterance: { type: 'string', description: 'Voice command utterance' },
      }, ['utterance'], { level: 'none' }),
      async (input) => {
        const session = await this.vflowEngine.processVoiceCommand(String(input.utterance));
        return ok('vflow_execute_command', session);
      }
    );

    // 26e. Episodic Memory Recall
    this.register(
      def('memory_recall_episodic', 'Recall past task episodes similar to a goal from the persistent episodic memory, including lessons learned.', 'data', {
        goal: { type: 'string', description: 'Current task goal to match against past episodes' },
      }, ['goal']),
      async (input, context) => {
        const episodes = await this.episodicMemory.searchSimilarEpisodes(String(input.goal), context.userId || 'user', 3);
        const lessons = await this.episodicMemory.getLessonsLearned(String(input.goal), context.userId || 'user');
        return ok('memory_recall_episodic', { episodes, lessons });
      }
    );

    // 27. RL Trajectory Evaluation (real steps required — no dummy data)
    this.register(
      def('reinforcement_evaluate_trajectory', 'Evaluate a concrete task trajectory with the RL engine: completion/efficiency/safety scores and a critique. Requires the actual executed steps.', 'utility', {
        goal: { type: 'string', description: 'Task goal' },
        outcome: { type: 'string', description: 'success | failure | partial (default success)' },
        steps: { type: 'array', description: 'Executed steps: [{ stepIndex, action, durationMs, success }]', items: { type: 'object' } },
      }, ['goal', 'steps'], { level: 'none' }),
      async (input) => {
        const rawSteps = Array.isArray(input.steps) ? (input.steps as Array<Record<string, unknown>>) : [];
        if (rawSteps.length === 0) {
          throw new Error('reinforcement_evaluate_trajectory requires a non-empty "steps" array describing the actual trajectory to evaluate.');
        }
        const steps: EpisodicStep[] = rawSteps.map((s, idx) => ({
          stepIndex: typeof s.stepIndex === 'number' ? (s.stepIndex as number) : idx,
          action: String(s.action || s.actionType || 'step'),
          toolName: s.toolName ? String(s.toolName) : undefined,
          durationMs: Number(s.durationMs) || 0,
          success: s.success !== false,
          error: s.error ? String(s.error) : undefined,
        }));
        const outcome = (['success', 'failure', 'partial'].includes(String(input.outcome)) ? input.outcome : 'success') as 'success' | 'failure' | 'partial';
        const evaluation = this.reinforcementEngine.evaluateTrajectory(String(input.goal), steps, outcome);
        return ok('reinforcement_evaluate_trajectory', evaluation);
      }
    );
  }
}
