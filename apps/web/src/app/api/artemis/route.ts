import { NextRequest, NextResponse } from 'next/server';
import { ArtemisPhoneNavigator, ArtemisPhoneBrowserController } from '@openbot/core';

const navigator = new ArtemisPhoneNavigator('simulator');
const phoneBrowser = new ArtemisPhoneBrowserController();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'phone';

    if (mode === 'browser') {
      const state = await phoneBrowser.getViewportState();
      return NextResponse.json({ success: true, state });
    }

    const state = await navigator.getScreenState();
    return NextResponse.json({ success: true, state });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, goal, url, x, y, touchType } = await req.json();

    if (action === 'workflow' && goal) {
      const result = await navigator.executeMobileWorkflow(goal);
      return NextResponse.json({ success: true, result });
    }

    if (action === 'browse' && url) {
      const result = await phoneBrowser.navigate(url);
      const viewport = await phoneBrowser.getViewportState();
      return NextResponse.json({ success: true, result, viewport });
    }

    if (action === 'touch' && touchType) {
      const result = await phoneBrowser.touch(touchType, { x, y });
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: 'Unknown Artemis action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
