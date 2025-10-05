#!/usr/bin/env bash
# Stop the background (daemon-like) process started by start-daemon.sh
# Usage:
#   ./scripts/stop-daemon.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PID_FILE="server.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found ($PID_FILE). Is the server running?"
  exit 0
fi

PID="$(cat "$PID_FILE")"
if ps -p "$PID" > /dev/null 2>&1; then
  kill "$PID"
  echo "Stopped PID $PID"
else
  echo "Process $PID not running"
fi

rm -f "$PID_FILE"
