import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  ToolRegistry,
  EpisodicMemoryEngine,
  ReinforcementLearningEngine,
  type ToolExecutionContext,
} from '@openbot/core';

const execAsync = promisify(exec);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// Persistent core singletons
const toolRegistry = new ToolRegistry();
const episodicMemory = new EpisodicMemoryEngine();
const reinforcement = new ReinforcementLearningEngine();

interface RecordedToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  error?: string;
  durationMs?: number;
}

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      messages = [],
      model = 'deepseek-r1-distill-qwen-1.5b-q4',
      isZeroCloud = true,
      apiKeys = {},
    } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const startTime = Date.now();
    let thinking = '';
    const toolCalls: RecordedToolCall[] = [];
    let replyContent = '';
    const lower = message.toLowerCase().trim();

    const toolContext: ToolExecutionContext = {
      userId: 'default_user',
      conversationId: 'openbot_chat_session',
      permissions: [
        { id: 'perm-1', userId: 'default_user', toolName: 'open_interpreter_exec', action: 'always_allow', createdAt: new Date() },
        { id: 'perm-2', userId: 'default_user', toolName: 'run_terminal', action: 'always_allow', createdAt: new Date() },
        { id: 'perm-3', userId: 'default_user', toolName: 'execute_code', action: 'always_allow', createdAt: new Date() },
        { id: 'perm-4', userId: 'default_user', toolName: 'browser_navigate', action: 'always_allow', createdAt: new Date() },
        { id: 'perm-5', userId: 'default_user', toolName: 'vflow_execute_command', action: 'always_allow', createdAt: new Date() },
        { id: 'perm-6', userId: 'default_user', toolName: 'phone_tap', action: 'always_allow', createdAt: new Date() },
      ],
    };

    const runTool = async (name: string, args: Record<string, unknown>) => {
      const res = await toolRegistry.execute(name, args, toolContext);
      toolCalls.push({ name, args, result: res.result, error: res.error, durationMs: res.durationMs });
      return res;
    };

    // ─── 1. Intent-routed real tool execution ────────────────────

    // A. Python / Code Execution Intent
    if (lower.startsWith('python') || lower.includes('run python') || lower.includes('exec python') || (lower.includes('print(') && lower.includes(')'))) {
      const code = message.replace(/^(run\s+python|python|exec\s+python):?/i, '').trim();
      thinking = `[ReAct Step 1: Open Interpreter Code Execution]\n• Language: Python 3\n• Sandbox: Real host process invocation\n• Code: ${code}`;

      const toolRes = await runTool('open_interpreter_exec', { language: 'python', code });
      const resObj = toolRes.result as { stdout?: string; stderr?: string; exitCode?: number } | null;
      replyContent += `🐍 **Executed Python Code**:\n\`\`\`python\n${code}\n\`\`\`\n\n`;
      if (toolRes.error) {
        replyContent += `**Tool error**: ${toolRes.error}\n\n`;
      }
      if (resObj?.stdout) {
        replyContent += `**Output**:\n\`\`\`text\n${resObj.stdout.trim()}\n\`\`\`\n\n`;
      }
      if (resObj?.stderr) {
        replyContent += `**Stderr**:\n\`\`\`text\n${resObj.stderr.trim()}\n\`\`\`\n\n`;
      }
      if (resObj && resObj.exitCode !== 0 && !resObj.stderr) {
        replyContent += `**Exit code**: ${resObj.exitCode}\n\n`;
      }
    }

    // B. Terminal Execution Intent (real host shell via the tool registry)
    else if (lower.startsWith('pwsh') || lower.startsWith('powershell') || lower.includes('git status') || lower.startsWith('dir') || lower.includes('node -v') || lower.startsWith('terminal:') || lower.startsWith('run:')) {
      const cmdToRun = message.replace(/^(run|terminal|pwsh|powershell):?/i, '').trim() || (lower.includes('git') ? 'git status' : 'dir');
      thinking = `[ReAct Step 1: Real Host Terminal Subprocess]\n• Command: "${cmdToRun}"`;

      const toolRes = await runTool('run_terminal', { command: cmdToRun });
      const resObj = toolRes.result as { stdout?: string; stderr?: string; exitCode?: number } | null;
      if (toolRes.error) {
        replyContent += `💻 **Terminal command** \`${cmdToRun}\` failed: ${toolRes.error}\n\n`;
      } else {
        replyContent += `💻 **Executed Host Shell Command** \`${cmdToRun}\` (exit ${resObj?.exitCode ?? '?'}):\n\`\`\`text\n${resObj?.stdout?.trim() || resObj?.stderr?.trim() || '[no output]'}\n\`\`\`\n\n`;
      }
    }

    // C. Web URL Navigation / Live Extraction Intent
    else if (lower.includes('http://') || lower.includes('https://') || lower.startsWith('browse ') || lower.startsWith('read url ')) {
      const urlMatch = message.match(/https?:\/\/[^\s]+/i);
      const targetUrl = urlMatch ? urlMatch[0] : 'https://news.ycombinator.com';

      thinking = `[ReAct Step 1: Universal Browser Automation]\n• Target: ${targetUrl}\n• Engine: Playwright / Live DOM Extractor`;

      const toolRes = await runTool('read_url', { url: targetUrl });
      if (toolRes.error) {
        replyContent += `🌐 **Live Web Extractor** could not load \`${targetUrl}\`: ${toolRes.error}\n\n`;
      } else {
        const text = typeof toolRes.result === 'string' ? toolRes.result : JSON.stringify(toolRes.result);
        replyContent += `🌐 **Live Web Extractor Loaded** \`${targetUrl}\`:\n\n> ${text.substring(0, 1500)}...\n\n`;
      }
    }

    // D. Phone / ADB Control Intent — reports the real `adb devices` output
    else if (lower.includes('phone') || lower.includes('adb') || lower.includes('device') || lower.includes('tap ') || lower.includes('launch app')) {
      thinking = `[ReAct Step 1: Agentic Phone Hardware Bridge]\n• Probe: adb devices -l`;

      try {
        const { stdout } = await execAsync('adb devices -l');
        const lines = stdout.split('\n').filter((l) => l.trim() && !l.startsWith('*') && !l.startsWith('List of'));
        toolCalls.push({
          name: 'adb_scan_devices',
          args: { command: 'adb devices -l' },
          result: { deviceCount: lines.length, devices: lines },
        });

        if (lines.length > 0) {
          replyContent += `📱 **Android Device(s) Attached** (${lines.length}):\n${lines.map((l) => `- ${l}`).join('\n')}\n\n`;
        } else {
          replyContent += `📱 **ADB Hardware Status**: \`adb devices\` reports no attached devices. Connect a phone via USB or run \`adb connect <phone-ip>:5555\`. Phone tools will use the flagged simulator until a real device is attached.\n\n`;
        }
      } catch (err: unknown) {
        toolCalls.push({
          name: 'adb_scan_devices',
          args: { command: 'adb devices -l' },
          result: null,
          error: String(err),
        });
        replyContent += `📱 **ADB Hardware Status**: the \`adb\` binary is not available on this host (${err instanceof Error ? err.message : String(err)}). Install Android platform-tools to use real phone control; the flagged simulator remains available.\n\n`;
      }
    }

    // E. vFlow Voice Workflow Intent
    else if (lower.includes('voice') || lower.includes('vflow') || lower.includes('call ') || lower.includes('schedule appointment')) {
      thinking = `[ReAct Step 1: vFlow Voice Command Graph]\n• Utterance: "${message}"`;

      const toolRes = await runTool('vflow_execute_command', { utterance: message });
      const session = toolRes.result as { status?: string; spokenFeedback?: string } | null;
      if (toolRes.error) {
        replyContent += `🎙️ **vFlow** failed: ${toolRes.error}\n\n`;
      } else {
        replyContent += `🎙️ **vFlow Workflow Result**:\n`;
        replyContent += `- **Status**: ${session?.status || 'unknown'}\n`;
        replyContent += `- **Feedback**: "${session?.spokenFeedback || 'No feedback returned.'}"\n\n`;
      }
    }

    // F. Memory Recall / Episodic Intent
    else if (lower.includes('memory') || lower.includes('recall') || lower.includes('past task') || lower.includes('history')) {
      thinking = `[ReAct Step 1: Persistent Episodic Memory & Trajectory Search]\n• Query: "${message}"`;

      const toolRes = await runTool('memory_recall_episodic', { goal: message });
      const memRes = toolRes.result as { episodes?: Array<{ goal: string; outcome: string }>; lessons?: string[] } | null;
      replyContent += `🧠 **Episodic Memory Recall**:\n`;
      if (toolRes.error) {
        replyContent += `Memory lookup failed: ${toolRes.error}\n`;
      } else if (memRes?.episodes && memRes.episodes.length > 0) {
        replyContent += `Found ${memRes.episodes.length} similar past episode(s):\n`;
        memRes.episodes.forEach((ep, i) => {
          replyContent += `${i + 1}. **Goal**: ${ep.goal} [Outcome: ${ep.outcome}]\n`;
        });
        if (memRes.lessons && memRes.lessons.length > 0) {
          replyContent += `\n**Lessons learned**: ${memRes.lessons.join('; ')}\n`;
        }
      } else {
        replyContent += `No similar past episodes are stored yet.\n`;
      }
      replyContent += '\n';
    }

    // G. Math / Calculation Intent
    else if (lower.startsWith('calc ') || lower.startsWith('calculate ') || /^[0-9+\-*/().%\s^]+$/.test(message.trim())) {
      const expr = message.replace(/^(calc|calculate):?/i, '').trim();
      const toolRes = await runTool('calculator', { expression: expr });
      if (toolRes.error) {
        replyContent += `🔢 **Calculation Error**: ${toolRes.error}\n\n`;
      } else {
        replyContent += `🔢 **Calculation Result**: \`${expr}\` = **${String(toolRes.result)}**\n\n`;
      }
    }

    // ─── 2. Local Ollama Inference (if running & available) ──────
    let ollamaSuccess = false;
    if (isZeroCloud || model.includes('local') || model.includes('ollama')) {
      try {
        const checkRes = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
        if (checkRes.ok) {
          const tagsData = await checkRes.json();
          const availableModels: Array<{ name: string }> = tagsData.models || [];

          if (availableModels.length > 0) {
            const requested = model.toLowerCase();
            const chosenModel =
              availableModels.find((m) => requested.includes(m.name.split(':')[0]))?.name || availableModels[0].name;
            thinking += `\n[Local Inference Engine: ${chosenModel}] (Zero-Cloud Private)`;

            const ollamaChatRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: chosenModel,
                messages: [
                  { role: 'system', content: 'You are OpenBot, a universal autonomous AI agent.' },
                  ...messages.slice(-4),
                  { role: 'user', content: message },
                ],
                stream: false,
              }),
            });

            if (ollamaChatRes.ok) {
              const resData = await ollamaChatRes.json();
              if (resData.message?.content) {
                replyContent += resData.message.content;
                ollamaSuccess = true;
              }
            }
          }
        }
      } catch {
        ollamaSuccess = false;
      }
    }

    // ─── 3. BYOK Cloud Provider Fallback (OpenAI / DeepSeek) ─────
    if (!ollamaSuccess && !replyContent) {
      if (apiKeys.openai && model.includes('gpt')) {
        thinking += `\n[BYOK Cloud Router: OpenAI]`;
        try {
          const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKeys.openai}`,
            },
            body: JSON.stringify({
              model: model.startsWith('gpt') || model.startsWith('o') ? model : 'gpt-4o',
              messages: [{ role: 'user', content: message }],
            }),
          });
          const oData = await openAiRes.json();
          if (oData.choices?.[0]?.message?.content) {
            replyContent += oData.choices[0].message.content;
          }
        } catch {
          // Handled by the honest fallback below.
        }
      } else if (apiKeys.deepseek && model.includes('deepseek')) {
        thinking += `\n[BYOK Cloud Router: DeepSeek]`;
        try {
          const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKeys.deepseek}`,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [{ role: 'user', content: message }],
            }),
          });
          const dData = await dsRes.json();
          if (dData.choices?.[0]?.message?.content) {
            replyContent += dData.choices[0].message.content;
          }
        } catch {
          // Handled by the honest fallback below.
        }
      }
    }

    // ─── 4. Honest fallback: nothing executed and no model replied ──
    if (!replyContent) {
      thinking += `\n[No tool intent matched and no model responded]`;
      const toolCount = toolRegistry.getToolDefinitions().length;
      replyContent += `I couldn't complete that request: it did not match a built-in tool intent, and no language model is currently reachable (local Ollama is not responding${apiKeys.openai || apiKeys.deepseek ? ' and the configured cloud provider returned no content' : ' and no BYOK cloud key is configured'}).\n\n`;
      replyContent += `What works right now: ${toolCount} registered tools — try prefixes like \`python: <code>\`, \`run: <shell command>\`, \`calc <expression>\`, paste a URL to extract it, or ask about phone/ADB status. To enable free-form chat, start Ollama locally or add a provider key in Settings → API Keys.`;
    }

    // ─── 5. Record the episode with its REAL outcome ─────────────
    try {
      const allToolsOk = toolCalls.length > 0 && toolCalls.every((tc) => !tc.error);
      const outcome: 'success' | 'partial' | 'failure' = allToolsOk
        ? 'success'
        : toolCalls.length > 0 || ollamaSuccess
          ? 'partial'
          : 'failure';
      const steps = toolCalls.map((tc, idx) => ({
        stepIndex: idx,
        action: tc.name,
        toolName: tc.name,
        toolInput: tc.args,
        observation: tc.error ? { error: tc.error } : tc.result,
        durationMs: tc.durationMs ?? 0,
        success: !tc.error,
        error: tc.error,
      }));
      const evaluation = reinforcement.evaluateTrajectory(message, steps, outcome);

      await episodicMemory.recordEpisode({
        userId: 'default_user',
        conversationId: 'openbot_chat_session',
        goal: message,
        steps,
        outcome,
        summary: `${outcome}: ${message.substring(0, 60)} (${toolCalls.length} tool call(s))`,
        rewardScore: evaluation.rewardScore,
        reflectionCritique: {
          strengths: evaluation.critique.strengths,
          weaknesses: evaluation.critique.weaknesses,
          lessonsLearned: evaluation.critique.recommendations,
        },
        tags: ['autonomous-task', toolCalls.length > 0 ? toolCalls[0].name : 'general'],
        startedAt: startTime,
      });
    } catch {
      // Memory recording errors must not fail the user reply.
    }

    return NextResponse.json({
      success: true,
      role: 'assistant',
      content: replyContent,
      thinking,
      toolCalls: toolCalls.map((tc) => ({ name: tc.name, args: tc.args, result: tc.result, error: tc.error })),
      model,
      latencyMs: Date.now() - startTime,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Agent execution failed',
      },
      { status: 500 }
    );
  }
}
