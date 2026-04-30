#!/usr/bin/env bash
# scripts/preview-wc.sh
#
# Build the Phidias Web Component and host test-wc.html on a local static server.
#
# Usage:
#   ./scripts/preview-wc.sh [PORT]
#
# Arguments:
#   PORT  Port for the static server (default: 9876)
#
# Examples:
#   ./scripts/preview-wc.sh          # serves on :9876
#   ./scripts/preview-wc.sh 3333     # serves on :3333

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

PORT="${1:-9876}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
URL="http://localhost:${PORT}/test-wc.html"

# ── Helpers ───────────────────────────────────────────────────────────────────

log()  { echo "[preview-wc] $*"; }
err()  { echo "[preview-wc] ERROR: $*" >&2; exit 1; }

open_browser() {
  # Cross-platform browser open: Linux → xdg-open, macOS → open, WSL → explorer.exe
  if command -v xdg-open &>/dev/null; then
    xdg-open "$URL" &>/dev/null &
  elif command -v open &>/dev/null; then
    open "$URL"
  elif command -v explorer.exe &>/dev/null; then
    explorer.exe "$URL"
  else
    log "Could not detect a browser launcher. Open manually: $URL"
  fi
}

check_port() {
  if ss -tlnp 2>/dev/null | grep -q ":${PORT} " || \
     lsof -i ":${PORT}" &>/dev/null 2>&1; then
    err "Port ${PORT} is already in use. Choose a different port."
  fi
}

find_server() {
  # Prefer npx serve (better directory listing), fall back to Python
  if command -v npx &>/dev/null && npx --yes serve --version &>/dev/null 2>&1; then
    echo "npx"
  elif command -v python3 &>/dev/null; then
    echo "python3"
  elif command -v python &>/dev/null; then
    echo "python"
  else
    err "No static server found. Install Node.js (npx serve) or Python 3."
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────

cd "$PROJECT_DIR"

# 1. Validate port
[[ "$PORT" =~ ^[0-9]+$ ]] || err "PORT must be a number, got: '$PORT'"
(( PORT >= 1024 && PORT <= 65535 )) || err "PORT must be between 1024 and 65535."
check_port

# 2. Build WC
log "Building Web Component (npm run build:wc)..."
npm run build:wc

log "Build complete → dist/phidias-wc.js"

# 3. Start static server
SERVER=$(find_server)
log "Starting static server on port ${PORT} using ${SERVER}..."

if [[ "$SERVER" == "npx" ]]; then
  npx serve . --listen "$PORT" --no-clipboard &
  SERVER_PID=$!
else
  "$SERVER" -m http.server "$PORT" &
  SERVER_PID=$!
fi

log "Server PID: ${SERVER_PID}"

# 4. Wait for server to be ready
MAX_WAIT=10
for i in $(seq 1 $MAX_WAIT); do
  if curl -s -L -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null | grep -q "200"; then
    break
  fi
  sleep 0.5
done

# 5. Open browser
log "Opening → $URL"
open_browser

# 6. Keep server alive until Ctrl+C
log "Press Ctrl+C to stop."
trap "log 'Stopping server (PID ${SERVER_PID})...'; kill ${SERVER_PID} 2>/dev/null; exit 0" INT TERM

wait "$SERVER_PID"
