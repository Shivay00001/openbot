import { NextRequest, NextResponse } from 'next/server';

const DOCKER_OS_URL = process.env.DOCKER_OS_URL || 'http://localhost:6080';

export async function GET() {
  let isDockerOsOnline = false;
  try {
    const probe = await fetch(DOCKER_OS_URL, { signal: AbortSignal.timeout(1000) });
    if (probe.status < 500) {
      isDockerOsOnline = true;
    }
  } catch {
    isDockerOsOnline = false;
  }

  return NextResponse.json({
    dockerOsOnline: isDockerOsOnline,
    dockerOsUrl: DOCKER_OS_URL,
    capabilities: [
      'Ubuntu XFCE Desktop GUI',
      'noVNC Live Interactive Web Display',
      'Full Root Bash Shell',
      'GUI Applications & Browser in OS',
      'Bidirectional File Workspace Mount',
    ],
  });
}
