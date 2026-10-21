#!/bin/bash
set -e

echo "=============================================================================="
echo "    OPENBOT — UNIVERSAL AUTONOMOUS AI AGENT & DEVICE PLATFORM"
echo "    One-Click Multi-Device Docker Orchestration (OS, Browser, Phone)"
echo "=============================================================================="
echo ""

if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed or not in PATH."
    echo "Please install Docker from https://docs.docker.com/engine/install/"
    exit 1
fi

echo "[1/3] Building and starting all OpenBot containers in background..."
docker compose -f docker-compose.one-click.yml up --build -d

echo ""
echo "[2/3] All containers online!"
echo "[3/3] Opening dashboard at http://localhost:3000..."

if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000 || true
elif command -v open &> /dev/null; then
    open http://localhost:3000 || true
fi

echo ""
echo "=============================================================================="
echo " OpenBot is running live:"
echo "   - Main Web Dashboard:        http://localhost:3000"
echo "   - Docker OS Desktop (noVNC): http://localhost:6080"
echo "   - Docker Browser Sandbox:    http://localhost:3002"
echo "   - Phone Bridge Stream:       http://localhost:8000/stream"
echo "   - API Gateway:               http://localhost:4000"
echo "   - AI Engine:                 http://localhost:4001"
echo "=============================================================================="
echo "Logs: docker compose -f docker-compose.one-click.yml logs -f"
echo "Stop: docker compose -f docker-compose.one-click.yml down"
