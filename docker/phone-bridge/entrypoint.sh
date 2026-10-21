#!/bin/sh
set -e

echo "Starting OpenBot ADB Server daemon on 0.0.0.0:5037..."
adb -a -P 5037 nodaemon server &
sleep 2

# Check connected physical USB devices
echo "Checking physical USB Android devices..."
adb devices -l

# Auto-connect wireless ADB if WIRELESS_ADB_IP is set
if [ -n "$WIRELESS_ADB_IP" ]; then
    echo "Auto-connecting to Wireless Android Device at $WIRELESS_ADB_IP:5555..."
    adb connect "$WIRELESS_ADB_IP:5555" || true
fi

echo "Starting OpenBot Phone Bridge HTTP & Screen Streamer on port 8000..."
exec python3 /app/server.py
