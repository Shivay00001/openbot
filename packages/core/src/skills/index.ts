/**
 * OpenBot Skill Engine & Teach-a-Task Recorder ⚡
 * Canonical skill model lives in ../types (Skill / SkillDefinition /
 * SkillStep / SkillTrigger). This engine provides:
 * - A built-in skill library whose steps reference REAL tools.
 * - Teach-a-Task recording: startRecording → recordAction →
 *   stopAndCompileRecording compiles a demonstration into an executable
 *   skill (recorded action types map to the tools that replay them).
 * - REAL replay: executeSkill runs each step through the ToolRegistry —
 *   `tool` steps invoke their tool with `{{param}}` substitution, `prompt`
 *   steps invoke the generate_content tool.
 * - Persistence of custom skills to `.openbot_data/skills.json` in Node
 *   (silently disabled in browser bundles where fs is unavailable).
 * - Import/export for sharing skills as JSON.
 */

import { v4 as uuid } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import type { Skill, SkillDefinition, SkillStep, SkillTrigger } from '../types/index.js';
import { AgentSkillsLoader, type DiscoveredAgentSkill } from './agent-skills-loader.js';

export type { Skill, SkillDefinition, SkillStep, SkillTrigger } from '../types/index.js';
export { AgentSkillsLoader };
export type { DiscoveredAgentSkill };
import type { ToolRegistry } from '../tools/index.js';
import type { ToolExecutionContext } from '../types/index.js';

// ─── Recording Types ────────────────────────────────────────────

export interface RecordedAction {
  timestamp: number;
  type: 'browser_click' | 'browser_fill' | 'phone_tap' | 'shell_command' | 'model_prompt' | string;
  target: string;
  value?: string;
  metadata?: Record<string, unknown>;
}

export interface SkillExecutionResult {
  skillId: string;
  success: boolean;
  stepsExecuted: number;
  steps: Array<{
    stepIndex: number;
    type: string;
    toolName?: string;
    success: boolean;
    output: string;
    error?: string;
  }>;
  error?: string;
}

export interface SkillEngineOptions {
  /** Persist custom skills to disk (Node only; default true). */
  persist?: boolean;
  /** Directory for the skills file (default <cwd>/.openbot_data). */
  dataDir?: string;
  /** Owner id assigned to newly created skills. */
  userId?: string;
}

// ─── Built-in Skill Library (steps reference real tools) ────────

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: 'skill_daily_briefing',
    userId: 'system',
    name: 'Morning Intelligence Briefing',
    description: 'Searches the web for trending AI news on a topic and synthesizes an executive briefing with the connected model.',
    isPublic: true,
    tags: ['news', 'research', 'daily'],
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    definition: {
      triggers: [{ type: 'cron', value: '0 8 * * *' }],
      steps: [
        { type: 'tool', toolName: 'web_search', toolInput: { query: '{{topic}} latest news', num_results: 5 }, content: 'Search top news about {{topic}}' },
        { type: 'prompt', content: 'Synthesize the findings into 5 crisp executive bullet points with actionable takeaways about {{topic}}.' },
      ],
    },
  },
  {
    id: 'skill_phone_meeting_booking',
    userId: 'system',
    name: 'Agentic Phone Appointment Booker',
    description: 'Opens the phone dialer app on the connected phone so the agent can place a booking call.',
    isPublic: true,
    tags: ['phone', 'productivity', 'agentic-phone-mode'],
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    definition: {
      triggers: [{ type: 'manual', value: 'call_booking' }],
      steps: [
        { type: 'tool', toolName: 'phone_launch_app', toolInput: { appName: 'Phone' }, content: 'Open Phone dialer' },
        { type: 'prompt', content: 'Inquire about availability for Friday 7 PM and verify the confirmation code.' },
      ],
    },
  },
  {
    id: 'skill_github_repo_audit',
    userId: 'system',
    name: 'Autonomous Codebase Security Audit',
    description: 'Runs git status and npm audit in the workspace and asks the model to summarize critical findings.',
    isPublic: true,
    tags: ['coding', 'security', 'desktop-agent'],
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    definition: {
      triggers: [{ type: 'manual', value: 'audit_repo' }],
      steps: [
        { type: 'tool', toolName: 'run_terminal', toolInput: { command: 'git status --short && npm audit --json 2>/dev/null | head -c 6000 || true' }, content: 'Run audit commands' },
        { type: 'prompt', content: 'Parse the audit output, detect critical security CVEs, and format mitigation instructions.' },
      ],
    },
  },
  {
    id: 'skill_phone_hardware_diagnostics',
    userId: 'system',
    name: 'Real Phone & ADB Automation Diagnostics',
    description: 'Checks the ADB device list via the host terminal and captures a phone screenshot through the active backend.',
    isPublic: true,
    tags: ['phone', 'diagnostics', 'hardware', 'agentic-phone-mode'],
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    definition: {
      triggers: [{ type: 'manual', value: 'phone_test' }],
      steps: [
        { type: 'tool', toolName: 'run_terminal', toolInput: { command: 'adb devices' }, content: 'Scan USB and Wi-Fi ADB devices' },
        { type: 'tool', toolName: 'phone_screenshot', toolInput: {}, content: 'Capture live phone screenshot' },
      ],
    },
  },
];

/** Recorded action types → the tool + input that replays them. */
function recordedActionToStep(act: RecordedAction): SkillStep {
  switch (act.type) {
    case 'browser_click':
      return { type: 'tool', toolName: 'browser_click', toolInput: { selector: act.target }, content: `Click ${act.target}` };
    case 'browser_fill':
      return { type: 'tool', toolName: 'browser_fill', toolInput: { selector: act.target, value: act.value || '' }, content: `Fill ${act.target}` };
    case 'phone_tap': {
      const [x, y] = String(act.target).split(',').map((n) => Number(n.trim()));
      return {
        type: 'tool',
        toolName: 'phone_tap',
        toolInput: { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 },
        content: `Tap at ${act.target}`,
      };
    }
    case 'shell_command':
      return { type: 'tool', toolName: 'run_terminal', toolInput: { command: act.value || act.target }, content: `Run ${act.value || act.target}` };
    case 'model_prompt':
      return { type: 'prompt', content: act.value || act.target };
    default:
      return {
        type: 'tool',
        toolName: act.type,
        toolInput: { target: act.target, value: act.value },
        content: `Execute ${act.type} on ${act.target}`,
      };
  }
}

function substituteParams(value: unknown, params: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, name) => {
      const replacement = params[name];
      return replacement === undefined ? '' : String(replacement);
    });
  }
  if (Array.isArray(value)) return value.map((v) => substituteParams(v, params));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteParams(v, params);
    }
    return out;
  }
  return value;
}

function fsAvailable(): boolean {
  return typeof fs.existsSync === 'function' && typeof window === 'undefined';
}

// ─── Skill Engine ───────────────────────────────────────────────

export class SkillEngine {
  private skills: Map<string, Skill> = new Map();
  private triggers: Map<string, SkillTrigger & { skillId: string }> = new Map();
  private isRecording = false;
  private currentRecordedActions: RecordedAction[] = [];
  private readonly persist: boolean;
  private readonly skillsFile: string;
  private readonly userId: string;

  constructor(options: SkillEngineOptions = {}) {
    this.persist = options.persist ?? true;
    this.userId = options.userId || 'user';
    const dir = options.dataDir || path.resolve(process.cwd(), '.openbot_data');
    this.skillsFile = path.join(dir, 'skills.json');
    for (const skill of BUILTIN_SKILLS) {
      this.skills.set(skill.id, skill);
    }
    if (this.persist) this.loadPersistedSkills();
  }

  // ─── Persistence ────────────────────────────────────────────

  private loadPersistedSkills(): void {
    if (!fsAvailable()) return;
    try {
      if (!fs.existsSync(this.skillsFile)) return;
      const parsed = JSON.parse(fs.readFileSync(this.skillsFile, 'utf8')) as any[];
      for (const raw of parsed) {
        if (!raw || !raw.id) continue;
        const skill: Skill = {
          ...raw,
          createdAt: new Date(raw.createdAt),
          updatedAt: new Date(raw.updatedAt),
        };
        this.skills.set(skill.id, skill);
      }
    } catch {
      // Corrupt skills file — start from built-ins rather than crash.
    }
  }

  private persistCustomSkills(): void {
    if (!this.persist || !fsAvailable()) return;
    try {
      fs.mkdirSync(path.dirname(this.skillsFile), { recursive: true });
      const custom = Array.from(this.skills.values()).filter((s) => s.userId !== 'system');
      fs.writeFileSync(this.skillsFile, JSON.stringify(custom, null, 2));
    } catch {
      // Persistence failure must not break skill execution.
    }
  }

  // ─── CRUD ───────────────────────────────────────────────────

  /**
   * Dynamically loads all 176+ skills from the user's ai-agent-skills repository
   */
  loadAgentSkillsRepo(repoPath?: string): number {
    const loader = new AgentSkillsLoader(repoPath);
    const discovered = loader.scanSkills();
    const converted = loader.convertToOpenBotSkills(discovered);
    for (const skill of converted) {
      this.skills.set(skill.id, skill);
    }
    return converted.length;
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  createSkill(data: {
    name: string;
    description: string;
    definition: SkillDefinition;
    tags?: string[];
    isPublic?: boolean;
    userId?: string;
  }): Skill {
    const now = new Date();
    const skill: Skill = {
      id: uuid(),
      userId: data.userId || this.userId,
      name: data.name,
      description: data.description,
      definition: data.definition,
      isPublic: data.isPublic ?? false,
      tags: data.tags || [],
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.skills.set(skill.id, skill);
    this.persistCustomSkills();
    return skill;
  }

  updateSkill(id: string, updates: Partial<Skill>): Skill | null {
    const skill = this.skills.get(id);
    if (!skill) return null;
    Object.assign(skill, updates, { updatedAt: new Date() });
    this.skills.set(id, skill);
    this.persistCustomSkills();
    return skill;
  }

  deleteSkill(id: string): boolean {
    const deleted = this.skills.delete(id);
    if (deleted) this.persistCustomSkills();
    return deleted;
  }

  // ─── Teach-a-Task Recording ─────────────────────────────────

  startRecording(): void {
    this.isRecording = true;
    this.currentRecordedActions = [];
  }

  recordAction(action: Omit<RecordedAction, 'timestamp'>): void {
    if (!this.isRecording) return;
    this.currentRecordedActions.push({ ...action, timestamp: Date.now() });
  }

  /**
   * Finish recording and compile the demonstration into an executable skill.
   * Steps reference the real tools that replay each recorded action.
   */
  stopAndCompileRecording(name: string, description: string): Skill {
    this.isRecording = false;
    const steps = this.currentRecordedActions.map(recordedActionToStep);
    this.currentRecordedActions = [];
    return this.createSkill({
      name,
      description,
      tags: ['custom', 'recorded'],
      definition: {
        triggers: [{ type: 'manual', value: 'trigger' }],
        steps,
      },
    });
  }

  /**
   * Parameterize a skill: replace a concrete value inside step inputs (or
   * prompt contents) with a {{paramName}} placeholder for later replay.
   */
  parameterizeSkill(skillId: string, concreteValue: string, paramName: string): Skill | null {
    const skill = this.skills.get(skillId);
    if (!skill) return null;
    for (const step of skill.definition.steps) {
      if (step.toolInput) {
        step.toolInput = substituteParamsReverse(step.toolInput, concreteValue, paramName);
      }
      if (typeof step.content === 'string' && step.content.includes(concreteValue)) {
        step.content = step.content.split(concreteValue).join(`{{${paramName}}}`);
      }
    }
    skill.updatedAt = new Date();
    this.skills.set(skill.id, skill);
    this.persistCustomSkills();
    return skill;
  }

  // ─── Execution (real replay through the ToolRegistry) ───────

  /**
   * Execute a skill for real. `tool` steps run their tool through the
   * registry; `prompt` steps run the generate_content tool (wired to the
   * agent's model by OpenBotAgent). `{{param}}` placeholders in inputs and
   * prompt contents are substituted from `params`. Stops at the first
   * failing step and reports exactly what happened.
   */
  async executeSkill(
    skillId: string,
    toolRegistry: ToolRegistry,
    params: Record<string, unknown> = {},
    context?: Partial<ToolExecutionContext>
  ): Promise<SkillExecutionResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return { skillId, success: false, stepsExecuted: 0, steps: [], error: `Skill ${skillId} not found` };
    }

    const execContext: ToolExecutionContext = {
      userId: context?.userId || skill.userId,
      conversationId: context?.conversationId || `skill:${skillId}`,
      permissions: context?.permissions || [],
      abortSignal: context?.abortSignal,
    };

    const stepResults: SkillExecutionResult['steps'] = [];
    const steps = skill.definition.steps || [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.type === 'condition') {
        const conditionKey = step.condition || '';
        if (!params[conditionKey]) {
          stepResults.push({
            stepIndex: i,
            type: 'condition',
            success: true,
            output: `Condition "${conditionKey}" not met — remaining steps skipped.`,
          });
          return { skillId, success: true, stepsExecuted: stepResults.length, steps: stepResults };
        }
        stepResults.push({ stepIndex: i, type: 'condition', success: true, output: `Condition "${conditionKey}" met.` });
        continue;
      }
      if (step.type === 'loop') {
        stepResults.push({
          stepIndex: i,
          type: 'loop',
          success: false,
          output: '',
          error: 'Loop steps are not supported by the skill executor yet.',
        });
        return { skillId, success: false, stepsExecuted: stepResults.length, steps: stepResults, error: `Step ${i} is a loop step, which is not supported yet.` };
      }

      const isPrompt = step.type === 'prompt';
      const toolName = isPrompt ? 'generate_content' : step.toolName;
      if (!toolName) {
        stepResults.push({ stepIndex: i, type: step.type, success: false, output: '', error: 'Tool step is missing toolName.' });
        return { skillId, success: false, stepsExecuted: stepResults.length, steps: stepResults, error: `Step ${i} has no toolName.` };
      }

      const input = isPrompt
        ? { prompt: String(substituteParams(step.content, params)) }
        : (substituteParams(step.toolInput || {}, params) as Record<string, unknown>);

      const result = await toolRegistry.execute(toolName, input, execContext);
      const failed = Boolean(result.error);
      stepResults.push({
        stepIndex: i,
        type: step.type,
        toolName,
        success: !failed,
        output: result.result === null || result.result === undefined ? '' : typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
        error: result.error,
      });
      if (failed) {
        return {
          skillId,
          success: false,
          stepsExecuted: stepResults.length,
          steps: stepResults,
          error: `Step ${i} (${toolName}) failed: ${result.error}`,
        };
      }
    }

    skill.usageCount += 1;
    skill.updatedAt = new Date();
    this.skills.set(skill.id, skill);
    if (skill.userId !== 'system') this.persistCustomSkills();

    return { skillId, success: true, stepsExecuted: stepResults.length, steps: stepResults };
  }

  // ─── Triggers ───────────────────────────────────────────────

  scheduleTrigger(skillId: string, trigger: SkillTrigger): SkillTrigger {
    this.triggers.set(`${skillId}:${trigger.type}:${trigger.value}`, { ...trigger, skillId });
    return trigger;
  }

  getAllTriggers(): Array<SkillTrigger & { skillId: string }> {
    return Array.from(this.triggers.values());
  }

  // ─── Import / Export ────────────────────────────────────────

  exportSkill(skillId: string): string | null {
    const skill = this.skills.get(skillId);
    if (!skill) return null;
    return JSON.stringify(skill, null, 2);
  }

  importSkill(jsonString: string): Skill {
    const parsed = JSON.parse(jsonString) as Skill;
    if (!parsed || typeof parsed !== 'object' || !parsed.definition || !Array.isArray(parsed.definition.steps)) {
      throw new Error('Invalid skill export: expected an object with definition.steps.');
    }
    return this.createSkill({
      name: parsed.name || 'Imported Skill',
      description: parsed.description || '',
      definition: parsed.definition,
      tags: [...(parsed.tags || []), 'imported'],
      isPublic: false,
    });
  }
}

function substituteParamsReverse(value: unknown, concrete: string, paramName: string): Record<string, unknown> {
  if (typeof value === 'string') {
    return value.split(concrete).join(`{{${paramName}}}`) as unknown as Record<string, unknown>;
  }
  if (Array.isArray(value)) {
    return value.map((v) => substituteParamsReverse(v, concrete, paramName)) as unknown as Record<string, unknown>;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = substituteParamsReverse(v, concrete, paramName);
    }
    return out;
  }
  return value as Record<string, unknown>;
}
