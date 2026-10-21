import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'devices';

    if (action === 'devices') {
      const { stdout } = await execAsync('adb devices -l');
      const lines = stdout.split('\n').filter((l) => l.trim() && !l.startsWith('*') && !l.startsWith('List of'));
      const devices = lines.map((line) => {
        const parts = line.trim().split(/\s+/);
        const serial = parts[0];
        const status = parts[1];
        const modelMatch = line.match(/model:([^\s]+)/);
        const deviceMatch = line.match(/device:([^\s]+)/);
        return {
          serial,
          status,
          model: modelMatch ? modelMatch[1] : 'Android Device',
          device: deviceMatch ? deviceMatch[1] : 'generic',
        };
      });

      return NextResponse.json({
        adbInstalled: true,
        deviceCount: devices.length,
        devices,
      });
    }

    if (action === 'screenshot') {
      try {
        // Capture screenshot via adb exec-out
        const { stdout } = await execAsync('adb exec-out screencap -p', {
          encoding: 'base64',
          maxBuffer: 20 * 1024 * 1024,
        });

        return NextResponse.json({
          success: true,
          mimeType: 'image/png',
          base64: `data:image/png;base64,${stdout}`,
        });
      } catch (err: unknown) {
        return NextResponse.json({
          success: false,
          error: 'No active device connected or screencap failed',
        });
      }
    }

    if (action === 'ui_tree') {
      try {
        await execAsync('adb shell uiautomator dump /sdcard/window_dump.xml');
        const { stdout } = await execAsync('adb shell cat /sdcard/window_dump.xml');
        return NextResponse.json({
          success: true,
          xml: stdout,
        });
      } catch {
        return NextResponse.json({
          success: false,
          error: 'Failed to dump uiautomator tree',
        });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({
      adbInstalled: false,
      error: error instanceof Error ? error.message : 'ADB execution failed',
      deviceCount: 0,
      devices: [],
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, x, y, text, keyCode, packageName, targetIp } = await req.json();

    if (action === 'connect' && targetIp) {
      const { stdout, stderr } = await execAsync(`adb connect ${targetIp}`);
      return NextResponse.json({ success: true, output: stdout || stderr });
    }

    if (action === 'tap' && x !== undefined && y !== undefined) {
      await execAsync(`adb shell input tap ${Math.round(x)} ${Math.round(y)}`);
      return NextResponse.json({ success: true, message: `Real ADB tap at (${x}, ${y})` });
    }

    if (action === 'type' && text) {
      const escaped = text.replace(/"/g, '\\"').replace(/\s/g, '%s');
      await execAsync(`adb shell input text "${escaped}"`);
      return NextResponse.json({ success: true, message: `Real ADB typed: "${text}"` });
    }

    if (action === 'key' && keyCode) {
      const keyMap: Record<string, number> = {
        HOME: 3,
        BACK: 4,
        RECENT_APPS: 187,
        POWER: 26,
        VOLUME_UP: 24,
        VOLUME_DOWN: 25,
        ENTER: 66,
      };
      const code = keyMap[keyCode] || 3;
      await execAsync(`adb shell input keyevent ${code}`);
      return NextResponse.json({ success: true, message: `Real ADB keyevent ${code} (${keyCode})` });
    }

    if (action === 'launch' && packageName) {
      await execAsync(`adb shell monkey -p ${packageName} 1`);
      return NextResponse.json({ success: true, message: `Real ADB launched package: ${packageName}` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'ADB action failed',
    });
  }
}
