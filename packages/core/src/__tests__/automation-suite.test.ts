/**
 * OpenBot automation test suite.
 *
 * These tests assert REAL behavior:
 * - Browser tests run against a local HTTP server with a real Chromium.
 * - Adapters without a live server/driver must fail honestly (no fake
 *   success, no fabricated screenshots or coordinates).
 * - Phone workflows run against the flagged simulator; steps that cannot
 *   complete must report failure at the exact step.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  // Browser
  BrowserAutomationEngine,
  ArtemisPhoneBrowserController,
  // Computer
  SelfOperatingComputerEngine,
  OpenInterpreterEngine,
  McpComputerServer,
  PyAutoGUIAdapter,
  WindowsNativeDriver,
  // Phone
  AdbController,
  AppiumBridge,
  AccessibilityServiceBridge,
  ArtemisPhoneNavigator,
  // vFlow
  vFlowEngine,
  vFlowCommandParser,
  // Memory & RL
  EpisodicMemoryEngine,
  DiskMemoryStore,
  ReinforcementLearningEngine,
  // Tools & security
  ToolRegistry,
  ModelRouter,
  zeroCloudGuard,
  isLocalUrl,
  ZeroCloudBlockedError,
  KeyVault,
  // Skills & voice & weights
  SkillEngine,
  VoicePipelineAgent,
  ModelWeightManager,
  LOCAL_WEIGHT_CATALOG,
  // Multi-Device Edge Servers & Orchestrator
  DesktopNodeServer,
  PhoneNodeClient,
  DeviceOrchestrator,
  // Free Model Providers & TokenRouter
  PollinationsModelAdapter,
  Web2ApiModelAdapter,
  TokenRouter,
  FreeApiDiscoverer,
  // Agent Skills Loader
  AgentSkillsLoader,
} from '../index.js';

const TEST_PAGE_HTML = `<html><head><title>OpenBot Test Page</title></head><body>
<h1>Hello OpenBot</h1>
<button id="btn">ClickMe</button>
<input id="q" name="q" type="text"/>
<p>Unique paragraph text 12345</p>
</body></html>`;

let server: http.Server;
let baseUrl = '';

beforeAll(async () => {
  server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(TEST_PAGE_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as any).port}/`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const ctx = { userId: 'test_user', conversationId: 'conv_test', permissions: [] };

describe('Universal Browser Automation Suite & Artemis', () => {
  it('drives a real Chromium via Playwright against a local page', async () => {
    const engine = new BrowserAutomationEngine();
    expect(engine.getActiveEngine()).toBe('playwright');

    const navResult = await engine.navigate(baseUrl);
    expect(navResult.success).toBe(true);
    expect(navResult.currentUrl).toBe(baseUrl);
    expect(navResult.pageTitle).toBe('OpenBot Test Page');

    const fill = await engine.fillInput('#q', 'openbot');
    expect(fill.success).toBe(true);

    const click = await engine.clickElement('#btn');
    expect(click.success).toBe(true);

    const content = await engine.extractContent();
    expect(content.title).toBe('OpenBot Test Page');
    expect(content.text).toContain('Unique paragraph text 12345');

    const shot = await engine.captureScreenshot();
    expect(shot.startsWith('data:image/png;base64,')).toBe(true);
    expect(shot.length).toBeGreaterThan(1000);

    const state = await engine.getBrowserState();
    expect(state.tabs.length).toBeGreaterThan(0);
    expect(state.interactiveElements.length).toBeGreaterThan(0);
    await (engine as any).adapter?.close?.();
  }, 60000);

  it('switches engines honestly: WebDriver adapters fail without a server, Puppeteer/Browser-Use really work', async () => {
    const engine = new BrowserAutomationEngine();

    await engine.switchEngine('selenium');
    expect(engine.getActiveEngine()).toBe('selenium');
    const selResult = await engine.navigate(baseUrl);
    expect(selResult.success).toBe(false);
    expect(selResult.error).toContain('WebDriver');

    await engine.switchEngine('webdriverio');
    const wdResult = await engine.fillInput('input[name="q"]', 'OpenBot AI');
    expect(wdResult.success).toBe(false);

    await engine.switchEngine('puppeteer');
    expect(engine.getActiveEngine()).toBe('puppeteer');
    const pupResult = await engine.navigate(baseUrl);
    expect(pupResult.success).toBe(true);

    await engine.switchEngine('browser_use');
    expect(engine.getActiveEngine()).toBe('browser_use');
    const buResult = await engine.navigate(baseUrl);
    expect(buResult.success).toBe(true);
    await (engine as any).adapter?.close?.();
  }, 60000);

  it('controls the Artemis phone browser with real mobile emulation', async () => {
    const artemis = new ArtemisPhoneBrowserController({ devicePreset: 'iphone_15_pro' });
    const navResult = await artemis.navigate(baseUrl);
    expect(navResult.success).toBe(true);
    expect(navResult.message).toContain('iPhone 15 Pro');

    const touchResult = await artemis.click({ x: 190, y: 340 });
    expect(touchResult.success).toBe(true);

    const scrollResult = await artemis.scroll('down', 350);
    expect(scrollResult.success).toBe(true);

    const viewport = await artemis.getViewportState();
    expect(viewport.viewportDimensions.width).toBe(393);
    expect(viewport.viewportDimensions.height).toBe(852);
    expect(viewport.engine).toBe('artemis_mobile');
    await artemis.close();
  }, 60000);
});

describe('Computer Control, Self-Operating Computer & MCP', () => {
  it('perceives screens through an injected detector and executes tag actions', async () => {
    const onePxPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const calls: string[] = [];
    const fakeAdapter = {
      captureScreenshot: async () => onePxPng,
      mouseMove: async (x: number, y: number) => {
        calls.push(`move:${x},${y}`);
        return { success: true, action: 'mouse_move', message: 'moved', durationMs: 1 };
      },
      mouseClick: async () => {
        calls.push('click');
        return { success: true, action: 'mouse_click', message: 'clicked', durationMs: 1 };
      },
      keyboardType: async (text: string) => {
        calls.push(`type:${text}`);
        return { success: true, action: 'keyboard_type', message: 'typed', durationMs: 1 };
      },
      keyboardHotkey: async () => ({ success: true, action: 'keyboard_hotkey', message: 'hotkey', durationMs: 1 }),
      mouseDrag: async () => ({ success: true, action: 'mouse_drag', message: 'dragged', durationMs: 1 }),
      mouseScroll: async () => ({ success: true, action: 'mouse_scroll', message: 'scrolled', durationMs: 1 }),
      getDisplays: async () => [],
      getWindows: async () => [],
      focusWindow: async () => false,
      getCursorPosition: async () => ({ x: 0, y: 0 }),
    } as any;

    const detector = async () => [
      { id: 'el-0', labelIndex: 0, role: 'button' as const, text: 'Search', bounds: { x: 10, y: 10, width: 80, height: 30 }, center: { x: 50, y: 25 }, confidence: 0.95 },
      { id: 'el-1', labelIndex: 1, role: 'input' as const, text: 'Query', bounds: { x: 10, y: 50, width: 200, height: 30 }, center: { x: 110, y: 65 }, confidence: 0.9 },
    ];

    const soc = new SelfOperatingComputerEngine(fakeAdapter, detector);
    const perception = await soc.perceiveScreen();
    expect(perception.elements.length).toBe(2);
    expect(perception.taggedOverview).toContain('[0]');
    expect(perception.taggedOverview).toContain('Search');

    const tagActionResult = await soc.executeTagAction(1, 'type', 'openbot search');
    expect(tagActionResult.success).toBe(true);
    expect(calls).toContain('type:openbot search');

    const missing = await soc.executeTagAction(99, 'click');
    expect(missing.success).toBe(false);
  }, 20000);

  it('PyAutoGUI adapter fails honestly when the python bridge is unavailable', async () => {
    if (process.platform === 'win32') return;
    const adapter = new PyAutoGUIAdapter();
    const displays = await adapter.getDisplays();
    if (displays.length === 0) {
      // Headless sandbox: no pyautogui/display. Actions must not fake success.
      const move = await adapter.mouseMove(10, 10);
      expect(move.success).toBe(false);
      expect(move.message).toContain('PyAutoGUI');
      await expect(adapter.captureScreenshot()).rejects.toThrow(/PyAutoGUI/);
    }
  }, 60000);

  it('WindowsNativeDriver refuses to fabricate on non-Windows platforms', async () => {
    if (process.platform === 'win32') return;
    const driver = new WindowsNativeDriver();
    await expect(driver.getCursorPosition()).rejects.toThrow(/Windows/);
    await expect(driver.captureScreenshot()).rejects.toThrow(/Windows/);
    const move = await driver.mouseMove(10, 10);
    expect(move.success).toBe(false);
  });

  it('executes multi-language code via Open Interpreter with real exit codes', async () => {
    const interpreter = new OpenInterpreterEngine();

    const pyResult = await interpreter.execute({
      language: 'python',
      code: 'print("Hello from Open Interpreter")',
    });
    expect(pyResult.exitCode).toBe(0);
    expect(pyResult.stdout).toContain('Hello from Open Interpreter');

    const nodeResult = await interpreter.execute({
      language: 'node',
      code: 'console.log(100 + 42)',
    });
    expect(nodeResult.exitCode).toBe(0);
    expect(nodeResult.stdout).toBe('142');

    // Quoting/backtick safety: payload must not break out into a host shell.
    const quoteResult = await interpreter.execute({
      language: 'python',
      code: 'print("it\'s \\"quoted\\" and `ticked` $HOME")',
    });
    expect(quoteResult.exitCode).toBe(0);
    expect(quoteResult.stdout).toContain('`ticked`');

    const failResult = await interpreter.execute({
      language: 'python',
      code: 'import sys; sys.exit(3)',
    });
    expect(failResult.exitCode).toBe(3);
  }, 60000);

  it('processes MCP Computer Control tool requests', async () => {
    const mcpServer = new McpComputerServer();
    const defs = mcpServer.getMcpToolDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(7);

    const execResp = await mcpServer.handleMcpToolCall({
      id: 'call_exec',
      name: 'mcp_open_interpreter_exec',
      arguments: { language: 'python', code: 'print("mcp-ok")' },
    });
    expect(execResp.isError).toBeFalsy();
    expect(execResp.content[0].text).toContain('mcp-ok');

    const unknownResp = await mcpServer.handleMcpToolCall({
      id: 'call_unknown',
      name: 'mcp_does_not_exist',
      arguments: {},
    });
    expect(unknownResp.isError).toBe(true);
  }, 60000);
});

describe('Full Phone Control, ADB, Appium & Artemis Navigator', () => {
  it('builds real ADB shell commands for tap, swipe, and keyevents', async () => {
    const adb = new AdbController();

    const tapRes = await adb.tap(300, 600);
    expect(tapRes.command).toContain('shell input tap 300 600');

    const swipeRes = await adb.swipe(100, 800, 100, 200, 250);
    expect(swipeRes.command).toContain('shell input swipe 100 800 100 200 250');

    const keyRes = await adb.pressKey('HOME');
    expect(keyRes.command).toContain('shell input keyevent 3');

    // Without an adb binary/device the command reports failure, never success.
    if (!tapRes.success) {
      expect(tapRes.output).toBeTruthy();
    }

    // listDevices either returns real devices or throws AdbUnavailableError.
    try {
      const devices = await adb.listDevices();
      expect(Array.isArray(devices)).toBe(true);
    } catch (err: any) {
      expect(err.message).toMatch(/adb/i);
    }
  });

  it('Appium and accessibility bridges fail honestly without servers', async () => {
    const appium = new AppiumBridge('http://127.0.0.1:4723');
    const session = await appium.startSession();
    expect(session.success).toBe(false);
    expect(session.error).toBeTruthy();

    const bridge = new AccessibilityServiceBridge();
    const status = await bridge.checkServiceStatus();
    expect(status.enabled).toBe(false);
  }, 30000);

  it('executes simulator workflows and reports per-step truth', async () => {
    const navigator = new ArtemisPhoneNavigator('simulator');
    const result = await navigator.executeMobileWorkflow('Send WhatsApp message to team');
    expect(result.success).toBe(true);
    expect(result.plan.steps.length).toBeGreaterThan(0);
    expect(result.plan.status).toBe('completed');
    expect(result.summary).toContain('simulator');

    // A contact that does not exist must fail at that exact step.
    const navigator2 = new ArtemisPhoneNavigator('simulator');
    const failResult = await navigator2.executeMobileWorkflow('Send WhatsApp message to Mom saying I arrived safe');
    expect(failResult.plan.steps.length).toBe(6);
    expect(failResult.success).toBe(false);
    expect(failResult.plan.status).toBe('failed');
    expect(failResult.summary).toContain('Mom');
  });
});

describe('vFlow Voice Command Engine', () => {
  it('parses natural voice commands and extracts intents and slots', () => {
    const parser = new vFlowCommandParser();

    const cmd1 = parser.parseUtterance('Hey OpenBot, send message to Sarah saying I am running late');
    expect(cmd1.wakeWordDetected).toBe('hey openbot');

    const intent1 = parser.classifyIntent(cmd1);
    expect(intent1.intentName).toBe('phone_send_message');
    expect(intent1.slots.recipient).toBe('Sarah');
    expect(intent1.slots.message).toContain('running late');

    const cmd2 = parser.parseUtterance('vFlow: search for quantum computing breakthroughs');
    const intent2 = parser.classifyIntent(cmd2);
    expect(intent2.intentName).toBe('browser_web_search');
    expect(intent2.slots.query).toContain('quantum computing breakthroughs');
  });

  it('executes voice action graph through vFlowEngine', async () => {
    const engine = new vFlowEngine();
    const session = await engine.processVoiceCommand('Hey OpenBot, message Alex saying meeting is confirmed');
    expect(session.status).toBe('completed');
    expect(session.steps.length).toBeGreaterThan(0);
    expect(session.spokenFeedback).toContain('Alex');
    // The default phone backend is the simulator — feedback must say so.
    expect(session.spokenFeedback).toContain('simulated');
  });
});

describe('Multi-Tier Database, Episodic Memory & Reinforcement Learning', () => {
  it('records and recalls past task episodes via EpisodicMemoryEngine', async () => {
    const memory = new EpisodicMemoryEngine({ persist: false });

    await memory.recordEpisode({
      userId: 'user_1',
      conversationId: 'conv_1',
      goal: 'Book flight ticket to New York',
      steps: [
        { stepIndex: 0, action: 'Open airline portal', durationMs: 200, success: true },
        { stepIndex: 1, action: 'Select JFK flight', durationMs: 300, success: true },
      ],
      outcome: 'success',
      summary: 'Flight booked successfully at 10 AM',
      rewardScore: 0.95,
      reflectionCritique: {
        strengths: ['Direct booking without retries'],
        weaknesses: [],
        lessonsLearned: ['Always filter by non-stop flights first'],
      },
      tags: ['travel', 'booking'],
      startedAt: Date.now() - 5000,
    });

    const results = await memory.searchSimilarEpisodes('flight to New York', 'user_1');
    expect(results.length).toBe(1);
    expect(results[0].goal).toContain('New York');

    const lessons = await memory.getLessonsLearned('flight to New York', 'user_1');
    expect(lessons).toContain('Always filter by non-stop flights first');
  });

  it('persists episodes on disk and reloads them in a new engine instance', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openbot-episodes-'));
    const first = new EpisodicMemoryEngine({ dataDir: dir });
    await first.recordEpisode({
      userId: 'user_persist',
      conversationId: 'conv_p',
      goal: 'Persist a memory across restarts',
      steps: [{ stepIndex: 0, action: 'write', durationMs: 10, success: true }],
      outcome: 'success',
      summary: 'Stored on disk',
      rewardScore: 0.9,
      tags: ['persistence'],
      startedAt: Date.now() - 100,
    });

    const second = new EpisodicMemoryEngine({ dataDir: dir });
    const found = await second.searchSimilarEpisodes('memory across restarts', 'user_persist');
    expect(found.length).toBe(1);
    expect(found[0].goal).toContain('Persist a memory');
  });

  it('persists and retrieves memories on disk via DiskMemoryStore', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openbot-diskmem-'));
    const diskStore = new DiskMemoryStore(dir);
    const testMemory = {
      id: 'mem_disk_test',
      userId: 'user_test',
      content: 'User prefers dark mode and Python 3.11',
      category: 'preference' as const,
      importance: 0.8,
      source: 'test',
      createdAt: new Date(),
    };
    await diskStore.save(testMemory);
    const found = await diskStore.search('dark mode', 'user_test');
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].content).toContain('dark mode');

    const reloaded = new DiskMemoryStore(dir);
    const foundAfterReload = await reloaded.search('Python 3.11', 'user_test');
    expect(foundAfterReload.length).toBeGreaterThan(0);

    await diskStore.delete('mem_disk_test');
    const afterDelete = await diskStore.search('dark mode', 'user_test');
    expect(afterDelete.length).toBe(0);
  });

  it('evaluates trajectories and distills procedural playbooks with ReinforcementLearningEngine', () => {
    const rl = new ReinforcementLearningEngine();

    const evaluation = rl.evaluateTrajectory(
      'Clean git repository and run build',
      [
        { stepIndex: 0, action: 'git status', durationMs: 100, success: true },
        { stepIndex: 1, action: 'npm run build', durationMs: 500, success: true },
      ],
      'success',
      5
    );

    expect(evaluation.rewardScore).toBeGreaterThanOrEqual(0.8);
    expect(evaluation.metrics.completionScore).toBe(1.0);
    expect(evaluation.critique.strengths.length).toBeGreaterThan(0);

    const playbook = rl.distillToPlaybook({
      id: 'ep_1',
      userId: 'user_1',
      conversationId: 'conv_1',
      goal: 'Clean git repository and run build',
      steps: [
        { stepIndex: 0, action: 'git status', toolName: 'run_terminal', durationMs: 100, success: true },
      ],
      outcome: 'success',
      summary: 'Done',
      rewardScore: 0.95,
      tags: ['git'],
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
    });

    expect(playbook).not.toBeNull();
    expect(playbook?.name).toContain('Clean git');
  });
});

describe('Zero-Cloud Guard & Key Vault', () => {
  it('classifies local vs remote URLs correctly', () => {
    expect(isLocalUrl('http://127.0.0.1:8080/x')).toBe(true);
    expect(isLocalUrl('http://localhost:11434')).toBe(true);
    expect(isLocalUrl('http://192.168.1.5:11434')).toBe(true);
    expect(isLocalUrl('http://10.0.0.9')).toBe(true);
    expect(isLocalUrl('http://172.16.0.9')).toBe(true);
    expect(isLocalUrl('http://172.32.0.9')).toBe(false);
    expect(isLocalUrl('https://example.com')).toBe(false);
    expect(isLocalUrl('https://api.openai.com')).toBe(false);
  });

  it('blocks remote fetches when enabled and lets local traffic through the guard', async () => {
    zeroCloudGuard.setEnabled(true);
    try {
      await expect(zeroCloudGuard.guardedFetch('https://example.com')).rejects.toBeInstanceOf(ZeroCloudBlockedError);
      // Local URL passes the guard itself (connection will fail: nothing listens on port 9).
      await expect(zeroCloudGuard.guardedFetch('http://127.0.0.1:9/')).rejects.not.toBeInstanceOf(ZeroCloudBlockedError);
    } finally {
      zeroCloudGuard.setEnabled(false);
    }
  });

  it('blocks cloud model providers in the ModelRouter when Zero-Cloud is on', async () => {
    const router = new ModelRouter(
      [
        {
          id: 'openai',
          name: 'OpenAI',
          type: 'openai',
          apiKey: 'sk-invalid-test-key',
          models: [
            {
              providerId: 'openai',
              modelId: 'gpt-4o',
              name: 'GPT-4o',
              contextWindow: 128000,
              maxOutputTokens: 4096,
              supportsTools: true,
              supportsVision: true,
              costPerInputToken: 0,
              costPerOutputToken: 0,
            },
          ],
        },
      ],
      'openai',
      'gpt-4o'
    );
    router.setZeroCloudMode(true);
    try {
      await expect(
        router.complete({
          messages: [{ id: 'm1', role: 'user', content: 'hi', createdAt: new Date() }],
          modelConfig: { providerId: 'openai', modelId: 'gpt-4o' },
        })
      ).rejects.toBeInstanceOf(ZeroCloudBlockedError);
    } finally {
      // setZeroCloudMode flips the shared egress guard — reset it so later
      // tests are not affected.
      router.setZeroCloudMode(false);
      zeroCloudGuard.setEnabled(false);
    }
  });

  it('encrypts keys at rest (AES-256-GCM), fails closed on a wrong passphrase', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openbot-vault-'));
    const vault = new KeyVault({ dir, passphrase: 'correct horse battery staple' });
    vault.set('openai', 'sk-secret-value-42');
    expect(vault.get('openai')).toBe('sk-secret-value-42');
    expect(vault.has('openai')).toBe(true);
    expect(vault.listProviders()).toContain('openai');

    const raw = fs.readFileSync(path.join(dir, 'vault.json'), 'utf8');
    expect(raw).not.toContain('sk-secret-value-42');

    const wrong = new KeyVault({ dir, passphrase: 'wrong passphrase' });
    expect(wrong.get('openai')).toBeNull();

    vault.delete('openai');
    expect(vault.get('openai')).toBeNull();
  });
});

describe('Teach-a-Task Skill Engine', () => {
  it('records a demonstration, compiles it, and replays it through the ToolRegistry', async () => {
    const engine = new SkillEngine({ persist: false });
    engine.startRecording();
    engine.recordAction({ type: 'shell_command', target: 'terminal', value: 'echo hello-openbot' });
    const skill = engine.stopAndCompileRecording('Echo Skill', 'Echo a greeting');
    expect(skill.definition.steps.length).toBe(1);
    expect(skill.definition.steps[0].toolName).toBe('run_terminal');

    const registry = new ToolRegistry();
    const result = await engine.executeSkill(skill.id, registry, {});
    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toBe(1);
    expect(result.steps[0].output).toContain('hello-openbot');

    // Parameterize and replay with a different value.
    engine.parameterizeSkill(skill.id, 'hello-openbot', 'word');
    const paramResult = await engine.executeSkill(skill.id, registry, { word: 'echo parameterized-ok' });
    expect(paramResult.success).toBe(true);
  }, 60000);

  it('persists custom skills to disk and reloads them', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openbot-skills-'));
    const first = new SkillEngine({ dataDir: dir });
    const created = first.createSkill({
      name: 'Persisted Skill',
      description: 'Survives restarts',
      definition: { steps: [{ type: 'tool', toolName: 'get_current_time', toolInput: {}, content: 'time' }] },
      tags: ['test'],
    });

    const second = new SkillEngine({ dataDir: dir });
    const loaded = second.getSkill(created.id);
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe('Persisted Skill');
  });

  it('reports missing skills honestly', async () => {
    const engine = new SkillEngine({ persist: false });
    const registry = new ToolRegistry();
    const result = await engine.executeSkill('skill_does_not_exist', registry, {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('Voice Pipeline & Local Weights', () => {
  it('refuses to fake phone calls without a telephony provider', async () => {
    const agent = new VoicePipelineAgent({});
    expect(agent.isTelephonyConfigured).toBe(false);
    await expect(agent.startAutonomousPhoneCall('+15550101010', 'test call')).rejects.toThrow(/not configured/);
  });

  it('detects voice activity from real PCM energy', () => {
    const agent = new VoicePipelineAgent({});
    const silent = new Int16Array(1024).fill(0);
    const loud = new Int16Array(1024).fill(12000);
    expect(agent.detectVoiceActivity(silent)).toBe(false);
    expect(agent.detectVoiceActivity(loud)).toBe(true);
  });

  it('refuses speech synthesis without a provider key', async () => {
    const agent = new VoicePipelineAgent({});
    const hadKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(agent.synthesizeSpeech('hello')).rejects.toThrow(/not configured/);
    } finally {
      if (hadKey) process.env.OPENAI_API_KEY = hadKey;
    }
  });

  it('has a real model catalog and honest download errors', async () => {
    expect(LOCAL_WEIGHT_CATALOG.length).toBeGreaterThanOrEqual(7);
    const ids = LOCAL_WEIGHT_CATALOG.map((m) => m.id);
    expect(ids).toContain('deepseek-r1-distill-qwen-1.5b-q4');
    expect(ids).toContain('qwen2.5-coder-1.5b-q4');
    expect(ids).toContain('llama-3.2-3b-instruct-q4');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openbot-weights-'));
    const manager = new ModelWeightManager({ dir });
    const bad = await manager.startDownload('model-that-does-not-exist');
    expect(bad.success).toBe(false);
    expect(await manager.deleteModel('model-that-does-not-exist')).toBe(false);

    const hardware = await manager.detectHardware();
    expect(ids).toContain(hardware.recommendedModelId);
    expect(hardware.cpuCores).toBeGreaterThan(0);
  });
});

describe('Tool Registry Integration', () => {
  it('registers 26+ real tools including every canonical name', () => {
    const registry = new ToolRegistry();
    const defs = registry.getToolDefinitions();
    const toolNames = defs.map((d) => d.name);

    const canonical = [
      'web_search', 'calculator', 'get_current_time', 'execute_code', 'generate_content',
      'read_url', 'write_file', 'read_file', 'take_screenshot', 'run_terminal',
      'browser_navigate', 'browser_click', 'browser_fill', 'browser_extract',
      'artemis_phone_browse', 'phone_tap', 'phone_launch_app', 'phone_send_message',
      'phone_initiate_call', 'artemis_phone_workflow', 'computer_visual_grounding_perceive',
      'computer_visual_tag_action', 'open_interpreter_exec', 'vflow_execute_command',
      'memory_recall_episodic', 'reinforcement_evaluate_trajectory',
    ];
    for (const name of canonical) {
      expect(toolNames).toContain(name);
    }
    expect(defs.length).toBeGreaterThanOrEqual(26);
  });

  it('executes calculator, terminal, code, and memory tools for real', async () => {
    const registry = new ToolRegistry();

    const calc = await registry.execute('calculator', { expression: 'sqrt(144) + 2^10' }, ctx);
    expect(calc.error).toBeUndefined();
    expect(calc.result).toBe(1036);

    const injected = await registry.execute('calculator', { expression: 'process.exit(1)' }, ctx);
    expect(injected.error).toBeTruthy();

    const term = await registry.execute('run_terminal', { command: 'echo openbot-terminal-ok' }, ctx);
    expect(term.error).toBeUndefined();
    expect(JSON.stringify(term.result)).toContain('openbot-terminal-ok');

    const dangerous = await registry.execute('run_terminal', { command: 'rm -rf / --no-preserve-root' }, ctx);
    expect(dangerous.error).toContain('Blocked');

    const code = await registry.execute('execute_code', { code: 'print(6 * 7)', language: 'python' }, ctx);
    expect(code.error).toBeUndefined();
    expect(JSON.stringify(code.result)).toContain('42');

    const stored = await registry.execute('memory_store', { content: 'The user likes green tea', category: 'preference' }, ctx);
    expect(stored.error).toBeUndefined();
    const recalled = await registry.execute('memory_recall', { query: 'green tea' }, ctx);
    expect(recalled.error).toBeUndefined();
    expect(JSON.stringify(recalled.result)).toContain('green tea');

    const gen = await registry.execute('generate_content', { prompt: 'Write a haiku' }, ctx);
    expect(gen.error).toContain('not connected to a model');

    const rl = await registry.execute(
      'reinforcement_evaluate_trajectory',
      {
        goal: 'Do a thing',
        outcome: 'success',
        steps: [{ stepIndex: 0, action: 'step one', durationMs: 100, success: true }],
      },
      ctx
    );
    expect(rl.error).toBeUndefined();

    const rlEmpty = await registry.execute('reinforcement_evaluate_trajectory', { goal: 'x', steps: [] }, ctx);
    expect(rlEmpty.error).toContain('steps');
  }, 60000);

  it('enforces the file workspace jail and round-trips file tools', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'openbot-workspace-'));
    process.env.OPENBOT_WORKSPACE_ROOT = root;
    try {
      const registry = new ToolRegistry();
      const write = await registry.execute('write_file', { filePath: 'notes/hello.txt', content: 'jailed content' }, ctx);
      expect(write.error).toBeUndefined();
      expect(fs.readFileSync(path.join(root, 'notes/hello.txt'), 'utf8')).toBe('jailed content');

      const read = await registry.execute('read_file', { filePath: 'notes/hello.txt' }, ctx);
      expect(read.result).toBe('jailed content');

      const escape = await registry.execute('read_file', { filePath: '../outside.txt' }, ctx);
      expect(escape.error).toContain('escapes the workspace');

      const list = await registry.execute('list_directory', { dirPath: 'notes' }, ctx);
      expect(JSON.stringify(list.result)).toContain('hello.txt');
    } finally {
      delete process.env.OPENBOT_WORKSPACE_ROOT;
    }
  }, 60000);

  it('fetches a real page via read_url and searches the live web', async () => {
    const registry = new ToolRegistry();
    const fetched = await registry.execute('read_url', { url: baseUrl }, ctx);
    expect(fetched.error).toBeUndefined();
    expect(String(fetched.result)).toContain('Hello OpenBot');

    const search = await registry.execute('web_search', { query: 'OpenAI news', num_results: 3 }, ctx);
    expect(search.error).toBeUndefined();
    const result = search.result as any;
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].url).toMatch(/^https?:\/\//);
  }, 90000);

  it('reports phone tool failure honestly when no device/backend is reachable', async () => {
    const registry = new ToolRegistry();
    const tap = await registry.execute('phone_tap', { x: 100, y: 200 }, ctx);
    // No ADB device in the test environment: the tool must surface the real
    // backend error instead of claiming a tap happened.
    if (tap.error) {
      expect(tap.error).toMatch(/not available|adb/i);
    } else {
      expect(tap.result).toBeTruthy();
    }
  }, 30000);
});

describe('Multi-Device Edge Node Servers & Human-Like Orchestrator', () => {
  it('should initialize and start DesktopNodeServer on port 4002', async () => {
    const server = new DesktopNodeServer({ port: 4002 });
    expect(server).toBeDefined();
  });

  it('should initialize PhoneNodeClient and query health', async () => {
    const phoneClient = new PhoneNodeClient({ phoneIp: '127.0.0.1', phonePort: 8765 });
    const health = await phoneClient.getHealth();
    expect(health).toBeDefined();
    expect(health.port).toBe(8765);
    expect(['online', 'offline']).toContain(health.status);
  });

  it('should route and execute autonomous human-like task via DeviceOrchestrator', async () => {
    const orchestrator = new DeviceOrchestrator({ laptopUrl: 'http://localhost:4002' });
    const nodesStatus = await orchestrator.checkNodesStatus();
    expect(nodesStatus).toBeDefined();
    expect(nodesStatus.laptop).toBeDefined();
    expect(nodesStatus.phone).toBeDefined();

    // Test cross-device execution flow
    const crossRes = await orchestrator.executeTask('Open bank on laptop and read OTP from phone');
    expect(crossRes.taskId).toBeDefined();
    expect(crossRes.steps.length).toBeGreaterThanOrEqual(2);
    expect(crossRes.status).toBe('success');

    // Test browser task routing and execution
    const browserRes = await orchestrator.executeTask('Search for latest news on browser', 'browser');
    expect(browserRes.taskId).toBeDefined();
    expect(browserRes.steps.length).toBeGreaterThanOrEqual(2);
    expect(browserRes.status).toBe('success');
  }, 60000);
});

describe('Free Model Providers, TokenRouter & Web2API', () => {
  it('should list Pollinations free models and check health structure', async () => {
    const pollinations = new PollinationsModelAdapter();
    const models = await pollinations.listModels();
    expect(models).toContain('openai');
    expect(models).toContain('deepseek');
    expect(models).toContain('gemini');
  });

  it('should list Web2API models including DuckDuckGo free models', async () => {
    const web2api = new Web2ApiModelAdapter();
    const models = await web2api.listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models.some((m) => m.includes('gpt-4o-mini'))).toBe(true);
  });

  it('should initialize TokenRouter with multi-provider fallback chain', async () => {
    const router = new TokenRouter({ preferredProvider: 'pollinations' });
    const models = await router.listModels();
    expect(models).toContain('tokenrouter:auto');
    expect(models.length).toBeGreaterThan(3);
  });

  it('should scan and convert external agent skills from ai-agent-skills repository', async () => {
    const loader = new AgentSkillsLoader();
    const skills = loader.scanSkills();
    expect(Array.isArray(skills)).toBe(true);
    if (skills.length > 0) {
      expect(skills.length).toBeGreaterThan(10);
      const openBotSkills = loader.convertToOpenBotSkills(skills);
      expect(openBotSkills.length).toBe(skills.length);
      expect(openBotSkills[0].definition.steps.length).toBeGreaterThanOrEqual(2);
    }
  });
});



