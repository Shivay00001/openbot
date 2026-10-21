'use client';

import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Terminal, 
  Folder, 
  FileText, 
  Play, 
  ShieldAlert, 
  CheckCircle, 
  RefreshCw, 
  Layers, 
  MousePointer, 
  Keyboard, 
  HardDrive,
  FileCode,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
}

interface CommandLog {
  id: string;
  command: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export const DesktopModeView: React.FC = () => {
  const [commandInput, setCommandInput] = useState('git status');
  const [commandHistory, setCommandHistory] = useState<CommandLog[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'files' | 'docker-os'>('docker-os');

  // Real File System State
  const [currentDirPath, setCurrentDirPath] = useState<string>('');
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [selectedFileContent, setSelectedFileContent] = useState<{ path: string; content: string } | null>(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Load real workspace directory on mount
  useEffect(() => {
    loadRealFiles('');
    // Run initial command
    runRealCommand('node -v; npm -v; git status --short');
  }, []);

  const loadRealFiles = async (dirPath: string) => {
    setIsLoadingFiles(true);
    try {
      const res = await fetch(`/api/fs?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (data.items) {
        setFileItems(data.items);
        setCurrentDirPath(dirPath);
      }
    } catch {
      // fallback
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleOpenFile = async (item: FileItem) => {
    if (item.isDirectory) {
      loadRealFiles(item.path);
    } else {
      try {
        const res = await fetch(`/api/fs?path=${encodeURIComponent(item.path)}&read=true`);
        const data = await res.json();
        if (data.content !== undefined) {
          setSelectedFileContent({ path: item.path, content: data.content });
        }
      } catch {
        // fallback
      }
    }
  };

  const runRealCommand = async (cmdToRun: string) => {
    if (!cmdToRun.trim() || isExecuting) return;
    setIsExecuting(true);
    try {
      const res = await fetch('/api/shell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmdToRun.trim() }),
      });
      const data = await res.json();
      const newLog: CommandLog = {
        id: `cmd-${Date.now()}`,
        command: cmdToRun.trim(),
        cwd: data.cwd || 'openbot',
        stdout: data.stdout || '',
        stderr: data.stderr || '',
        exitCode: data.exitCode || 0,
        durationMs: data.durationMs || 10,
      };
      setCommandHistory((prev) => [newLog, ...prev]);
    } catch (err: unknown) {
      const errorLog: CommandLog = {
        id: `cmd-${Date.now()}`,
        command: cmdToRun,
        cwd: 'openbot',
        stdout: '',
        stderr: err instanceof Error ? err.message : 'Execution failed',
        exitCode: 1,
        durationMs: 0,
      };
      setCommandHistory((prev) => [errorLog, ...prev]);
    } finally {
      setIsExecuting(false);
      setCommandInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runRealCommand(commandInput);
    }
  };

  return (
    <div
      id="agentic-desktop-mode-container"
      style={{
        display: 'grid',
        gridTemplateColumns: '340px 1fr',
        height: 'calc(100vh - var(--header-height))',
        width: '100%',
        padding: '20px 28px',
        gap: '24px',
        overflow: 'hidden',
      }}
    >
      {/* Left Column: Real OS Host & Real File Explorer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
        {/* Real Host Environment Status */}
        <div className="glass-panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Monitor size={20} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <span style={{ fontSize: '14px', fontWeight: 700 }}>Real Host Machine Shell</span>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Windows 11 PowerShell Sandbox</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Shell Engine</span>
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>Active (powershell.exe)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Execution Sandbox</span>
              <span className="badge badge-emerald">Live OS Subprocess</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Working Directory</span>
              <span style={{ color: '#fff', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>openbot/</span>
            </div>
          </div>
        </div>

        {/* Real Workspace File Explorer */}
        <div className="glass-panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={16} style={{ color: 'var(--accent-amber)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Real Workspace Files</span>
            </div>
            {currentDirPath && (
              <button
                onClick={() => {
                  const parts = currentDirPath.split('/');
                  parts.pop();
                  loadRealFiles(parts.join('/'));
                }}
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: '11px' }}
              >
                Up
              </button>
            )}
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
            /{currentDirPath || 'workspace root'}
          </div>

          {/* Real file list */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {isLoadingFiles ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Reading real file system...</div>
            ) : fileItems.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Directory is empty</div>
            ) : (
              fileItems.map((item) => (
                <div
                  key={item.path}
                  onClick={() => handleOpenFile(item)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-light)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.isDirectory ? (
                      <Folder size={14} style={{ color: 'var(--accent-amber)' }} />
                    ) : (
                      <FileText size={14} style={{ color: 'var(--accent-cyan)' }} />
                    )}
                    <span style={{ color: item.isDirectory ? '#fff' : '#cbd5e1' }}>{item.name}</span>
                  </div>
                  {!item.isDirectory && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      {(item.size / 1024).toFixed(1)}k
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Quick Real Commands */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>1-Click Real Host Commands:</span>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={() => runRealCommand('git status')}
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                git status
              </button>
              <button
                onClick={() => runRealCommand('dir')}
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                dir
              </button>
              <button
                onClick={() => runRealCommand('node -v; npm -v')}
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                versions
              </button>
              <button
                onClick={() => runRealCommand('npm run build --prefix packages/core')}
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 8px' }}
              >
                build core
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Real Terminal Output & File Viewer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('docker-os')}
            className={`btn ${activeTab === 'docker-os' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            <Monitor size={15} />
            <span>Dockerized OS Desktop (noVNC GUI)</span>
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`btn ${activeTab === 'terminal' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            <Terminal size={15} />
            <span>Host Shell Console</span>
          </button>
          {selectedFileContent && (
            <button
              onClick={() => setActiveTab('files')}
              className={`btn ${activeTab === 'files' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              <FileCode size={15} />
              <span>Viewing: {selectedFileContent.path.split('/').pop()}</span>
            </button>
          )}
        </div>

        {/* Tab 0: Dockerized OS Desktop (noVNC Web Desktop) */}
        {activeTab === 'docker-os' && (
          <div
            className="glass-panel"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#07090e',
              border: '1px solid #1e293b',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              minHeight: '480px',
            }}
          >
            {/* noVNC Header Bar */}
            <div
              style={{
                height: '42px',
                background: '#0f172a',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                  Ubuntu XFCE Desktop Sandbox (Docker OS :6080)
                </span>
                <span className="badge badge-emerald" style={{ fontSize: '10px' }}>
                  Live noVNC GUI
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => window.open('http://localhost:6080', '_blank')}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <ExternalLink size={12} />
                  <span>Open in Full Tab</span>
                </button>
              </div>
            </div>

            {/* Embedded noVNC Web Desktop Frame */}
            <div style={{ flex: 1, position: 'relative', background: '#000' }}>
              <iframe
                src="http://localhost:6080"
                title="OpenBot Dockerized OS Desktop"
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  minHeight: '460px',
                }}
              />
            </div>
          </div>
        )}

        {/* Tab 1: Terminal Console */}
        {activeTab === 'terminal' && (
          <div
            className="glass-panel"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#07090e',
              border: '1px solid #1e293b',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            {/* Terminal Header */}
            <div
              style={{
                height: '38px',
                background: '#0f172a',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '8px', fontFamily: 'var(--font-mono)' }}>
                  PowerShell (Live OS Subprocess)
                </span>
              </div>
              <span className="badge badge-emerald" style={{ fontSize: '10px' }}>
                Zero Mock • Real Host OS
              </span>
            </div>

            {/* Terminal Output Stream */}
            <div
              id="terminal-output-container"
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                lineHeight: '1.6',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {commandHistory.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>
                  Type any real shell command below (e.g. `dir`, `git status`, `npm test`, `ipconfig`). It will execute directly on your host machine.
                </div>
              ) : (
                commandHistory.map((cmd) => (
                  <div key={cmd.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
                      <span>PS {cmd.cwd}&gt;</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{cmd.command}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({cmd.durationMs}ms)</span>
                    </div>
                    {cmd.stdout && (
                      <div style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap', marginTop: '4px' }}>
                        {cmd.stdout}
                      </div>
                    )}
                    {cmd.stderr && (
                      <div style={{ color: '#ef4444', whiteSpace: 'pre-wrap', marginTop: '4px' }}>
                        {cmd.stderr}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Prompt Input Bar */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #1e293b',
                background: '#0b0f19',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>&gt;</span>
              <input
                id="terminal-command-input"
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type real host shell command (e.g. 'dir', 'git status', 'node -v')..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: '#fff',
                }}
              />
              <button
                id="btn-run-terminal-command"
                onClick={() => runRealCommand(commandInput)}
                disabled={isExecuting}
                className="btn btn-primary"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                {isExecuting ? <RefreshCw className="spin-slow" size={14} /> : <Play size={14} />}
                <span>{isExecuting ? 'Running...' : 'Execute'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Real File Content Viewer */}
        {activeTab === 'files' && selectedFileContent && (
          <div
            className="glass-panel"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: '#07090e',
              border: '1px solid #1e293b',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '38px',
                background: '#0f172a',
                borderBottom: '1px solid #1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
              }}
            >
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                {selectedFileContent.path}
              </span>
              <button
                onClick={() => setSelectedFileContent(null)}
                className="btn btn-secondary"
                style={{ padding: '2px 8px', fontSize: '11px' }}
              >
                Close Viewer
              </button>
            </div>

            <pre
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#e2e8f0',
                margin: 0,
              }}
            >
              {selectedFileContent.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
