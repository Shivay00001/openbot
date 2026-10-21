import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Workspace base directory
const WORKSPACE_ROOT = path.resolve(process.cwd(), '../..');

export async function POST(req: NextRequest) {
  try {
    const { command, cwd } = await req.json();

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command string is required' }, { status: 400 });
    }

    const workingDir = cwd ? path.resolve(WORKSPACE_ROOT, cwd) : WORKSPACE_ROOT;
    const startTime = Date.now();

    // Execute real command in PowerShell / cmd on Windows
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

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      command,
      cwd: workingDir,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: 0,
      durationMs,
    });
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; code?: number; message?: string };
    return NextResponse.json({
      success: false,
      command: (error as { cmd?: string })?.cmd || '',
      stdout: execError.stdout || '',
      stderr: execError.stderr || execError.message || 'Execution failed',
      exitCode: execError.code || 1,
      durationMs: 0,
    });
  }
}
