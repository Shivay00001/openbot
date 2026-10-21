import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Determine phone bridge address if running in docker or host
const PHONE_BRIDGE_URL = process.env.PHONE_BRIDGE_URL || 'http://localhost:8000';
const ADB_HOST = process.env.ADB_HOST;
const ADB_PORT = process.env.ADB_PORT || '5037';

function getAdbPrefix(): string {
  if (ADB_HOST) {
    return `adb -H ${ADB_HOST} -P ${ADB_PORT}`;
  }
  return 'adb';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'devices';

  // 1. Check if Docker Phone Bridge is alive
  let isDockerBridgeOnline = false;
  try {
    const bridgeRes = await fetch(`${PHONE_BRIDGE_URL}/status`, { signal: AbortSignal.timeout(1000) });
    if (bridgeRes.ok) {
      isDockerBridgeOnline = true;
    }
  } catch {
    isDockerBridgeOnline = false;
  }

  // 2. Handle Stream URL Request
  if (action === 'stream_url') {
    return NextResponse.json({
      success: true,
      streamUrl: isDockerBridgeOnline ? `${PHONE_BRIDGE_URL}/stream` : null,
      dockerBridgeOnline: isDockerBridgeOnline,
    });
  }

  // 3. List Devices
  if (action === 'devices') {
    // If docker bridge is online, fetch from it first
    if (isDockerBridgeOnline) {
      try {
        const res = await fetch(`${PHONE_BRIDGE_URL}/devices`);
        const data = await res.json();
        return NextResponse.json({
          adbInstalled: true,
          dockerBridgeOnline: true,
          deviceCount: data.devices ? data.devices.length : 0,
          devices: data.devices || [],
          source: 'docker-phone-bridge',
        });
      } catch {
        // fallback to local adb
      }
    }

    try {
      const adbCmd = `${getAdbPrefix()} devices -l`;
      const { stdout } = await execAsync(adbCmd);
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
        dockerBridgeOnline: isDockerBridgeOnline,
        deviceCount: devices.length,
        devices,
        source: 'local_adb',
      });
    } catch (err: unknown) {
      return NextResponse.json({
        adbInstalled: false,
        dockerBridgeOnline: isDockerBridgeOnline,
        error: err instanceof Error ? err.message : 'ADB not detected',
        deviceCount: 0,
        devices: [],
      });
    }
  }

  // 4. Capture Screenshot
  if (action === 'screenshot') {
    if (isDockerBridgeOnline) {
      try {
        const res = await fetch(`${PHONE_BRIDGE_URL}/screenshot`);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          return NextResponse.json({
            success: true,
            mimeType: 'image/png',
            base64: `data:image/png;base64,${base64}`,
            source: 'docker-phone-bridge',
          });
        }
      } catch {
        // fallback
      }
    }

    try {
      const adbCmd = `${getAdbPrefix()} exec-out screencap -p`;
      const { stdout } = await execAsync(adbCmd, {
        encoding: 'base64',
        maxBuffer: 25 * 1024 * 1024,
      });

      return NextResponse.json({
        success: true,
        mimeType: 'image/png',
        base64: `data:image/png;base64,${stdout}`,
        source: 'local_adb',
      });
    } catch {
      return NextResponse.json({
        success: false,
        error: 'No active device connected or screencap failed',
      });
    }
  }

  // 5. UIAutomator Tree
  if (action === 'ui_tree') {
    try {
      const prefix = getAdbPrefix();
      await execAsync(`${prefix} shell uiautomator dump /sdcard/window_dump.xml`);
      const { stdout } = await execAsync(`${prefix} shell cat /sdcard/window_dump.xml`);
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
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, x, y, x1, y1, x2, y2, duration, text, keyCode, packageName, targetIp, apkPath } = body;

    // Check if Docker Phone Bridge is online to forward command
    let isDockerBridgeOnline = false;
    try {
      const test = await fetch(`${PHONE_BRIDGE_URL}/status`, { signal: AbortSignal.timeout(800) });
      if (test.ok) isDockerBridgeOnline = true;
    } catch {
      isDockerBridgeOnline = false;
    }

    // Connect to wireless IP
    if (action === 'connect' && targetIp) {
      if (isDockerBridgeOnline) {
        const res = await fetch(`${PHONE_BRIDGE_URL}/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: targetIp }),
        });
        const data = await res.json();
        return NextResponse.json({ success: true, output: data.output, source: 'docker-phone-bridge' });
      }

      const { stdout, stderr } = await execAsync(`${getAdbPrefix()} connect ${targetIp}`);
      return NextResponse.json({ success: true, output: stdout || stderr, source: 'local_adb' });
    }

    // Tap coordinate
    if (action === 'tap' && x !== undefined && y !== undefined) {
      if (isDockerBridgeOnline) {
        await fetch(`${PHONE_BRIDGE_URL}/tap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x, y }),
        });
        return NextResponse.json({ success: true, message: `Docker ADB tap at (${x}, ${y})`, source: 'docker' });
      }

      await execAsync(`${getAdbPrefix()} shell input tap ${Math.round(x)} ${Math.round(y)}`);
      return NextResponse.json({ success: true, message: `Real ADB tap at (${x}, ${y})`, source: 'local' });
    }

    // Swipe gesture
    if (action === 'swipe' && x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
      if (isDockerBridgeOnline) {
        await fetch(`${PHONE_BRIDGE_URL}/swipe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x1, y1, x2, y2, duration: duration || 300 }),
        });
        return NextResponse.json({ success: true, message: `Docker ADB swipe executed` });
      }

      await execAsync(`${getAdbPrefix()} shell input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${duration || 300}`);
      return NextResponse.json({ success: true, message: `Real ADB swipe executed` });
    }

    // Type text
    if (action === 'type' && text) {
      if (isDockerBridgeOnline) {
        await fetch(`${PHONE_BRIDGE_URL}/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        return NextResponse.json({ success: true, message: `Docker ADB typed: "${text}"` });
      }

      const escaped = text.replace(/"/g, '\\"').replace(/\s/g, '%s');
      await execAsync(`${getAdbPrefix()} shell input text "${escaped}"`);
      return NextResponse.json({ success: true, message: `Real ADB typed: "${text}"` });
    }

    // Hardware key
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

      if (isDockerBridgeOnline) {
        await fetch(`${PHONE_BRIDGE_URL}/key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        return NextResponse.json({ success: true, message: `Docker ADB keyevent ${code} (${keyCode})` });
      }

      await execAsync(`${getAdbPrefix()} shell input keyevent ${code}`);
      return NextResponse.json({ success: true, message: `Real ADB keyevent ${code} (${keyCode})` });
    }

    // Launch package
    if (action === 'launch' && packageName) {
      if (isDockerBridgeOnline) {
        await fetch(`${PHONE_BRIDGE_URL}/launch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ package: packageName }),
        });
        return NextResponse.json({ success: true, message: `Docker ADB launched package: ${packageName}` });
      }

      await execAsync(`${getAdbPrefix()} shell monkey -p ${packageName} 1`);
      return NextResponse.json({ success: true, message: `Real ADB launched package: ${packageName}` });
    }

    // Install APK
    if (action === 'install' && apkPath) {
      const { stdout, stderr } = await execAsync(`${getAdbPrefix()} install -r "${apkPath}"`);
      return NextResponse.json({ success: true, message: stdout || stderr });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'ADB action failed',
    });
  }
}
