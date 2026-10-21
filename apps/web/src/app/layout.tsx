import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OpenBot — Universal Autonomous AI Agent & Device Platform',
  description:
    'Production-grade open-source AI platform combining GrokBot, Manus, OpenAI Dot, and Cue. Features integrated local model weights, Agentic Phone Mode, Desktop "Own Computer" control, Multi-tab Browser automation, and BYOK cloud routing.',
  keywords: [
    'OpenBot',
    'autonomous agent',
    'local models',
    'GGUF',
    'agentic phone mode',
    'desktop automation',
    'Manus AI alternative',
    'GrokBot',
    'WebGPU',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        <div id="openbot-app-root">
          {children}
        </div>
      </body>
    </html>
  );
}
