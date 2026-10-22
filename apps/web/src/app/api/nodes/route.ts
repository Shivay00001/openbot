import { NextRequest, NextResponse } from 'next/server';
import { DeviceOrchestrator } from '@openbot/core';

const orchestrator = new DeviceOrchestrator({
  laptopUrl: process.env.DESKTOP_NODE_URL || 'http://localhost:4002',
  phoneIp: process.env.PHONE_IP || '127.0.0.1',
});

export async function GET() {
  try {
    const nodes = await orchestrator.checkNodesStatus();
    return NextResponse.json({
      success: true,
      nodes,
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
    const { goal, target = 'auto' } = body;

    if (!goal || typeof goal !== 'string') {
      return NextResponse.json({ error: 'Goal string is required' }, { status: 400 });
    }

    const result = await orchestrator.executeTask(goal, target);
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Execution failed',
    }, { status: 500 });
  }
}
