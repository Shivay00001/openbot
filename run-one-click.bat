@echo off
title OpenBot — Universal Autonomous Agent & Device Platform [One-Click Launcher]
color 0b

echo ==============================================================================
echo     OPENBOT — UNIVERSAL AUTONOMOUS AI AGENT ^& DEVICE PLATFORM
echo     One-Click Multi-Device Docker Orchestration (OS, Browser, Phone)
echo ==============================================================================
echo.

:: 1. Check if Docker is installed and running
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH!
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo [1/3] Starting OpenBot One-Click Containers via Docker Compose...
echo       - OS Desktop Sandbox (Ubuntu XFCE + noVNC on :6080)
echo       - Browser Sandbox (Chromium + CDP on :3002)
echo       - Phone Bridge (Direct USB ADB + Wireless ADB on :8000 / :5037)
echo       - Web Dashboard (Next.js 15 on :3000)
echo       - API Gateway (:4000) ^& AI Engine (:4001)
echo       - PostgreSQL 16 (:5432) ^& Redis 7 (:6379)
echo       - Ollama Local Zero-Cloud Inference (:11434)
echo.

docker compose -f docker-compose.one-click.yml up --build -d

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Docker Compose encountered an issue. Checking if daemon is running...
    echo If Docker Desktop is starting, please wait a moment and rerun this script.
    pause
    exit /b 1
)

echo.
echo [2/3] All containers started successfully!
echo [3/3] Opening OpenBot Web Dashboard in your browser...
start http://localhost:3000

echo.
echo ==============================================================================
echo  OpenBot is running live:
echo    - Main Web Dashboard:        http://localhost:3000
echo    - Docker OS Desktop (noVNC): http://localhost:6080
echo    - Docker Browser Sandbox:    http://localhost:3002
echo    - Phone Bridge Stream:       http://localhost:8000/stream
echo    - API Gateway:               http://localhost:4000
echo    - AI Inference Engine:       http://localhost:4001
echo ==============================================================================
echo To view logs:  docker compose -f docker-compose.one-click.yml logs -f
echo To stop stack: docker compose -f docker-compose.one-click.yml down
echo.
pause
