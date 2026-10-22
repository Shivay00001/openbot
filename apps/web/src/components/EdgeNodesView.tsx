'use client';

import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Monitor, 
  Smartphone, 
  Play, 
  RefreshCw, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Layers, 
  Activity, 
  MousePointer, 
  Keyboard, 
  Camera, 
  Key, 
  Link2, 
  Zap, 
  ArrowRight,
  Terminal,
  ShieldCheck
} from 'lucide-react';

interface DeviceNodeState {
  laptop: {
    online: boolean;
    url: string;
    details?: {
      status?: string;
      os?: string;
      arch?: string;
      port?: number;
      cursor?: { x: number; y: number };
      uptimeSeconds?: number;
    };
  };
  phone: {
    online: boolean;
    mode: string;
    details?: {
      status?: string;
      phoneIp?: string;
      port?: number;
    };
  };
}

interface StepLog {
  stepIndex: number;
  device: 'laptop' | 'phone';
  action: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  observation?: string;
}

export const EdgeNodesView: React.FC = () => {
  const [nodes, setNodes] = useState<DeviceNodeState>({
    laptop: { online: false, url: 'http://localhost:4002' },
    phone: { online: false, mode: 'direct_http' },
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [taskGoal, setTaskGoal] = useState('Open bank on laptop and auto-read OTP from phone');
  const [targetDevice, setTargetDevice] = useState<'auto' | 'laptop' | 'phone'>('auto');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<StepLog[]>([]);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // Poll nodes health on mount
  useEffect(() => {
    fetchNodesHealth();
    const interval = setInterval(fetchNodesHealth, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchNodesHealth = async () => {
    try {
      const res = await fetch('/api/nodes');
      const data = await res.json();
      if (data.nodes) {
        setNodes(data.nodes);
      }
    } catch {
      // ignore
    }
  };

  const handleExecuteAutonomousTask = async (customGoal?: string) => {
    const goalToRun = customGoal || taskGoal;
    if (!goalToRun.trim() || isExecuting) return;

    setIsExecuting(true);
    setFinalResult(null);
    setExecutionSteps([
      {
        stepIndex: 1,
        device: 'laptop',
        action: 'Orchestrator Planning',
        parameters: { goal: goalToRun },
        status: 'executing',
        observation: 'Analyzing natural goal and routing to Edge Node Servers...',
      },
    ]);

    try {
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalToRun, target: targetDevice }),
      });
      const data = await res.json();

      if (data.result && data.result.steps) {
        setExecutionSteps(data.result.steps);
        setFinalResult(data.result.finalMessage || 'Task executed successfully!');
      } else {
        setFinalResult(data.error || 'Execution encountered an error.');
      }
    } catch (err: unknown) {
      setFinalResult(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  // Quick Action: Test Laptop Mouse
  const handleTestLaptopMouse = async () => {
    try {
      await fetch('http://localhost:4002/action/mouse/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x: 960, y: 540, smooth: true }),
      });
      fetchNodesHealth();
    } catch {
      // fallback
    }
  };

  // Quick Action: Test Laptop Typing
  const handleTestLaptopType = async () => {
    try {
      await fetch('http://localhost:4002/action/keyboard/type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hello from OpenBot Edge Server!' }),
      });
    } catch {
      // fallback
    }
  };

  // Quick Action: Test Phone Tap
  const handleTestPhoneTap = async () => {
    try {
      await fetch('/api/phone/adb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tap', x: 540, y: 1200 }),
      });
    } catch {
      // fallback
    }
  };

  return (
    <div
      id="edge-nodes-view-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - var(--header-height))',
        width: '100%',
        padding: '20px 28px',
        gap: '20px',
        overflowY: 'auto',
      }}
    >
      {/* Top Banner: Edge Architecture Overview */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Server size={22} style={{ color: 'var(--accent-cyan)' }} />
            <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', margin: 0 }}>
              Multi-Device Edge Servers & Autonomous Agent Hub
            </h1>
            <span className="badge badge-emerald" style={{ fontSize: '10px' }}>
              Human-Like SOTA
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '750px' }}>
            Both your Laptop (port 4002) and Android Phone (port 8765) run local edge daemons. The AI Agent perceives both screens, executes smooth human-like mouse/touch gestures, and coordinates cross-device tasks autonomously.
          </p>
        </div>

        <button
          onClick={fetchNodesHealth}
          disabled={isRefreshing}
          className="btn btn-secondary"
          style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw className={isRefreshing ? 'spin-slow' : ''} size={14} />
          <span>Refresh Nodes</span>
        </button>
      </div>

      {/* Grid: Laptop Server vs Phone Server Live Telemetry */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Node 1: Laptop Edge Server */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Monitor size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                Laptop Edge Server (:4002)
              </span>
            </div>
            <span className={nodes.laptop.online ? 'badge badge-emerald' : 'badge badge-amber'}>
              {nodes.laptop.online ? 'Online • Listening' : 'Starting / Standby'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Operating System</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>Windows (Win32 P/Invoke)</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Cursor Position</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                {nodes.laptop.details?.cursor ? `(${nodes.laptop.details.cursor.x}, ${nodes.laptop.details.cursor.y})` : 'Live Tracking'}
              </span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Motor Engine</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Bezier Smooth Curves</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Typing Simulation</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>Human Cadence (50-110ms)</span>
            </div>
          </div>

          {/* Quick Hardware Actions */}
          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
            <button onClick={handleTestLaptopMouse} className="btn btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '11px' }}>
              <MousePointer size={12} /> Test Move
            </button>
            <button onClick={handleTestLaptopType} className="btn btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '11px' }}>
              <Keyboard size={12} /> Test Typing
            </button>
          </div>
        </div>

        {/* Node 2: Phone Edge Server */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Smartphone size={18} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                Phone Edge Server (:8765)
              </span>
            </div>
            <span className={nodes.phone.online ? 'badge badge-emerald' : 'badge badge-cyan'}>
              {nodes.phone.online ? 'Active • Wi-Fi Rootless' : 'ADB Daemon Bridge'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Daemon Server</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>LocalPhoneServer.kt</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Automation Engine</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Android Accessibility</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Gesture Dispatcher</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Real Kernel Touches</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>OTP / SMS Interceptor</span>
              <span style={{ color: '#fff', fontWeight: 600 }}>Zero-Cloud Local Sync</span>
            </div>
          </div>

          {/* Quick Hardware Actions */}
          <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
            <button onClick={handleTestPhoneTap} className="btn btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '11px' }}>
              <Zap size={12} /> Test Tap
            </button>
            <button onClick={() => handleExecuteAutonomousTask('Open WhatsApp on phone')} className="btn btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '11px' }}>
              <Smartphone size={12} /> Launch App
            </button>
          </div>
        </div>
      </div>

      {/* Autonomous Human-Like Multi-Device Agent Execution Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} style={{ color: 'var(--accent-cyan)' }} />
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>
              Autonomous Multi-Device Execution Brain
            </h2>
          </div>
          {/* Target Selector */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['auto', 'laptop', 'phone'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTargetDevice(t)}
                className={`btn ${targetDevice === t ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 12px', fontSize: '11px', textTransform: 'capitalize' }}
              >
                {t === 'auto' ? 'Auto-Route' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={taskGoal}
            onChange={(e) => setTaskGoal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecuteAutonomousTask()}
            placeholder="Type any natural task (e.g. 'Open bank on laptop and auto-read OTP from phone', 'Open WhatsApp and reply')..."
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 16px',
              color: '#fff',
              fontSize: '13px',
            }}
          />
          <button
            onClick={() => handleExecuteAutonomousTask()}
            disabled={isExecuting || !taskGoal.trim()}
            className="btn btn-primary"
            style={{ padding: '12px 24px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isExecuting ? <RefreshCw className="spin-slow" size={15} /> : <Play size={15} />}
            <span>{isExecuting ? 'Agent Executing...' : 'Execute Task'}</span>
          </button>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            'Open bank on laptop and auto-read OTP from phone',
            'Open WhatsApp on phone and text John',
            'Open Terminal on laptop and run git status',
            'Launch Uber on phone and check rides',
          ].map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTaskGoal(preset);
                handleExecuteAutonomousTask(preset);
              }}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '14px' }}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Step-by-Step Autonomous Trajectory Visualizer */}
        {executionSteps.length > 0 && (
          <div
            style={{
              marginTop: '12px',
              background: '#07090e',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>
                Live Execution Steps & Visual Grounding Loop
              </span>
              {finalResult && (
                <span className="badge badge-emerald" style={{ fontSize: '11px' }}>
                  {finalResult}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {executionSteps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    borderLeft: `3px solid ${step.device === 'laptop' ? 'var(--accent-cyan)' : 'var(--accent-emerald)'}`,
                  }}
                >
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', paddingTop: '2px' }}>
                    #{step.stepIndex}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={step.device === 'laptop' ? 'badge badge-cyan' : 'badge badge-emerald'} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                        {step.device}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                        {step.action}
                      </span>
                      <span className={`badge ${step.status === 'completed' ? 'badge-emerald' : step.status === 'executing' ? 'badge-cyan' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                        {step.status}
                      </span>
                    </div>
                    {step.observation && (
                      <p style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px', margin: 0 }}>
                        {step.observation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
