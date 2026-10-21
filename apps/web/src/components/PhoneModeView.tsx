'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  VolumeX,
  Volume1,
  Power,
  Sliders, 
  Sparkles,
  MessageSquare,
  Navigation,
  Car,
  Link2,
  AlertCircle,
  Video,
  Camera,
  UploadCloud,
  Layers,
  Terminal
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
  const [useLiveStream, setUseLiveStream] = useState<boolean>(true);
  const [dockerBridgeOnline, setDockerBridgeOnline] = useState<boolean>(false);
  const [streamUrl, setStreamUrl] = useState<string>('http://localhost:8000/stream');

  const [activeLog, setActiveLog] = useState<string[]>([
    'System: Initializing multi-device phone control bridge...',
    'System: Checking ADB daemon & Docker phone-bridge (ports 5037, 8000)...',
  ]);

  const [autonomousGoal, setAutonomousGoal] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [textInputVal, setTextInputVal] = useState('');

  // Scan real ADB devices & Docker bridge on mount
  useEffect(() => {
    scanAdbDevices();
  }, []);

  const addLog = (msg: string) => {
    setActiveLog((prev) => [msg, ...prev.slice(0, 20)]);
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
      setDockerBridgeOnline(!!data.dockerBridgeOnline);

      if (data.dockerBridgeOnline) {
        addLog('⚡ Docker Phone Bridge Online (:8000) — Direct USB & Wireless Hardware active!');
      }

      if (data.devices && data.devices.length > 0) {
        setSelectedDevice(data.devices[0].serial);
        addLog(`ADB: Found ${data.devices.length} connected device(s): ${data.devices[0].model} (${data.devices[0].serial})`);
        fetchDeviceScreenshot();
      } else {
        addLog('ADB: Daemon active. Connect your physical Android phone via USB or enter Wi-Fi IP to pair.');
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
        addLog('ADB: Captured real device screen frame.');
      }
    } catch {
      // ignore
    }
  };

  const handleRealTap = async (x: number, y: number) => {
    addLog(`Agent: Dispatching real tap to (${Math.round(x)}, ${Math.round(y)}) via ADB...`);
    try {
      const res = await fetch('/api/phone/adb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tap', x, y }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`ADB: ${data.message}`);
        if (!useLiveStream) setTimeout(fetchDeviceScreenshot, 400);
      }
    } catch {
      // fallback
    }
  };

  const handleRealKey = async (keyCode: string) => {
    addLog(`Agent: Dispatching hardware key: ${keyCode} via ADB...`);
    try {
      const res = await fetch('/api/phone/adb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'key', keyCode }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`ADB: ${data.message}`);
        if (!useLiveStream) setTimeout(fetchDeviceScreenshot, 400);
      }
    } catch {
      // fallback
    }
  };

  const handleSendText = async () => {
    if (!textInputVal.trim()) return;
    addLog(`Agent: Typing text "${textInputVal}" on Android phone...`);
    try {
      await fetch('/api/phone/adb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'type', text: textInputVal }),
      });
      setTextInputVal('');
      if (!useLiveStream) setTimeout(fetchDeviceScreenshot, 400);
    } catch {
      // fallback
    }
  };

  const executeAutonomousGoal = async () => {
    if (!autonomousGoal.trim()) return;
    setIsExecuting(true);
    addLog(`Agentic Phone Controller: Received goal "${autonomousGoal}"`);

    const goalLower = autonomousGoal.toLowerCase();
    let targetPkg = '';
    if (goalLower.includes('uber')) targetPkg = 'com.ubercab';
    else if (goalLower.includes('whatsapp')) targetPkg = 'com.whatsapp';
    else if (goalLower.includes('maps')) targetPkg = 'com.google.android.apps.maps';
    else if (goalLower.includes('youtube')) targetPkg = 'com.google.android.youtube';
    else if (goalLower.includes('camera')) targetPkg = 'com.android.camera';
    else if (goalLower.includes('settings')) targetPkg = 'com.android.settings';
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
      setTimeout(fetchDeviceScreenshot, 800);
    } catch (err: unknown) {
      addLog(`ADB error: ${String(err)}`);
    } finally {
      setIsExecuting(false);
      setAutonomousGoal('');
    }
  };

  const handleScreenClick = (e: React.MouseEvent<HTMLImageElement | HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const normX = (clickX / rect.width) * 1080;
    const normY = (clickY / rect.height) * 2400;
    handleRealTap(normX, normY);
  };

  return (
    <div
      id="agentic-phone-mode-container"
      style={{
        display: 'grid',
        gridTemplateColumns: '430px 1fr 340px',
        height: 'calc(100vh - var(--header-height))',
        width: '100%',
        padding: '16px 24px',
        gap: '20px',
        overflow: 'hidden',
      }}
    >
      {/* Column 1: Physical Phone Mirror & Hardware Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="phone-mockup-frame" id="virtual-phone-simulator" style={{ width: '340px', height: '620px' }}>
          {/* Dynamic Island Header */}
          <div className="phone-island">
            <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>9:41</span>
            <div className="phone-camera-dot" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fff', fontSize: '10px' }}>
              <Wifi size={11} />
              <Battery size={11} />
            </div>
          </div>

          {/* Screen Content: Live Stream OR Screencap OR Virtual Simulator */}
          <div
            style={{
              flex: 1,
              marginTop: '44px',
              padding: '0',
              background: '#090d16',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {useLiveStream && dockerBridgeOnline ? (
              <img
                src={streamUrl}
                alt="Live Android Hardware Screen"
                style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair' }}
                onClick={handleScreenClick}
                onError={() => {
                  setUseLiveStream(false);
                  fetchDeviceScreenshot();
                }}
              />
            ) : screenshotData ? (
              <img
                src={screenshotData}
                alt="Captured Android Screen"
                style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair' }}
                onClick={handleScreenClick}
              />
            ) : (
              /* Virtual Android Display fallback */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                    {adbStatus.devices.length > 0 ? adbStatus.devices[0].model : 'Android Device'}
                  </span>
                  <span className={adbStatus.devices.length > 0 ? 'badge badge-emerald' : 'badge badge-amber'}>
                    {adbStatus.devices.length > 0 ? 'Hardware Online' : 'Simulator'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginTop: '10px' }}>
                  {[
                    { name: 'WhatsApp', icon: <MessageSquare size={20} />, pkg: 'com.whatsapp' },
                    { name: 'Uber', icon: <Car size={20} />, pkg: 'com.ubercab' },
                    { name: 'Maps', icon: <Navigation size={20} />, pkg: 'com.google.android.apps.maps' },
                    { name: 'Chrome', icon: <Smartphone size={20} />, pkg: 'com.android.chrome' },
                    { name: 'YouTube', icon: <Video size={20} />, pkg: 'com.google.android.youtube' },
                    { name: 'Camera', icon: <Camera size={20} />, pkg: 'com.android.camera' },
                    { name: 'Settings', icon: <Sliders size={20} />, pkg: 'com.android.settings' },
                    { name: 'Terminal', icon: <Terminal size={20} />, pkg: 'com.termux' },
                  ].map((app, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleRealTap(100 + (idx % 4) * 80, 200 + Math.floor(idx / 4) * 80)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '14px',
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                          border: '1px solid rgba(255,255,255,0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-cyan)',
                        }}
                      >
                        {app.icon}
                      </div>
                      <span style={{ fontSize: '10px', color: '#e2e8f0' }}>{app.name}</span>
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 'auto',
                    background: 'rgba(0, 0, 0, 0.5)',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  Direct Touch Enabled • Click screen to tap real coordinates
                </div>
              </div>
            )}
          </div>

          {/* Physical Phone Navigation Buttons Bar */}
          <div
            style={{
              height: '44px',
              background: '#090d16',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: '0 20px',
            }}
          >
            <button
              onClick={() => handleRealKey('BACK')}
              title="Back (Keycode 4)"
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              onClick={() => handleRealKey('HOME')}
              title="Home (Keycode 3)"
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <Home size={18} />
            </button>
            <button
              onClick={() => handleRealKey('RECENT_APPS')}
              title="Recent Apps (Keycode 187)"
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <Square size={16} />
            </button>
            <button
              onClick={() => handleRealKey('POWER')}
              title="Power / Lock (Keycode 26)"
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
            >
              <Power size={16} />
            </button>
          </div>
        </div>

        {/* Quick Hardware Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={() => handleRealKey('VOLUME_DOWN')}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '11px' }}
            title="Volume Down"
          >
            <Volume1 size={13} /> Vol -
          </button>
          <button
            onClick={() => handleRealKey('VOLUME_UP')}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '11px' }}
            title="Volume Up"
          >
            <Volume2 size={13} /> Vol +
          </button>
          <button
            onClick={fetchDeviceScreenshot}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '11px' }}
            title="Capture Screenshot"
          >
            <Camera size={13} /> Snap
          </button>
          <button
            onClick={() => setUseLiveStream(!useLiveStream)}
            className={`btn ${useLiveStream ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '11px' }}
            title="Toggle Live Stream"
          >
            <Video size={13} /> {useLiveStream ? 'Live Stream' : 'Static'}
          </button>
        </div>
      </div>

      {/* Column 2: Autonomous Goal Dispatcher & Real-Time Logcat */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {/* Hardware Status Banner */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                {adbStatus.devices.length > 0 ? `Physical Device: ${adbStatus.devices[0].model}` : 'Android Device Hub'}
              </span>
              <span className={adbStatus.devices.length > 0 ? 'badge badge-emerald' : 'badge badge-amber'}>
                {adbStatus.devices.length > 0 ? `${adbStatus.devices[0].serial} (Active)` : 'Scanning'}
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Direct physical Android hardware control via Dockerized ADB & USB/Wi-Fi daemon.
            </p>
          </div>
          <button
            onClick={scanAdbDevices}
            disabled={isScanning}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12px' }}
          >
            <RefreshCw className={isScanning ? 'spin-slow' : ''} size={14} />
            <span>Scan Devices</span>
          </button>
        </div>

        {/* Autonomous Phone Action Dispatcher */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              Autonomous Android Agent
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Give any goal in plain English (e.g. <i>"Open WhatsApp and send message"</i>, <i>"Book an Uber"</i>, <i>"Open YouTube"</i>).
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={autonomousGoal}
              onChange={(e) => setAutonomousGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && executeAutonomousGoal()}
              placeholder="e.g. Open WhatsApp or Uber to book ride..."
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '13px',
              }}
            />
            <button
              onClick={executeAutonomousGoal}
              disabled={isExecuting || !autonomousGoal.trim()}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '13px' }}
            >
              {isExecuting ? <RefreshCw className="spin-slow" size={15} /> : <Play size={15} />}
              <span>Dispatch</span>
            </button>
          </div>

          {/* Quick Hardware Text Input Bar */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <input
              type="text"
              value={textInputVal}
              onChange={(e) => setTextInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Inject keyboard text directly onto phone screen..."
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                color: '#cbd5e1',
                fontSize: '12px',
              }}
            />
            <button
              onClick={handleSendText}
              disabled={!textInputVal.trim()}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '12px' }}
            >
              <Send size={13} /> Type
            </button>
          </div>
        </div>

        {/* Live ADB Protocol & Execution Logs */}
        <div
          className="glass-panel"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: '220px',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                Hardware Bridge & ADB Event Stream
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Port 5037 • Kernel Input Dispatcher
            </span>
          </div>

          <div
            style={{
              flex: 1,
              padding: '14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11.5px',
              lineHeight: '1.7',
              overflowY: 'auto',
              color: '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {activeLog.map((log, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                <span style={{ color: 'var(--accent-cyan)', userSelect: 'none' }}>&gt;</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column 3: Wireless ADB Pairing & Device Hardware Settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {/* Wireless ADB Connect Card */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wifi size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
              Wireless ADB Pairing
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Enable <b>Wireless Debugging</b> in Developer Options on your phone and enter the IP address:
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={wirelessIp}
              onChange={(e) => setWirelessIp(e.target.value)}
              placeholder="192.168.1.xxx:5555"
              style={{
                flex: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
                color: '#fff',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
              }}
            />
            <button
              onClick={handleConnectWireless}
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              <Link2 size={13} /> Connect
            </button>
          </div>
        </div>

        {/* Multi-Device Architecture Specs */}
        <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
            Device Bridge Architecture
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Direct USB Passthrough</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>/dev/bus/usb</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>ADB Daemon Port</span>
              <span style={{ color: 'var(--accent-cyan)' }}>0.0.0.0:5037</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>MJPEG Screen Stream</span>
              <span style={{ color: 'var(--accent-cyan)' }}>:8000/stream</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Touch Coordinate Scale</span>
              <span style={{ color: '#fff' }}>1080 x 2400 px</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Accessibility Daemon</span>
              <span style={{ color: '#10b981' }}>Active (Port 8765)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
