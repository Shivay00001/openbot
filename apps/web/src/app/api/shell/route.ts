import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Workspace base directory — shell commands run inside it, and the working
// directory may not escape it.
const WORKSPACE_ROOT = path.resolve(process.cwd(), '../..');

/**
 * Host shell execution for the Desktop Mode terminal.
 *
 * SECURITY NOTE: this endpoint intentionally executes arbitrary host shell
 * commands (it is the product's terminal feature) and must only be exposed
 * on a trusted local network / behind authentication. When the
 * OPENBOT_API_TOKEN environment variable is set, requests must present it
 * in the `x-openbot-token` header. The command's working directory is
 * jailed to the workspace root.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const requiredToken = process.env.OPENBOT_API_TOKEN;
    if (requiredToken && req.headers.get('x-openbot-token') !== requiredToken) {
      return NextResponse.json({ error: 'Unauthorized: missing or invalid x-openbot-token' }, { status: 401 });
    }

    const { command, cwd } = await req.json();

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command string is required' }, { status: 400 });
    }

    const workingDir = cwd ? path.resolve(WORKSPACE_ROOT, cwd) : WORKSPACE_ROOT;
    if (workingDir !== WORKSPACE_ROOT && !workingDir.startsWith(WORKSPACE_ROOT + path.sep)) {
      return NextResponse.json({ error: 'Access denied: cwd outside workspace root' }, { status: 403 });
    }

    const isWindows = process.platform === 'win32';
    const shellExecutable = isWindows ? 'powershell.exe' : '/bin/bash';

    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDir,
      shell: shellExecutable,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    });

    return NextResponse.json({
      success: true,
      command,
      cwd: workingDir,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0,
      durationMs: Date.now() - startTime,
    });
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number; message?: string; cmd?: string };
    return NextResponse.json({
      success: false,
      command: execError.cmd || '',
      stdout: execError.stdout || '',
      stderr: execError.stderr || execError.message || 'Execution failed',
      exitCode: typeof execError.code === 'number' ? execError.code : 1,
      durationMs: Date.now() - startTime,
    });
  }
}
