import { NextRequest, NextResponse } from 'next/server';
import { DeviceOrchestrator, FreeApiDiscoverer } from '@openbot/core';

const orchestrator = new DeviceOrchestrator({
  laptopUrl: process.env.DESKTOP_NODE_URL || 'http://localhost:4002',
  phoneIp: process.env.PHONE_IP || '127.0.0.1',
});

const discoverer = new FreeApiDiscoverer();

export async function GET() {
  try {
    const nodes = await orchestrator.checkNodesStatus();
    const freeEndpoints = discoverer.getEndpoints();

    return NextResponse.json({
      success: true,
      nodes,
      freeEndpoints,
      downloads: {
        phoneApk: '/downloads/OpenBot-Phone-Edge.apk',
        laptopExe: '/downloads/OpenBot-Laptop-Edge.exe',
        repoArtifacts: 'https://github.com/Shivay00001/openbot/actions',
      },
      timestamp: Date.now(),
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to query edge node servers',
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { goal, target = 'auto', provider = 'tokenrouter' } = body;

    if (!goal || typeof goal !== 'string') {
      return NextResponse.json({ error: 'Goal string is required' }, { status: 400 });
    }

    const result = await orchestrator.executeTask(goal, target as any);
    return NextResponse.json({
      success: true,
      provider,
      result,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Execution failed',
    }, { status: 500 });
  }
}
