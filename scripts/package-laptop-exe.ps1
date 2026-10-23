<#
.SYNOPSIS
  Packages OpenBot Laptop Edge Server into a standalone Windows executable: OpenBot-Laptop-Edge.exe
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = Split-Path -Parent $ScriptDir
$OutputDir = Join-Path $RootDir "dist-artifacts"

if (!(Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$ExeTarget = Join-Path $OutputDir "OpenBot-Laptop-Edge.exe"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "[OpenBot] Packaging Standalone Laptop Edge Server (OpenBot-Laptop-Edge.exe)" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Cyan

# C# Source for Native Win32 Laptop Server Executable
$CSharpCode = @"
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
using System.Windows.Forms;

namespace OpenBot.LaptopEdge {
    public class Program {
        [DllImport("user32.dll")]
        public static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        public static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);

        private const uint MOUSEEVENTF_LEFTDOWN = 0x02;
        private const uint MOUSEEVENTF_LEFTUP = 0x04;

        private static TcpListener listener;
        private static bool isRunning = true;
        private static string edgeSecret = "";

        [STAThread]
        public static void Main(string[] args) {
            try { SetProcessDPIAware(); } catch {}
            edgeSecret = Environment.GetEnvironmentVariable("OPENBOT_EDGE_SECRET") ?? "";

            for (int i = 0; i < args.Length; i++) {
                if (args[i] == "--secret" && i + 1 < args.Length) {
                    edgeSecret = args[i + 1];
                }
            }

            int port = 4002;
            listener = new TcpListener(IPAddress.Loopback, port);

            try {
                listener.Start();
                Console.WriteLine("[INFO] OpenBot Laptop Edge Server successfully started on port " + port);
            } catch (Exception ex) {
                Console.WriteLine("[ERROR] Could not start listener: " + ex.Message);
                return;
            }

            while (isRunning) {
                try {
                    var client = listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem((state) => HandleClient(client));
                } catch {
                    break;
                }
            }
        }

        private static void MoveMouseBezier(int targetX, int targetY) {
            Point current = Cursor.Position;
            int startX = current.X;
            int startY = current.Y;
            int steps = 15;

            // Simple cubic curve control point
            int midX = (startX + targetX) / 2;
            int midY = Math.Min(startY, targetY) - 20;

            for (int i = 1; i <= steps; i++) {
                float t = (float)i / steps;
                float u = 1.0f - t;
                // Quadratic Bezier interpolation: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
                int curX = (int)(u * u * startX + 2 * u * t * midX + t * t * targetX);
                int curY = (int)(u * u * startY + 2 * u * t * midY + t * t * targetY);
                SetCursorPos(curX, curY);
                Thread.Sleep(5);
            }
            SetCursorPos(targetX, targetY);
        }

        private static void HandleClient(TcpClient client) {
            using (client)
            using (var stream = client.GetStream()) {
                var reader = new StreamReader(stream, Encoding.UTF8);
                string reqLine = reader.ReadLine();
                if (string.IsNullOrEmpty(reqLine)) return;

                var parts = reqLine.Split(' ');
                if (parts.Length < 2) return;
                string method = parts[0].ToUpper();
                string path = parts[1].ToLower();

                // Read headers
                string line;
                int contentLength = 0;
                string authHeader = "";
                string customToken = "";

                while (!string.IsNullOrEmpty(line = reader.ReadLine())) {
                    if (line.StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase)) {
                        int.TryParse(line.Substring(15).Trim(), out contentLength);
                    } else if (line.StartsWith("Authorization:", StringComparison.OrdinalIgnoreCase)) {
                        authHeader = line.Substring(14).Trim();
                    } else if (line.StartsWith("x-openbot-token:", StringComparison.OrdinalIgnoreCase)) {
                        customToken = line.Substring(16).Trim();
                    }
                }

                if (method == "OPTIONS") {
                    SendResponse(stream, 200, "{\"status\":\"ok\"}");
                    return;
                }

                // Security Check
                if (!string.IsNullOrEmpty(edgeSecret) && path != "/" && path != "/health") {
                    string bearer = authHeader.StartsWith("Bearer ") ? authHeader.Substring(7).Trim() : authHeader;
                    if (bearer != edgeSecret && customToken != edgeSecret) {
                        SendResponse(stream, 401, "{\"error\":\"Unauthorized: Invalid edge authentication token\"}");
                        return;
                    }
                }

                string body = "";
                if (contentLength > 0) {
                    char[] buffer = new char[contentLength];
                    int totalRead = 0;
                    while (totalRead < contentLength) {
                        int read = reader.Read(buffer, totalRead, contentLength - totalRead);
                        if (read <= 0) break;
                        totalRead += read;
                    }
                    body = new string(buffer, 0, totalRead);
                }

                if (path == "/" || path == "/health") {
                    var b = Screen.PrimaryScreen.Bounds;
                    string res = "{\"status\":\"online\",\"server\":\"OpenBot-Laptop-Edge-Win32\",\"port\":4002,\"os\":\"Windows\",\"dpiAware\":true,\"authRequired\":" + (!string.IsNullOrEmpty(edgeSecret) ? "true" : "false") + ",\"screenWidth\":" + b.Width + ",\"screenHeight\":" + b.Height + ",\"timestamp\":" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + "}";
                    SendResponse(stream, 200, res);
                } else if (path == "/screen/info") {
                    var b = Screen.PrimaryScreen.Bounds;
                    SendResponse(stream, 200, "{\"width\":" + b.Width + ",\"height\":" + b.Height + ",\"primary\":true,\"dpiAware\":true}");
                } else if (path == "/screen/capture") {
                    try {
                        var b = Screen.PrimaryScreen.Bounds;
                        using (var bmp = new Bitmap(b.Width, b.Height)) {
                            using (var g = Graphics.FromImage(bmp)) {
                                g.CopyFromScreen(Point.Empty, Point.Empty, b.Size);
                            }
                            using (var ms = new MemoryStream()) {
                                bmp.Save(ms, ImageFormat.Png);
                                string b64 = Convert.ToBase64String(ms.ToArray());
                                SendResponse(stream, 200, "{\"success\":true,\"mimeType\":\"image/png\",\"screenshot\":\"data:image/png;base64," + b64 + "\"}");
                            }
                        }
                    } catch (Exception ex) {
                        SendResponse(stream, 500, "{\"success\":false,\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
                    }
                } else if (path == "/action/mouse/move") {
                    double xf = ExtractDouble(body, "x", 0);
                    double yf = ExtractDouble(body, "y", 0);
                    bool smooth = body.Contains("\"smooth\":true") || !body.Contains("\"smooth\":false");
                    var b = Screen.PrimaryScreen.Bounds;
                    int x = (xf > 0 && xf <= 1.0) ? (int)Math.Round(xf * b.Width) : (int)xf;
                    int y = (yf > 0 && yf <= 1.0) ? (int)Math.Round(yf * b.Height) : (int)yf;
                    
                    if (smooth) {
                        MoveMouseBezier(x, y);
                    } else {
                        SetCursorPos(x, y);
                    }
                    SendResponse(stream, 200, "{\"success\":true,\"action\":\"move\",\"x\":" + x + ",\"y\":" + y + ",\"smooth\":" + (smooth ? "true" : "false") + "}");
                } else if (path == "/action/mouse/click") {
                    double xf = ExtractDouble(body, "x", -1);
                    double yf = ExtractDouble(body, "y", -1);
                    if (xf >= 0 && yf >= 0) {
                        var b = Screen.PrimaryScreen.Bounds;
                        int x = (xf > 0 && xf <= 1.0) ? (int)Math.Round(xf * b.Width) : (int)xf;
                        int y = (yf > 0 && yf <= 1.0) ? (int)Math.Round(yf * b.Height) : (int)yf;
                        MoveMouseBezier(x, y);
                    }
                    mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                    Thread.Sleep(50);
                    mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                    SendResponse(stream, 200, "{\"success\":true,\"action\":\"click\",\"button\":\"left\"}");
                } else if (path == "/action/keyboard/type") {
                    string text = ExtractString(body, "text");
                    SendKeys.SendWait(text);
                    SendResponse(stream, 200, "{\"success\":true,\"action\":\"type\",\"chars\":" + text.Length + "}");
                } else if (path == "/action/app/launch") {
                    string app = ExtractString(body, "appName");
                    Process.Start(new ProcessStartInfo(app) { UseShellExecute = true });
                    SendResponse(stream, 200, "{\"success\":true,\"action\":\"launchApp\",\"app\":\"" + app + "\"}");
                } else {
                    SendResponse(stream, 200, "{\"status\":\"ok\"}");
                }
            }
        }

        private static void SendResponse(NetworkStream stream, int statusCode, string json) {
            byte[] bodyBytes = Encoding.UTF8.GetBytes(json);
            string statusMsg = statusCode == 200 ? "OK" : (statusCode == 401 ? "Unauthorized" : "Internal Error");
            string header = "HTTP/1.1 " + statusCode + " " + statusMsg + "\r\n" +
                            "Content-Type: application/json\r\n" +
                            "Access-Control-Allow-Origin: *\r\n" +
                            "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                            "Access-Control-Allow-Headers: Content-Type, Authorization, x-openbot-token\r\n" +
                            "Content-Length: " + bodyBytes.Length + "\r\n" +
                            "Connection: close\r\n\r\n";
            byte[] headerBytes = Encoding.ASCII.GetBytes(header);
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(bodyBytes, 0, bodyBytes.Length);
            stream.Flush();
        }

        private static double ExtractDouble(string json, string key, double def) {
            try {
                int i = json.IndexOf("\"" + key + "\"");
                if (i < 0) return def;
                int colon = json.IndexOf(":", i);
                int comma = json.IndexOfAny(new char[] { ',', '}' }, colon);
                string val = json.Substring(colon + 1, comma - colon - 1).Trim();
                return double.Parse(val, System.Globalization.CultureInfo.InvariantCulture);
            } catch { return def; }
        }

        private static string ExtractString(string json, string key) {
            try {
                int i = json.IndexOf("\"" + key + "\"");
                if (i < 0) return "";
                int colon = json.IndexOf(":", i);
                int q1 = json.IndexOf("\"", colon);
                int q2 = json.IndexOf("\"", q1 + 1);
                return json.Substring(q1 + 1, q2 - q1 - 1);
            } catch { return ""; }
        }
    }
}
"@

$SourceFile = Join-Path $OutputDir "OpenBotLaptopEdge.cs"
Set-Content -Path $SourceFile -Value $CSharpCode -Encoding UTF8

# Remove previous binary to ensure we verify a genuine new build
if (Test-Path $ExeTarget) {
    Remove-Item -Path $ExeTarget -Force -ErrorAction SilentlyContinue
}

# Find Windows built-in C# compiler (csc.exe)
$CscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (!(Test-Path $CscPath)) {
    $CscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (Test-Path $CscPath) {
    Write-Host "[1/2] Compiling standalone Win32 OpenBot-Laptop-Edge.exe using .NET csc..." -ForegroundColor Yellow
    & $CscPath /target:winexe /out:"$ExeTarget" /r:System.Windows.Forms.dll /r:System.Drawing.dll "$SourceFile"
    if ($LASTEXITCODE -ne 0 -or !(Test-Path $ExeTarget)) {
        Write-Error "[FAIL] C# compilation failed with exit code $LASTEXITCODE"
        exit 1
    }
    Write-Host "[2/2] [SUCCESS] Standalone EXE compiled successfully!" -ForegroundColor Green
    Write-Host "File: $ExeTarget" -ForegroundColor Cyan
    Remove-Item $SourceFile -ErrorAction SilentlyContinue

    # Sync to web app downloads directory
    $WebDownloads = Join-Path $RootDir "apps\web\public\downloads"
    if (Test-Path $WebDownloads) {
        Copy-Item -Path $ExeTarget -Destination (Join-Path $WebDownloads "OpenBot-Laptop-Edge.exe") -Force
        Write-Host "[SYNC] Copied to public download directory: $WebDownloads" -ForegroundColor Green
    }
    exit 0
}

Write-Error "[FAIL] csc.exe not found on system."
exit 1
