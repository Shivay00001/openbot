import { NextRequest, NextResponse } from 'next/server';
import { AdbController, AdbUnavailableError, isValidPackageName } from '@openbot/core/phone';
import type { PhoneKeyCode } from '@openbot/core/phone';

/**
 * ADB bridge API. All device actions delegate to the core AdbController,
 * which executes `adb` with argv arrays (never shell string interpolation),
 * so request parameters cannot inject shell commands.
 */

const adb = new AdbController();

const VALID_KEYS: PhoneKeyCode[] = [
  'HOME', 'BACK', 'RECENT_APPS', 'POWER', 'VOLUME_UP', 'VOLUME_DOWN', 'ENTER',
];

function adbErrorResponse(error: unknown) {
  if (error instanceof AdbUnavailableError) {
    return NextResponse.json({ success: false, adbInstalled: false, error: error.message }, { status: 503 });
  }
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : 'ADB execution failed' },
    { status: 500 }
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'devices';

    if (action === 'devices') {
      const devices = await adb.listDevices();
      return NextResponse.json({
        adbInstalled: true,
        deviceCount: devices.length,
        devices: devices.map((d) => ({
          serial: d.serial,
          status: d.state,
          model: d.model || 'Android Device',
          device: d.product || 'generic',
        })),
      });
    }

    if (action === 'screenshot') {
      const shot = await adb.captureScreenshot();
      if (!shot.success) {
        return NextResponse.json({ success: false, error: shot.error || 'Screencap failed' });
      }
      return NextResponse.json({
        success: true,
        mimeType: 'image/png',
        base64: shot.dataUrl,
      });
    }

    if (action === 'ui_tree') {
      try {
        const xml = await adb.dumpHierarchy();
        return NextResponse.json({ success: true, xml });
      } catch (err: unknown) {
        return NextResponse.json({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to dump uiautomator tree',
        });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    return adbErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, x, y, text, keyCode, packageName, targetIp } = await req.json();

    if (action === 'connect') {
      // Strict host:port validation before anything reaches adb.
      const match = typeof targetIp === 'string' ? targetIp.match(/^([a-zA-Z0-9.-]+):(\d{1,5})$/) : null;
      if (!match) {
        return NextResponse.json(
          { success: false, error: 'targetIp must be in host:port form (e.g. 192.168.1.10:5555)' },
          { status: 400 }
        );
      }
      const port = Number(match[2]);
      if (port < 1 || port > 65535) {
        return NextResponse.json({ success: false, error: 'Port out of range' }, { status: 400 });
      }
      const result = await adb.connectTcp(match[1], port);
      return NextResponse.json({ success: result.success, message: result.message });
    }

    if (action === 'tap') {
      const nx = Number(x);
      const ny = Number(y);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) {
        return NextResponse.json({ success: false, error: 'x and y must be numbers' }, { status: 400 });
      }
      const result = await adb.tap(nx, ny);
      return NextResponse.json({ success: result.success, message: result.output || result.command });
    }

    if (action === 'type') {
      if (typeof text !== 'string' || text.length === 0) {
        return NextResponse.json({ success: false, error: 'text is required' }, { status: 400 });
      }
      const result = await adb.typeText(text);
      return NextResponse.json({ success: result.success, message: result.output || result.command });
    }

    if (action === 'key') {
      if (!VALID_KEYS.includes(keyCode)) {
        return NextResponse.json(
          { success: false, error: `keyCode must be one of: ${VALID_KEYS.join(', ')}` },
          { status: 400 }
        );
      }
      const result = await adb.pressKey(keyCode as PhoneKeyCode);
      return NextResponse.json({ success: result.success, message: result.output || result.command });
    }

    if (action === 'launch') {
      if (typeof packageName !== 'string' || !isValidPackageName(packageName)) {
        return NextResponse.json({ success: false, error: 'Invalid package name' }, { status: 400 });
      }
      const result = await adb.launchPackage(packageName);
      return NextResponse.json({ success: result.success, message: result.output || result.command });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    return adbErrorResponse(error);
  }
}
