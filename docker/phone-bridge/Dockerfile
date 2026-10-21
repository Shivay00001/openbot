FROM alpine:3.20

# Install android-tools (adb, fastboot), python3, socat, usbutils, curl
RUN apk add --no-cache \
    android-tools \
    python3 \
    py3-pip \
    socat \
    usbutils \
    curl \
    bash

WORKDIR /app

COPY server.py /app/server.py
COPY entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh /app/server.py

# 5037: ADB daemon, 5555: Wireless ADB, 8000: Phone Screen Streamer & Touch Control
EXPOSE 5037 5555 8000

ENTRYPOINT ["/app/entrypoint.sh"]
