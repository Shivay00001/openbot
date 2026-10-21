import { NextRequest, NextResponse } from 'next/server';
import { vFlowEngine } from '@openbot/core';

// Server-side singleton instance of vFlowEngine
const vflow = new vFlowEngine();

export async function GET() {
  try {
    const workflows = vflow.getWorkflows();
    return NextResponse.json({
      success: true,
      workflows,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { utterance } = await req.json();

    if (!utterance || typeof utterance !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Voice utterance string is required',
      }, { status: 400 });
    }

    const session = await vflow.processVoiceCommand(utterance.trim());

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
