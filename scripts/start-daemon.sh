#!/usr/bin/env bash
# Start server.js as a background (daemon-like) process using nohup.
# Usage:
#   ./scripts/start-daemon.sh              # uses PORT from env or 5100
#   PORT=5200 ./scripts/start-daemon.sh    # override port

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT_VALUE="${PORT:-5100}"
PID_FILE="server.pid"
LOG_FILE="server.log"

if [[ -f "$PID_FILE" ]] && ps -p "$(cat "$PID_FILE")" > /dev/null 2>&1; then
  echo "Server already running with PID $(cat "$PID_FILE")"
  exit 0
fi

# Start
nohup env PORT="$PORT_VALUE" node server.js > "$LOG_FILE" 2>&1 &
PID=$!

echo "$PID" > "$PID_FILE"
echo "Started server.js on port $PORT_VALUE with PID $PID"
echo "Logs: tail -f $LOG_FILE"
