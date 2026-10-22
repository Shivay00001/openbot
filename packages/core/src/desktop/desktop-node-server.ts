/**
 * OpenBot Desktop Edge Node Server 💻⚡
 * Turns any laptop/PC (Windows, macOS, Linux) into an autonomous Edge Execution Server on port 4002.
 * Exposes low-latency HTTP REST & WebSocket APIs for human-like motor input (smooth mouse, typing),
 * visual screen capture, window management, application control, and shell execution.
 */

import http from 'http';
import { WindowsNativeDriver } from '../computer/windows-native-driver.js';

export interface DesktopServerConfig {
  port?: number;
  host?: string;
}

export class DesktopNodeServer {
  private server?: http.Server;
  private port: number;
  private host: string;
  private driver: WindowsNativeDriver;
  private isRunning = false;

  constructor(config?: DesktopServerConfig) {
    this.port = config?.port || parseInt(process.env.DESKTOP_NODE_PORT || '4002', 10);
    this.host = config?.host || '0.0.0.0';
    this.driver = new WindowsNativeDriver();
  }

  /**
   * Start the Desktop Node Server
   */
  start(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        return resolve(this.port);
      }

      this.server = http.createServer(async (req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          return res.end();
        }

        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;

        try {
          // Parse JSON body if POST
          let body: any = {};
          if (req.method === 'POST') {
            const buffers: Buffer[] = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const bodyStr = Buffer.concat(buffers).toString('utf-8');
            if (bodyStr.trim()) {
              try {
                body = JSON.parse(bodyStr);
              } catch {
                body = {};
              }
            }
          }

          // Routes
          if (pathname === '/health' && req.method === 'GET') {
            const cursor = await this.driver.getCursorPosition();
            return this.jsonResponse(res, 200, {
              status: 'online',
              node: 'laptop-desktop-server',
              os: process.platform,
              arch: process.arch,
              port: this.port,
              cursor,
              uptimeSeconds: process.uptime(),
            });
          }

          if (pathname === '/screen/capture' && req.method === 'GET') {
            const base64 = await this.driver.captureScreenshot();
            return this.jsonResponse(res, 200, {
              success: true,
              mimeType: 'image/png',
              screenshot: base64,
            });
          }

          if (pathname === '/screen/info' && req.method === 'GET') {
            const windows = await this.driver.getActiveWindows();
            const cursor = await this.driver.getCursorPosition();
            return this.jsonResponse(res, 200, { windows: windows.slice(0, 15), cursor });
          }

          if (pathname === '/action/mouse/move' && req.method === 'POST') {
            const { x, y } = body;
            if (x === undefined || y === undefined) {
              return this.jsonResponse(res, 400, { error: 'x and y coordinates are required' });
            }
            const result = await this.driver.mouseMove(x, y);
            return this.jsonResponse(res, 200, result);
          }

          if (pathname === '/action/mouse/click' && req.method === 'POST') {
            const { button = 'left', double = false } = body;
            const clickCount = double ? 2 : 1;
            const result = await this.driver.mouseClick(button, clickCount);
            return this.jsonResponse(res, 200, result);
          }

          if (pathname === '/action/keyboard/type' && req.method === 'POST') {
            const { text = '' } = body;
            const result = await this.driver.keyboardType(text);
            return this.jsonResponse(res, 200, result);
          }

          if (pathname === '/action/keyboard/hotkey' && req.method === 'POST') {
            const { keys = [] } = body;
            if (!Array.isArray(keys) || keys.length === 0) {
              return this.jsonResponse(res, 400, { error: 'keys array is required' });
            }
            const result = await this.driver.keyboardHotkey(keys);
            return this.jsonResponse(res, 200, result);
          }

          if (pathname === '/action/window/focus' && req.method === 'POST') {
            const { processName } = body;
            if (!processName) {
              return this.jsonResponse(res, 400, { error: 'processName is required' });
            }
            const success = await this.driver.focusWindow(processName);
            return this.jsonResponse(res, 200, { success });
          }

          if (pathname === '/action/app/launch' && req.method === 'POST') {
            const { appName } = body;
            if (!appName) {
              return this.jsonResponse(res, 400, { error: 'appName is required' });
            }
            const { exec } = await import('child_process');
            exec(`start "" "${appName}"`, (err) => {
              if (err) {
                return this.jsonResponse(res, 500, { success: false, error: err.message });
              }
              return this.jsonResponse(res, 200, { success: true, message: `Launched ${appName}` });
            });
            return;
          }

          // 404 handler
          return this.jsonResponse(res, 404, { error: `Endpoint ${pathname} not found on Desktop Node Server` });
        } catch (err: any) {
          return this.jsonResponse(res, 500, { error: err.message || 'Internal Server Error' });
        }
      });

      this.server.on('error', (err: any) => {
        this.isRunning = false;
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        this.isRunning = true;
        console.log(`[OpenBot] Laptop Desktop Edge Server listening on http://${this.host}:${this.port}`);
        resolve(this.port);
      });
    });
  }

  /**
   * Stop server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server || !this.isRunning) return resolve();
      this.server.close(() => {
        this.isRunning = false;
        resolve();
      });
    });
  }

  private jsonResponse(res: http.ServerResponse, status: number, data: any) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }
}

// Allow direct execution via CLI: node desktop-node-server.js
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('desktop-node-server')) {
  const server = new DesktopNodeServer();
  server.start().catch(console.error);
}
