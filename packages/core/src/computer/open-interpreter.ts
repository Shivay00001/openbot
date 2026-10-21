/**
 * Open Interpreter OS Execution Engine 💻⚡
 * Multi-language code execution on the host OS.
 *
 * Safety model: user code is written to a temporary file and executed with
 * an argv array (execFile) — code is NEVER interpolated into a shell string,
 * so quotes, backticks, and $(...) inside the payload cannot break out into
 * the host shell. Each run is time-boxed and output-capped, and every
 * execution is classified by risk before it runs.
 *
 * Supports: Python (python3/python), Node.js, Bash, PowerShell (Windows),
 * AppleScript (macOS, via osascript).
 */

import { v4 as uuid } from 'uuid';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  InterpreterExecutionOptions,
  InterpreterExecutionResult,
} from './types.js';

const execFileAsync = promisify(execFile);

interface RuntimeCommand {
  command: string;
  args: string[];
  extension: string;
}

function runtimeFor(language: InterpreterExecutionOptions['language'], filePath: string): RuntimeCommand {
  switch (language) {
    case 'python':
      return {
        command: process.platform === 'win32' ? 'python' : 'python3',
        args: [filePath],
        extension: '.py',
      };
    case 'node':
      return { command: 'node', args: [filePath], extension: '.js' };
    case 'bash':
      return { command: 'bash', args: [filePath], extension: '.sh' };
    case 'powershell':
      return {
        command: 'powershell',
        args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', filePath],
        extension: '.ps1',
      };
    case 'applescript':
      return { command: 'osascript', args: [filePath], extension: '.scpt' };
    default:
      return { command: 'bash', args: [filePath], extension: '.sh' };
  }
}

export class OpenInterpreterEngine {
  private defaultCwd: string;
  private executionHistory: InterpreterExecutionResult[] = [];

  constructor(defaultCwd?: string) {
    this.defaultCwd = defaultCwd || (typeof process !== 'undefined' && process.cwd ? process.cwd() : os.tmpdir());
  }

  /**
   * Execute code in the specified language with safety classification.
   * Returns the real exit code, stdout, and stderr of the child process.
   */
  async execute(options: InterpreterExecutionOptions): Promise<InterpreterExecutionResult> {
    const start = Date.now();
    const executionId = uuid();
    const riskLevel = this.classifyRisk(options.code, options.language);
    const cwd = options.cwd || this.defaultCwd;
    const timeoutMs = options.timeoutMs || 30000;

    const probe = runtimeFor(options.language, 'probe');
    const tempFile = path.join(
      os.tmpdir(),
      `openbot-exec-${executionId}${probe.extension}`
    );

    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      fs.writeFileSync(tempFile, options.code, 'utf8');
      const runtime = runtimeFor(options.language, tempFile);
      const res = await execFileAsync(runtime.command, runtime.args, {
        cwd,
        timeout: timeoutMs,
        env: { ...process.env, ...options.env },
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = (res.stdout as string) || '';
      stderr = (res.stderr as string) || '';
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        exitCode = 127;
        stderr = `Runtime for language "${options.language}" not found on this host (${probe.command}).`;
      } else {
        exitCode = typeof err.code === 'number' ? err.code : 1;
        stdout = (err.stdout as string) || '';
        stderr = (err.stderr as string) || err.message || '';
        if (err.killed && err.signal === 'SIGTERM') {
          stderr += `\n[OpenBot] Execution timed out after ${timeoutMs}ms and was terminated.`;
        }
      }
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // temp file already gone
      }
    }

    const result: InterpreterExecutionResult = {
      executionId,
      language: options.language,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode,
      durationMs: Date.now() - start,
      riskLevel,
    };

    this.executionHistory.push(result);
    return result;
  }

  getHistory(): InterpreterExecutionResult[] {
    return [...this.executionHistory];
  }

  /** Heuristic risk classification shown to users/approvers before execution. */
  classifyRisk(code: string, _language: string): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
    const lower = code.toLowerCase();
    const criticalPatterns = ['rm -rf /', 'format c:', 'mkfs', ':(){ :|:& };:', 'del /f /s /q c:\\windows', 'dd if=/dev/zero of=/dev/sda'];
    const highPatterns = ['drop database', 'rm -rf', 'del /f', 'shutdown', 'reboot', 'dd if='];
    const mediumPatterns = ['curl | sh', 'wget | bash', 'chmod 777', 'pip install', 'npm install -g'];

    if (criticalPatterns.some((p) => lower.includes(p))) return 'critical';
    if (highPatterns.some((p) => lower.includes(p))) return 'high';
    if (mediumPatterns.some((p) => lower.includes(p))) return 'medium';
    if (lower.includes('write') || lower.includes('mkdir') || lower.includes('touch')) return 'low';
    return 'safe';
  }
}
