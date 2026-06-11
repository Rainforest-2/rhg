#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4173}"
PID_FILE="${PID_FILE:-/tmp/game-preview-${PORT}.pid}"

if [ -f "$PID_FILE" ]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null || true
  rm -f "$PID_FILE"
fi

if command -v lsof >/dev/null 2>&1; then
  lsof -ti tcp:"$PORT" | xargs -r kill 2>/dev/null || true
fi

pkill -f "vite.*--port ${PORT}" 2>/dev/null || true
pkill -f "vite.* ${PORT}" 2>/dev/null || true

echo "preview stopped on port ${PORT}"
