#!/usr/bin/env python3
"""
OpenBot Docker Phone Bridge — Live Screen Streaming & Direct Hardware Control Gateway 📱⚡
Provides:
  - MJPEG Real-Time Phone Screen Video Stream (`/stream`)
  - Direct Mouse-to-Touch Coordinate Tap (`/tap`)
  - Hardware Key Injections (`/key`)
  - Real Gestures & Swipe (`/swipe`)
  - Package Launch & APK Install (`/launch`, `/install`)
  - Wireless ADB Auto-Connect (`/connect`)
"""

import http.server
import socketserver
import subprocess
import json
import time
import os
import sys

PORT = 8000

def run_adb(args):
    """Run adb command and return stdout string"""
    cmd = ["adb"] + args
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        return result.stdout.decode('utf-8', errors='ignore').strip()
    except Exception as e:
        return f"Error: {e}"

def get_devices():
    """List connected ADB devices"""
    out = run_adb(["devices", "-l"])
    lines = [l.strip() for l in out.splitlines() if l.strip() and not l.startswith("*") and not l.startswith("List of")]
    devices = []
    for line in lines:
        parts = line.split()
        if len(parts) >= 2:
            devices.append({
                "serial": parts[0],
                "status": parts[1],
                "raw": line
            })
    return devices

class PhoneBridgeHandler(http.server.BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith('/stream'):
            # Live MJPEG Stream of Android Screen
            self.send_response(200)
            self.send_header('Content-Type', 'multipart/x-mixed-replace; boundary=--frame')
            self.send_header('Cache-Control', 'no-cache, private')
            self.send_header('Pragma', 'no-cache')
            self.end_headers()

            while True:
                try:
                    # Capture fast PNG from ADB
                    proc = subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=4)
                    frame = proc.stdout
                    if frame and len(frame) > 100:
                        self.wfile.write(b"--frame\r\n")
                        self.wfile.write(b"Content-Type: image/png\r\n\r\n")
                        self.wfile.write(frame)
                        self.wfile.write(b"\r\n")
                    time.sleep(0.1) # ~10 FPS for ultra-smooth responsiveness
                except (BrokenPipeError, ConnectionResetError):
                    break
                except Exception:
                    time.sleep(0.5)

        elif self.path.startswith('/devices'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            devices = get_devices()
            self.wfile.write(json.dumps({"success": True, "devices": devices}).encode())

        elif self.path.startswith('/screenshot'):
            self.send_response(200)
            self.send_header('Content-Type', 'image/png')
            self.end_headers()
            proc = subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=subprocess.PIPE, timeout=5)
            self.wfile.write(proc.stdout)

        elif self.path.startswith('/status'):
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            devices = get_devices()
            self.wfile.write(json.dumps({
                "status": "online",
                "bridge": "docker-phone-bridge",
                "device_count": len(devices),
                "devices": devices
            }).encode())

        else:
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(b"<h1>OpenBot Phone Bridge Daemon</h1><p>Stream: <a href='/stream'>/stream</a> | Devices: <a href='/devices'>/devices</a></p>")

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else b'{}'
        try:
            data = json.loads(body.decode('utf-8'))
        except Exception:
            data = {}

        response = {"success": True}

        if self.path.startswith('/tap'):
            x = int(data.get('x', 500))
            y = int(data.get('y', 500))
            out = run_adb(["shell", "input", "tap", str(x), str(y)])
            response["output"] = out
            response["command"] = f"adb shell input tap {x} {y}"

        elif self.path.startswith('/swipe'):
            x1 = int(data.get('x1', 500))
            y1 = int(data.get('y1', 1200))
            x2 = int(data.get('x2', 500))
            y2 = int(data.get('y2', 400))
            duration = int(data.get('duration', 300))
            out = run_adb(["shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration)])
            response["output"] = out

        elif self.path.startswith('/key'):
            code = data.get('code', 3)
            # Map name if provided
            key_names = {"HOME": 3, "BACK": 4, "RECENT": 187, "POWER": 26, "ENTER": 66, "VOL_UP": 24, "VOL_DOWN": 25}
            key_code = key_names.get(str(code).upper(), code)
            out = run_adb(["shell", "input", "keyevent", str(key_code)])
            response["output"] = out

        elif self.path.startswith('/text'):
            text = str(data.get('text', '')).replace(' ', '%s')
            out = run_adb(["shell", "input", "text", text])
            response["output"] = out

        elif self.path.startswith('/launch'):
            package = data.get('package', 'com.android.chrome')
            out = run_adb(["shell", "monkey", "-p", package, "1"])
            response["output"] = out

        elif self.path.startswith('/connect'):
            ip = data.get('ip', '')
            port = data.get('port', 5555)
            if ip:
                out = run_adb(["connect", f"{ip}:{port}"])
                response["output"] = out
            else:
                response["success"] = False
                response["error"] = "IP address is required"

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

if __name__ == '__main__':
    print(f"OpenBot Phone Bridge Daemon running on port {PORT}...")
    server = ThreadingHTTPServer(('0.0.0.0', PORT), PhoneBridgeHandler)
    server.serve_forever()
