'use client';

import React, { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Split content by code blocks ```...```
  const parseBlocks = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      // Code block
      if (part.startsWith('```') && part.endsWith('```')) {
        const firstLineEnd = part.indexOf('\n');
        let language = 'text';
        let code = '';

        if (firstLineEnd !== -1) {
          language = part.slice(3, firstLineEnd).trim() || 'text';
          code = part.slice(firstLineEnd + 1, -3);
        } else {
          code = part.slice(3, -3);
        }

        const isCopied = copiedIndex === index;

        return (
          <div
            key={index}
            style={{
              margin: '12px 0',
              borderRadius: 'var(--radius-sm)',
              background: '#0d1117',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Code Block Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Terminal size={12} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ textTransform: 'uppercase', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                  {language}
                </span>
              </div>
              <button
                onClick={() => handleCopy(code, index)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: isCopied ? 'var(--accent-emerald)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                {isCopied ? <Check size={12} /> : <Copy size={12} />}
                <span>{isCopied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            {/* Code Content */}
            <pre
              style={{
                margin: 0,
                padding: '12px 14px',
                overflowX: 'auto',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '12.5px',
                lineHeight: '1.5',
                color: '#e6edf3',
              }}
            >
              <code>{code.trim()}</code>
            </pre>
          </div>
        );
      }

      // Regular text formatting (lines, lists, headers, quotes)
      return <div key={index}>{renderFormattedText(part)}</div>;
    });
  };

  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');

    return lines.map((line, lIdx) => {
      // Empty line
      if (!line.trim()) {
        return <div key={lIdx} style={{ height: '8px' }} />;
      }

      // H3
      if (line.startsWith('### ')) {
        return (
          <h3
            key={lIdx}
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--accent-cyan)',
              margin: '12px 0 6px 0',
            }}
          >
            {renderInlineSpans(line.replace('### ', ''))}
          </h3>
        );
      }

      // H2
      if (line.startsWith('## ')) {
        return (
          <h2
            key={lIdx}
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#fff',
              margin: '14px 0 8px 0',
            }}
          >
            {renderInlineSpans(line.replace('## ', ''))}
          </h2>
        );
      }

      // H1
      if (line.startsWith('# ')) {
        return (
          <h1
            key={lIdx}
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: '#fff',
              margin: '16px 0 10px 0',
            }}
          >
            {renderInlineSpans(line.replace('# ', ''))}
          </h1>
        );
      }

      // Blockquote
      if (line.startsWith('> ')) {
        return (
          <blockquote
            key={lIdx}
            style={{
              margin: '6px 0',
              paddingLeft: '12px',
              borderLeft: '3px solid var(--accent-cyan)',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
            }}
          >
            {renderInlineSpans(line.replace('> ', ''))}
          </blockquote>
        );
      }

      // Bullet List
      if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
        return (
          <div
            key={lIdx}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              margin: '3px 0',
              paddingLeft: '4px',
            }}
          >
            <span style={{ color: 'var(--accent-cyan)', fontSize: '14px', lineHeight: '1.5' }}>•</span>
            <div style={{ flex: 1, lineHeight: '1.6' }}>
              {renderInlineSpans(line.replace(/^[-*•]\s+/, ''))}
            </div>
          </div>
        );
      }

      // Regular paragraph
      return (
        <p key={lIdx} style={{ margin: '4px 0', lineHeight: '1.6' }}>
          {renderInlineSpans(line)}
        </p>
      );
    });
  };

  const renderInlineSpans = (text: string) => {
    // Split by inline code `...`, bold **...**, link [title](url)
    const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);

    return tokens.map((token, tIdx) => {
      // Inline code
      if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
        return (
          <code
            key={tIdx}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--accent-cyan)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '12.5px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            {token.slice(1, -1)}
          </code>
        );
      }

      // Bold
      if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
        return (
          <strong key={tIdx} style={{ fontWeight: 700, color: '#fff' }}>
            {token.slice(2, -2)}
          </strong>
        );
      }

      // Link
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        return (
          <a
            key={tIdx}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--accent-cyan)',
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            <span>{linkMatch[1]}</span>
            <ExternalLink size={10} />
          </a>
        );
      }

      return token;
    });
  };

  return <div style={{ display: 'flex', flexDirection: 'column' }}>{parseBlocks(content)}</div>;
};
