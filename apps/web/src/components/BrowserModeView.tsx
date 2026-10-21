'use client';

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plus, 
  X, 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Lock, 
  Search, 
  CheckCircle, 
  Layers, 
  MousePointer, 
  ExternalLink, 
  Code,
  Download,
  Link as LinkIcon
} from 'lucide-react';

interface ExtractedLink {
  href: string;
  text: string;
}

interface WebpageData {
  url: string;
  title: string;
  description: string;
  durationMs: number;
  wordCount: number;
  links: ExtractedLink[];
  content: string;
  status: number;
}

export const BrowserModeView: React.FC = () => {
  const [urlInput, setUrlInput] = useState('https://news.ycombinator.com');
  const [isLoading, setIsLoading] = useState(false);
  const [pageData, setPageData] = useState<WebpageData | null>(null);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<'content' | 'screenshot'>('content');
  const [browserLogs, setBrowserLogs] = useState<string[]>([
    'Browser Agent: Multi-engine web automation ready (Fast DOM + Docker Chromium CDP).',
  ]);

  // Load initial page on mount
  useEffect(() => {
    fetchRealPage('https://news.ycombinator.com');
  }, []);

  const captureChromiumScreenshot = async () => {
    if (!urlInput.trim()) return;
    setIsLoading(true);
    setBrowserLogs((prev) => [`Docker Browser: Capturing real Chromium snapshot of ${urlInput}...`, ...prev]);
    try {
      const res = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), action: 'screenshot' }),
      });
      const data = await res.json();
      if (data.screenshot) {
        setScreenshotData(data.screenshot);
        setViewTab('screenshot');
        setBrowserLogs((prev) => [`Success: Captured real Chromium pixel screenshot from Docker sandbox.`, ...prev]);
      } else {
        setBrowserLogs((prev) => [`Notice: Fallback to DOM view (${data.error || 'Docker browser offline'})`, ...prev]);
      }
    } catch {
      setBrowserLogs((prev) => [`Error: Screenshot failed`, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRealPage = async (targetUrl: string) => {
    if (!targetUrl.trim() || isLoading) return;
    setIsLoading(true);
    setBrowserLogs((prev) => [`Browser Agent: Fetching live HTML from ${targetUrl}...`, ...prev]);

    try {
      const res = await fetch('/api/browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setPageData(data);
        setUrlInput(data.url);
        setBrowserLogs((prev) => [
          `Success: Fetched ${data.title} (${data.wordCount} words, ${data.links?.length || 0} links) in ${data.durationMs}ms.`,
          ...prev,
        ]);
      } else {
        setBrowserLogs((prev) => [`Browser Error: ${data.error || 'Failed to fetch page'}`, ...prev]);
      }
    } catch (err: unknown) {
      setBrowserLogs((prev) => [`Fetch Error: ${err instanceof Error ? err.message : 'Network error'}`, ...prev]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchRealPage(urlInput);
    }
  };

  return (
    <div
      id="browser-agent-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - var(--header-height))',
        width: '100%',
        padding: '16px 24px',
        gap: '14px',
      }}
    >
      {/* Browser Navigation Bar */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 14px',
          background: 'rgba(15, 20, 30, 0.9)',
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => fetchRealPage(urlInput)}
            disabled={isLoading}
            className="btn-icon"
            style={{ width: '30px', height: '30px' }}
          >
            <RotateCw className={isLoading ? 'spin-slow' : ''} size={14} />
          </button>
        </div>

        {/* URL Input Bar */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.45)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Lock size={13} style={{ color: 'var(--accent-emerald)' }} />
          <input
            id="browser-url-input"
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter any live URL (e.g. 'https://github.com/trending', 'https://wikipedia.org')..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>

        <button
          id="btn-browser-navigate"
          onClick={() => fetchRealPage(urlInput)}
          disabled={isLoading}
          className="btn btn-primary"
          style={{ padding: '6px 14px', fontSize: '12px' }}
        >
          <span>{isLoading ? 'Navigating...' : 'Navigate Live'}</span>
        </button>

        <button
          onClick={captureChromiumScreenshot}
          disabled={isLoading}
          className="btn btn-secondary"
          style={{ padding: '6px 14px', fontSize: '12px' }}
        >
          <span>Chromium Snapshot</span>
        </button>

        {/* Quick Presets */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => fetchRealPage('https://news.ycombinator.com')}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            Hacker News
          </button>
          <button
            onClick={() => fetchRealPage('https://github.com/trending')}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            GitHub Trending
          </button>
          <button
            onClick={() => fetchRealPage('https://en.wikipedia.org/wiki/Artificial_intelligence')}
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            Wikipedia AI
          </button>
        </div>
      </div>

      {/* Main Workspace: Real Content Viewport + Live Agent Inspector */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Real Web Content Viewport */}
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: '#ffffff',
            borderRadius: 'var(--radius-md)',
            color: '#1e293b',
          }}
        >
          {/* Tab Header: DOM Content vs Chromium Snapshot */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 16px' }}>
            <button
              onClick={() => setViewTab('content')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                fontWeight: 600,
                fontSize: '12px',
                color: viewTab === 'content' ? '#2563eb' : '#64748b',
                borderBottom: viewTab === 'content' ? '2px solid #2563eb' : 'none',
                cursor: 'pointer',
              }}
            >
              Extracted DOM View
            </button>
            <button
              onClick={() => setViewTab('screenshot')}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                fontWeight: 600,
                fontSize: '12px',
                color: viewTab === 'screenshot' ? '#2563eb' : '#64748b',
                borderBottom: viewTab === 'screenshot' ? '2px solid #2563eb' : 'none',
                cursor: 'pointer',
              }}
            >
              Chromium Pixel Snapshot {screenshotData && '●'}
            </button>
          </div>

          {viewTab === 'screenshot' && screenshotData ? (
            <div style={{ flex: 1, overflowY: 'auto', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <img src={screenshotData} alt="Live Chromium Screenshot" style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
            </div>
          ) : pageData ? (
            <div
              style={{
                flex: 1,
                padding: '24px 32px',
                overflowY: 'auto',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                    {pageData.title}
                  </h2>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {pageData.url} • HTTP {pageData.status} • {pageData.wordCount} words • {pageData.durationMs}ms latency
                  </div>
                </div>
                <a
                  href={pageData.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: '#2563eb',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  <span>Open in Tab</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              {pageData.description && (
                <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', color: '#334155', marginBottom: '16px', fontStyle: 'italic' }}>
                  {pageData.description}
                </div>
              )}

              {/* Real Extracted Clean Text */}
              <div style={{ fontSize: '14px', lineHeight: '1.7', color: '#334155', whiteSpace: 'pre-wrap' }}>
                {pageData.content}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
              {isLoading ? 'Fetching live webpage...' : 'Enter a URL above to load real web content'}
            </div>
          )}
        </div>

        {/* Right Sidebar: Real Extracted Links & Agent Telemetry */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'hidden' }}>
          {/* Extracted Hyperlinks */}
          <div className="glass-panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LinkIcon size={14} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Extracted Hyperlinks</span>
              </div>
              <span className="badge badge-cyan">{pageData?.links?.length || 0}</span>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px',
              }}
            >
              {pageData?.links?.map((link, idx) => (
                <div
                  key={idx}
                  onClick={() => fetchRealPage(link.href)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    color: 'var(--accent-cyan)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-light)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
                  title={link.href}
                >
                  {link.text || link.href}
                </div>
              ))}
            </div>
          </div>

          {/* Action Log Card */}
          <div className="glass-panel" style={{ height: '180px', padding: '14px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Live Scraper Log
            </span>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: '#cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {browserLogs.map((log, idx) => (
                <div key={idx} style={{ borderLeft: '2px solid var(--accent-cyan)', paddingLeft: '6px' }}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
