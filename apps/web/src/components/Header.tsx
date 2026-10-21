'use client';

import React from 'react';
import { 
  Bot, 
  Smartphone, 
  Monitor, 
  Globe, 
  Cpu, 
  Sparkles, 
  PhoneCall, 
  Key,
  ShieldCheck,
} from 'lucide-react';
import type { AppMode } from '../lib/state';

interface HeaderProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  onOpenSettings: () => void;
  isZeroCloudActive: boolean;
  activeModelName: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onSelectMode,
  onOpenSettings,
  isZeroCloudActive,
  activeModelName,
}) => {
  const navItems: Array<{ id: AppMode; label: string; icon: React.ReactNode; badge?: string }> = [
    { id: 'chat', label: 'Chat Agent', icon: <Bot size={17} /> },
    { id: 'phone', label: 'Agentic Phone', icon: <Smartphone size={17} />, badge: 'USP' },
    { id: 'desktop', label: 'Own Computer', icon: <Monitor size={17} /> },
    { id: 'browser', label: 'Browser Agent', icon: <Globe size={17} /> },
    { id: 'local-weights', label: 'Local Weights', icon: <Cpu size={17} />, badge: 'On-Device' },
    { id: 'skills', label: 'Skills & Routines', icon: <Sparkles size={17} /> },
    { id: 'voice', label: 'Voice Calls', icon: <PhoneCall size={17} /> },
  ];

  return (
    <header
      id="openbot-main-header"
      style={{
        height: 'var(--header-height)',
        background: 'var(--bg-glass-heavy)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          id="openbot-logo"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
            boxShadow: '0 0 16px rgba(0, 242, 254, 0.4)',
          }}
        >
          <Bot size={22} strokeWidth={2.4} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Open<span className="gradient-text">Bot</span>
            </span>
            <span className="badge badge-cyan" style={{ fontSize: '10px' }}>v0.1-PROD</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Universal Autonomous Agent
          </div>
        </div>
      </div>

      {/* Mode Navigation Bar */}
      <nav
        id="openbot-mode-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(0, 0, 0, 0.45)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {navItems.map((item) => {
          const isActive = currentMode === item.id;
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => onSelectMode(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                border: isActive ? '1px solid var(--border-light)' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ color: isActive ? 'var(--accent-cyan)' : 'inherit' }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.badge && (
                <span
                  style={{
                    fontSize: '9px',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontWeight: 700,
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right Controls: Model indicator & BYOK Vault */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Active Engine Badge */}
        <div
          id="openbot-engine-status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: 'var(--radius-full)',
            background: isZeroCloudActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
            border: `1px solid ${isZeroCloudActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          <span className={isZeroCloudActive ? 'live-indicator' : 'live-indicator live-indicator-cyan'} />
          <span style={{ color: isZeroCloudActive ? 'var(--accent-emerald)' : 'var(--accent-cyan)' }}>
            {isZeroCloudActive ? 'Zero-Cloud (Local Weights)' : 'Hybrid BYOK Engine'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            [{activeModelName.split(' ')[0]}]
          </span>
        </div>

        {/* BYOK Settings Trigger */}
        <button
          id="btn-open-settings"
          onClick={onOpenSettings}
          className="btn btn-secondary"
          style={{ padding: '8px 14px', fontSize: '13px' }}
        >
          <Key size={15} style={{ color: 'var(--accent-cyan)' }} />
          <span>BYOK Vault</span>
          <ShieldCheck size={14} style={{ color: 'var(--accent-emerald)' }} />
        </button>
      </div>
    </header>
  );
};
