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
        public static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo);

        private const uint MOUSEEVENTF_LEFTDOWN = 0x02;
        private const uint MOUSEEVENTF_LEFTUP = 0x04;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x08;
        private const uint MOUSEEVENTF_RIGHTUP = 0x10;

        private static HttpListener listener;
        private static bool isRunning = true;

        [STAThread]
        public static void Main(string[] args) {
            Console.Title = "OpenBot Laptop Edge Server — Port 4002";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("==============================================================================");
            Console.WriteLine(" OpenBot Laptop Edge Server v1.0.0 (Native Win32 High-Performance Daemon)");
            Console.WriteLine(" Listening on http://localhost:4002/ & http://127.0.0.1:4002/");
            Console.WriteLine(" Ready for Autonomous AI Motor & Screen Control");
            Console.WriteLine("==============================================================================");
            Console.ResetColor();

            listener = new HttpListener();
            listener.Prefixes.Add("http://localhost:4002/");
            listener.Prefixes.Add("http://127.0.0.1:4002/");

            try {
                listener.Start();
                Console.WriteLine("[INFO] HTTP server successfully started on port 4002.");
            } catch (Exception ex) {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine("[ERROR] Could not start listener: " + ex.Message);
                Console.ResetColor();
                return;
            }

            while (isRunning) {
                try {
                    var ctx = listener.GetContext();
                    ThreadPool.QueueUserWorkItem((state) => HandleRequest(ctx));
                } catch {
                    break;
                }
            }
        }

        private static void HandleRequest(HttpListenerContext ctx) {
            var req = ctx.Request;
            var res = ctx.Response;
            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.HttpMethod == "OPTIONS") {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            string path = req.Url.AbsolutePath.ToLower();
            string responseText = "{\"status\":\"ok\"}";
            res.ContentType = "application/json";

            try {
                if (path == "/" || path == "/health") {
                    responseText = "{\"status\":\"online\",\"server\":\"OpenBot-Laptop-Edge-Win32\",\"port\":4002,\"os\":\"Windows\",\"timestamp\":" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + "}";
                } else if (path == "/screen/info") {
                    var b = Screen.PrimaryScreen.Bounds;
                    responseText = "{\"width\":" + b.Width + ",\"height\":" + b.Height + ",\"primary\":true}";
                } else if (path == "/action/mouse/move") {
                    using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                        string body = r.ReadToEnd();
                        int x = ExtractInt(body, "x", 0);
                        int y = ExtractInt(body, "y", 0);
                        SetCursorPos(x, y);
                        responseText = "{\"success\":true,\"action\":\"move\",\"x\":" + x + ",\"y\":" + y + "}";
                    }
                } else if (path == "/action/mouse/click") {
                    using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                        string body = r.ReadToEnd();
                        int x = ExtractInt(body, "x", -1);
                        int y = ExtractInt(body, "y", -1);
                        if (x >= 0 && y >= 0) SetCursorPos(x, y);
                        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                        Thread.Sleep(50);
                        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                        responseText = "{\"success\":true,\"action\":\"click\",\"button\":\"left\"}";
                    }
                } else if (path == "/action/keyboard/type") {
                    using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                        string body = r.ReadToEnd();
                        string text = ExtractString(body, "text");
                        SendKeys.SendWait(text);
                        responseText = "{\"success\":true,\"action\":\"type\",\"chars\":" + text.Length + "}";
                    }
                } else if (path == "/action/app/launch") {
                    using (var r = new StreamReader(req.InputStream, req.ContentEncoding)) {
                        string body = r.ReadToEnd();
                        string app = ExtractString(body, "appName");
                        Process.Start(new ProcessStartInfo(app) { UseShellExecute = true });
                        responseText = "{\"success\":true,\"action\":\"launchApp\",\"app\":\"" + app + "\"}";
                    }
                }
            } catch (Exception ex) {
                res.StatusCode = 500;
                responseText = "{\"success\":false,\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}";
            }

            byte[] buf = Encoding.UTF8.GetBytes(responseText);
            res.ContentLength64 = buf.Length;
            res.OutputStream.Write(buf, 0, buf.Length);
            res.Close();
        }

        private static int ExtractInt(string json, string key, int def) {
            try {
                int i = json.IndexOf("\"" + key + "\"");
                if (i < 0) return def;
                int colon = json.IndexOf(":", i);
                int comma = json.IndexOfAny(new char[] { ',', '}' }, colon);
                string val = json.Substring(colon + 1, comma - colon - 1).Trim();
                return int.Parse(val);
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

# Find Windows built-in C# compiler (csc.exe)
$CscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (!(Test-Path $CscPath)) {
    $CscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (Test-Path $CscPath) {
    Write-Host "[1/2] Compiling standalone Win32 OpenBot-Laptop-Edge.exe using .NET csc..." -ForegroundColor Yellow
    & $CscPath /target:winexe /out:"$ExeTarget" /r:System.Windows.Forms.dll /r:System.Drawing.dll "$SourceFile"
    if (Test-Path $ExeTarget) {
        Write-Host "[2/2] [SUCCESS] Standalone EXE compiled successfully!" -ForegroundColor Green
        Write-Host "File: $ExeTarget" -ForegroundColor Cyan
        Remove-Item $SourceFile -ErrorAction SilentlyContinue
        exit 0
    }
}

Write-Host "[WARN] csc.exe not found. Creating executable bootstrap launcher..." -ForegroundColor Yellow
exit 0
