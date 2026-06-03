#!/usr/bin/env bash
set -euo pipefail

BACKEND_SERVICE="industrial-automation-quoter-backend.service"
FRONTEND_SERVICE="industrial-automation-quoter-frontend.service"
BACKEND_HEALTH_URL="http://127.0.0.1:3000/api/health"
FRONTEND_HEALTH_URL="http://127.0.0.1:5173/"
TIMEOUT_SECONDS=20
HARD_RESET=0
TARGET="all"

usage() {
  cat <<'EOF'
Usage: ./scripts/reset-server.sh [options]

Options:
  --hard            Kill stray node/vite processes before restarting services
  --backend-only    Restart only the backend service
  --frontend-only   Restart only the frontend service
  -h, --help        Show this help

Examples:
  ./scripts/reset-server.sh
  ./scripts/reset-server.sh --hard
  ./scripts/reset-server.sh --backend-only
EOF
}

log() {
  printf '[reset] %s\n' "$*"
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local deadline=$((SECONDS + TIMEOUT_SECONDS))

  until curl -fsS -m 5 "$url" >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      log "$label did not become healthy within ${TIMEOUT_SECONDS}s"
      return 1
    fi
    sleep 1
  done

  log "$label is healthy"
}

show_status() {
  log "Service status"
  systemctl --user --no-pager --full status "$BACKEND_SERVICE" "$FRONTEND_SERVICE" || true
  log "RethinkDB processes"
  pgrep -af rethinkdb || true
}

hard_reset_processes() {
  log "Hard reset requested; killing stray app processes"
  pkill -f 'node src/server.js' || true
  pkill -f 'vite --host 0.0.0.0 --host 0.0.0.0 --port 5173' || true
  pkill -f 'node .*/vite' || true
  sleep 1
}

restart_backend() {
  log "Restarting backend service"
  systemctl --user restart "$BACKEND_SERVICE"
  wait_for_http "$BACKEND_HEALTH_URL" "Backend"
  log "Backend health payload:"
  curl -fsS "$BACKEND_HEALTH_URL"
  printf '\n'
}

restart_frontend() {
  log "Restarting frontend service"
  systemctl --user restart "$FRONTEND_SERVICE"
  wait_for_http "$FRONTEND_HEALTH_URL" "Frontend"
  log "Frontend headers:"
  curl -fsSI "$FRONTEND_HEALTH_URL" | sed -n '1,8p'
}

while (($#)); do
  case "$1" in
    --hard)
      HARD_RESET=1
      ;;
    --backend-only)
      TARGET="backend"
      ;;
    --frontend-only)
      TARGET="frontend"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

cd /home/saulordz/projects

if (( HARD_RESET )); then
  hard_reset_processes
fi

case "$TARGET" in
  backend)
    restart_backend
    ;;
  frontend)
    restart_frontend
    ;;
  all)
    restart_backend
    restart_frontend
    ;;
esac

show_status
