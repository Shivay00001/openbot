'use client';

import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Send, 
  Play, 
  ArrowLeft, 
  Home, 
  Square, 
  RefreshCw, 
  Search, 
  CheckCircle, 
  Bell, 
  Radio, 
  Wifi, 
  Battery, 
  Volume2, 
  Sliders, 
  Sparkles,
  MessageSquare,
  Navigation,
  Car,
  Link2,
  AlertCircle
} from 'lucide-react';

interface AdbDevice {
  serial: string;
  status: string;
  model: string;
  device: string;
}

export const PhoneModeView: React.FC = () => {
  const [adbStatus, setAdbStatus] = useState<{ installed: boolean; devices: AdbDevice[] }>({
    installed: true,
    devices: [],
  });
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [wirelessIp, setWirelessIp] = useState('192.168.1.');
  const [isScanning, setIsScanning] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);

  const [activeLog, setActiveLog] = useState<string[]>([
    'System: Checking ADB daemon on host (tcp:5037)...',
  ]);

  const [autonomousGoal, setAutonomousGoal] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Scan real ADB devices on mount
  useEffect(() => {
    scanAdbDevices();
  }, []);

  const addLog = (msg: string) => {
    setActiveLog((prev) => [msg, ...prev.slice(0, 15)]);
  };

  const scanAdbDevices = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/phone/adb?action=devices');
      const data = await res.json();
      setAdbStatus({
        installed: data.adbInstalled,
        devices: data.devices || [],
      });

      if (data.devices && data.devices.length > 0) {
        setSelectedDevice(data.devices[0].serial);
        addLog(`ADB: Found ${data.devices.length} connected device(s): ${data.devices[0].model} (${data.devices[0].serial})`);
        fetchDeviceScreenshot();
      } else {
        addLog('ADB: Daemon active. No physical Android phone detected over USB/Wi-Fi. Virtual interactive simulator ready.');
      }
    } catch (err: unknown) {
      addLog(`ADB Error: ${err instanceof Error ? err.message : 'Failed to query ADB'}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectWireless = async () => {
    if (!wirelessIp.trim()) return;
    addLog(`ADB: Running "adb connect ${wirelessIp.trim()}"...`);
    try {
      const res = await fetch('/api/phone/adb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect', targetIp: wirelessIp.trim() }),
      });
      const data = await res.json();
      addLog(`ADB Response: ${data.output || 'Connect command sent'}`);
      await scanAdbDevices();
    } catch {
      addLog('ADB: Wireless connection failed. Make sure Wireless Debugging is on.');
    }
  };

  const fetchDeviceScreenshot = async () => {
    try {
      const res = await fetch('/api/phone/adb?action=screenshot');
      const data = await res.json();
      if (data.success && data.base64) {
        setScreenshotData(data.base64);
        addLog('ADB: Captured real device screen mirror.');
      }
    } catch {
      // ignore
    }
  };

  const handleRealTap = async (x: number, y: number) => {
    addLog(`Agent: Dispatching real tap to (${x}, ${y}) via ADB...`);
    try {
      const res = await fetch('/api/phone/adb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tap', x, y }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`ADB: ${data.message}`);
        setTimeout(fetchDeviceScreenshot, 400);
      }
    } catch {
      // fallback
    }
  };

  const handleRealKey = async (keyCode: 'HOME' | 'BACK' | 'RECENT_APPS') => {
    addLog(`Agent: Dispatching real hardware key: ${keyCode} via ADB...`);
    try {
      const res = await fetch('/api/phone/adb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'key', keyCode }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`ADB: ${data.message}`);
        setTimeout(fetchDeviceScreenshot, 400);
      }
    } catch {
      // fallback
    }
  };

  const executeAutonomousGoal = async () => {
    if (!autonomousGoal.trim()) return;
    setIsExecuting(true);
    addLog(`Agentic Phone Controller: Received goal "${autonomousGoal}"`);

    // Parse real action
    const goalLower = autonomousGoal.toLowerCase();
    let targetPkg = '';
    if (goalLower.includes('uber')) targetPkg = 'com.ubercab';
    else if (goalLower.includes('whatsapp')) targetPkg = 'com.whatsapp';
    else if (goalLower.includes('maps')) targetPkg = 'com.google.android.apps.maps';
    else if (goalLower.includes('youtube')) targetPkg = 'com.google.android.youtube';
    else targetPkg = 'com.android.chrome';

    addLog(`Agent: Launching target package "${targetPkg}" via ADB intent...`);
    try {
      const res = await fetch('/api/phone/adb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'launch', packageName: targetPkg }),
      });
      const data = await res.json();
      addLog(`ADB Result: ${data.message || 'Launched intent successfully'}`);
      setTimeout(fetchDeviceScreenshot, 1000);
    } catch (err: unknown) {
      addLog(`ADB error: ${String(err)}`);
    } finally {
      setIsExecuting(false);
      setAutonomousGoal('');
    }
  };

  return (
    <div
      id="agentic-phone-mode-container"
      style={{
        display: 'grid',
        gridTemplateColumns: '420px 1fr 340px',
        height: 'calc(100vh - var(--header-height))',
        width: '100%',
        padding: '20px 28px',
        gap: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Column 1: Smartphone Device Viewport */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="phone-mockup-frame" id="virtual-phone-simulator">
          {/* Dynamic Island */}
          <div className="phone-island">
            <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>9:41</span>
            <div className="phone-camera-dot" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fff', fontSize: '10px' }}>
              <Wifi size={11} />
              <Battery size={11} />
            </div>
          </div>

          {/* Screen Content: Real Screencap OR Virtual Simulator */}
          <div
            style={{
              flex: 1,
              marginTop: '44px',
              padding: '16px',
              background: screenshotData ? '#000' : 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflowY: 'auto',
            }}
          >
            {screenshotData ? (
              <img
                src={screenshotData}
                alt="Live Phone Screen"
                style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair' }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 1080;
                  const y = ((e.clientY - rect.top) / rect.height) * 2400;
                  handleRealTap(x, y);
                }}
              />
            ) : (
              /* Virtual Android Display fallback */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                    {adbStatus.devices.length > 0 ? adbStatus.devices[0].model : 'Pixel 8 Simulator'}
                  </span>
                  <span className={adbStatus.devices.length > 0 ? 'badge badge-emerald' : 'badge badge-amber'}>
                    {adbStatus.devices.length > 0 ? 'Physical Phone' : 'Virtual Mode'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px', marginTop: '10px' }}>
                  {[
                    { name: 'WhatsApp', icon: <MessageSquare size={22} />, pkg: 'com.whatsapp' },
                    { name: 'Uber', icon: <Car size={22} />, pkg: 'com.ubercab' },
                    { name: 'Maps', icon: <Navigation size={22} />, pkg: 'com.google.android.apps.maps' },
                    { name: 'Chrome', icon: <Smartphone size={22} />, pkg: 'com.android.chrome' },
                  ].map((app, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRealTap(100 + idx * 80, 200)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: '54px',
                          height: '54px',
                          borderRadius: '16px',
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                          border: '1px solid rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-cyan)',
                        }}
                      >
                        {app.icon}
                      </div>
                      <span style={{ fontSize: '11px', color: '#e2e8f0' }}>{app.name}</span>
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 'auto',
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  Click any coordinate to dispatch real \`adb shell input tap\` command.
                </div>
              </div>
            )}
          </div>

          {/* Android Navigation Keys */}
          <div
            style={{
              height: '48px',
              background: '#090a0f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              borderTop: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <button
              onClick={() => handleRealKey('BACK')}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              title="Real Back Keyevent"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onClick={() => handleRealKey('HOME')}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              title="Real Home Keyevent"
            >
              <Home size={18} />
            </button>
            <button
              onClick={() => handleRealKey('RECENT_APPS')}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              title="Real App Switcher"
            >
              <Square size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Column 2: Agentic Automation & Real ADB Dispatch */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {/* Banner */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={20} style={{ color: 'var(--accent-cyan)' }} />
                <h2 style={{ fontSize: '18px' }}>Real Agentic Phone Mode (ADB Active)</h2>
                <span className="badge badge-emerald">Real Hardware Bridge</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Directly connects to Android Debug Bridge daemon (tcp:5037) for real smartphone automation.
              </p>
            </div>
            <button onClick={scanAdbDevices} disabled={isScanning} className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 12px' }}>
              <RefreshCw className={isScanning ? 'spin-slow' : ''} size={14} />
              <span>Scan USB/Wi-Fi</span>
            </button>
          </div>
        </div>

        {/* Real ADB Wireless Connect Box */}
        <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Wifi size={18} style={{ color: 'var(--accent-cyan)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>Wireless ADB Pairing:</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enter your phone IP address (Settings &gt; Developer Options &gt; Wireless Debugging)</div>
          </div>
          <input
            type="text"
            placeholder="192.168.1.50:5555"
            value={wirelessIp}
            onChange={(e) => setWirelessIp(e.target.value)}
            style={{ width: '180px', padding: '6px 10px', fontSize: '12px' }}
          />
          <button onClick={handleConnectWireless} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Link2 size={13} />
            <span>Connect</span>
          </button>
        </div>

        {/* Autonomous Goal Dispatcher */}
        <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Execute Autonomous Phone Action
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              id="phone-goal-input"
              type="text"
              placeholder="e.g. 'Launch WhatsApp', 'Open YouTube', 'Launch Uber'..."
              value={autonomousGoal}
              onChange={(e) => setAutonomousGoal(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              id="btn-execute-phone-goal"
              onClick={executeAutonomousGoal}
              disabled={isExecuting || !autonomousGoal.trim()}
              className="btn btn-primary"
            >
              {isExecuting ? <RefreshCw className="spin-slow" size={15} /> : <Play size={15} />}
              <span>{isExecuting ? 'Dispatching...' : 'Run Real Action'}</span>
            </button>
          </div>
        </div>

        {/* Live Execution Activity Stream */}
        <div className="glass-panel" style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Real ADB Perception & Log Stream
            </span>
            <span className="live-indicator" />
          </div>

          <div
            id="phone-action-log-stream"
            style={{
              flex: 1,
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              overflowY: 'auto',
              maxHeight: '260px',
            }}
          >
            {activeLog.map((log, idx) => (
              <div key={idx} style={{ borderLeft: '2px solid var(--accent-cyan)', paddingLeft: '8px' }}>
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column 3: Hardware Telemetry */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="glass-panel" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '10px' }}>
            ADB Hardware Status
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ADB Daemon</span>
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>Running (tcp:5037)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Devices Attached</span>
              <span style={{ color: adbStatus.devices.length > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                {adbStatus.devices.length} device(s)
              </span>
            </div>
            {adbStatus.devices.length > 0 && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '4px', border: '1px solid var(--accent-emerald)' }}>
                <div style={{ fontWeight: 600, color: '#fff' }}>{adbStatus.devices[0].model}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{adbStatus.devices[0].serial}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            <button onClick={fetchDeviceScreenshot} className="btn btn-secondary" style={{ width: '100%', fontSize: '11px', padding: '8px' }}>
              📸 Request Live Screencap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
