import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Browser
  BrowserAutomationEngine,
  ArtemisPhoneBrowserController,
  PlaywrightAdapter,
  PuppeteerAdapter,
  SeleniumAdapter,
  WebdriverIOAdapter,
  BrowserUseAdapter,
  // Computer
  SelfOperatingComputerEngine,
  OpenInterpreterEngine,
  McpComputerServer,
  PyAutoGUIAdapter,
  RobotJSAdapter,
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
  IndexedDBMemoryStore,
  DiskMemoryStore,
  CloudPrismaMemoryStore,
  ReinforcementLearningEngine,
  // Tools
  ToolRegistry,
} from '../index.js';

describe('Universal Browser Automation Suite & Artemis', () => {
  it('should initialize BrowserAutomationEngine and default to Playwright', async () => {
    const engine = new BrowserAutomationEngine();
    expect(engine.getActiveEngine()).toBe('playwright');

    const navResult = await engine.navigate('https://duckduckgo.com');
    expect(navResult.success).toBe(true);
    expect(navResult.currentUrl).toBe('https://duckduckgo.com');

    const state = await engine.getBrowserState();
    expect(state.tabs.length).toBeGreaterThan(0);
    expect(state.interactiveElements.length).toBeGreaterThan(0);
  });

  it('should dynamically switch between Puppeteer, Selenium, WebdriverIO, and Browser-Use', async () => {
    const engine = new BrowserAutomationEngine();

    // Switch to Puppeteer
    await engine.switchEngine('puppeteer');
    expect(engine.getActiveEngine()).toBe('puppeteer');
    const pupResult = await engine.navigate('https://example.com');
    expect(pupResult.success).toBe(true);

    // Switch to Selenium
    await engine.switchEngine('selenium');
    expect(engine.getActiveEngine()).toBe('selenium');
    const selResult = await engine.clickElement('button#login');
    expect(selResult.success).toBe(true);

    // Switch to WebdriverIO
    await engine.switchEngine('webdriverio');
    expect(engine.getActiveEngine()).toBe('webdriverio');
    const wdResult = await engine.fillInput('input[name="search"]', 'OpenBot AI');
    expect(wdResult.success).toBe(true);

    // Switch to Browser-Use
    await engine.switchEngine('browser_use');
    expect(engine.getActiveEngine()).toBe('browser_use');
    const buResult = await engine.navigate('https://github.com/trending');
    expect(buResult.success).toBe(true);
  });

  it('should control Artemis Phone Browser with mobile viewports and touch gestures', async () => {
    const artemis = new ArtemisPhoneBrowserController({ devicePreset: 'iphone_15_pro' });
    const navResult = await artemis.navigate('https://news.ycombinator.com');
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
  });
});

describe('Computer Control, Self-Operating Computer & MCP', () => {
  it('should run Self-Operating Computer visual grounding perception', async () => {
    const soc = new SelfOperatingComputerEngine();
    const perception = await soc.perceiveScreen();

    expect(perception.elements.length).toBeGreaterThan(0);
    expect(perception.taggedOverview).toContain('[0]');

    const tagActionResult = await soc.executeTagAction(1, 'type', 'openbot search');
    expect(tagActionResult.success).toBe(true);
  });

  it('should execute multi-language code via Open Interpreter', async () => {
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
  });

  it('should query real cursor coordinates via WindowsNativeDriver', async () => {
    const driver = new WindowsNativeDriver();
    const pos = await driver.getCursorPosition();
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.y).toBeGreaterThanOrEqual(0);
  });

  it('should process MCP Computer Control tool requests', async () => {
    const mcpServer = new McpComputerServer();
    const defs = mcpServer.getMcpToolDefinitions();
    expect(defs.length).toBeGreaterThanOrEqual(7);

    // Call screenshot tool
    const shotResp = await mcpServer.handleMcpToolCall({
      id: 'call_1',
      name: 'mcp_computer_screenshot',
      arguments: { displayIndex: 0 },
    });
    expect(shotResp.isError).toBeFalsy();
    expect(shotResp.content.length).toBe(2);

    // Call mouse click tool
    const clickResp = await mcpServer.handleMcpToolCall({
      id: 'call_2',
      name: 'mcp_computer_mouse_click',
      arguments: { x: 500, y: 500, button: 'left' },
    });
    expect(clickResp.isError).toBeFalsy();
  });
});

describe('Full Phone Control, ADB, Appium & Artemis Navigator', () => {
  it('should generate ADB shell commands for tap, swipe, and keyevents', async () => {
    const adb = new AdbController();
    await adb.listDevices();

    const tapRes = await adb.tap(300, 600);
    expect(tapRes.command).toContain('shell input tap 300 600');

    const swipeRes = await adb.swipe(100, 800, 100, 200, 250);
    expect(swipeRes.command).toContain('shell input swipe 100 800 100 200 250');

    const keyRes = await adb.pressKey('HOME');
    expect(keyRes.command).toContain('shell input keyevent 3');
  });

  it('should execute autonomous mobile workflows via ArtemisPhoneNavigator', async () => {
    const navigator = new ArtemisPhoneNavigator('simulator');
    const result = await navigator.executeMobileWorkflow('Send WhatsApp message to team');

    expect(result.success).toBe(true);
    expect(result.plan.steps.length).toBeGreaterThan(0);
    expect(result.plan.status).toBe('completed');
  });
});

describe('vFlow Voice Command Engine', () => {
  it('should parse natural voice commands and extract intents and slots', () => {
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

  it('should execute voice action graph through vFlowEngine', async () => {
    const engine = new vFlowEngine();
    const session = await engine.processVoiceCommand('Hey OpenBot, message Alex saying meeting is confirmed');

    expect(session.status).toBe('completed');
    expect(session.steps.length).toBeGreaterThan(0);
    expect(session.spokenFeedback).toContain('Alex');
  });
});

describe('Multi-Tier Database, Episodic Memory & Reinforcement Learning', () => {
  it('should record and recall past task episodes via EpisodicMemoryEngine', async () => {
    const memory = new EpisodicMemoryEngine();

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

  it('should persist and retrieve memories on disk via DiskMemoryStore', async () => {
    const diskStore = new DiskMemoryStore();
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
    await diskStore.delete('mem_disk_test');
  });

  it('should evaluate trajectories and distill procedural playbooks with ReinforcementLearningEngine', () => {
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

describe('Tool Registry Integration', () => {
  it('should have all browser, phone, computer, vflow, and reinforcement tools registered and callable', async () => {
    const registry = new ToolRegistry();
    const defs = registry.getToolDefinitions();
    const toolNames = defs.map((d) => d.name);

    expect(toolNames).toContain('browser_navigate');
    expect(toolNames).toContain('browser_click');
    expect(toolNames).toContain('artemis_phone_browse');
    expect(toolNames).toContain('phone_tap');
    expect(toolNames).toContain('phone_launch_app');
    expect(toolNames).toContain('artemis_phone_workflow');
    expect(toolNames).toContain('computer_visual_grounding_perceive');
    expect(toolNames).toContain('open_interpreter_exec');
    expect(toolNames).toContain('vflow_execute_command');
    expect(toolNames).toContain('memory_recall_episodic');
    expect(toolNames).toContain('reinforcement_evaluate_trajectory');

    // Test execution of a tool
    const execRes = await registry.execute(
      'vflow_execute_command',
      { utterance: 'Hey OpenBot, search for latest AI news' },
      { userId: 'test_user', conversationId: 'conv_1', permissions: [] }
    );
    expect(execRes.error).toBeUndefined();
    expect(execRes.result).toBeDefined();
  });
});
