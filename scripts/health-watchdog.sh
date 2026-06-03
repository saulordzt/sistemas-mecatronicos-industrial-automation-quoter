#!/usr/bin/env bash
set -euo pipefail

BACKEND_SERVICE="industrial-automation-quoter-backend.service"
FRONTEND_SERVICE="industrial-automation-quoter-frontend.service"
BACKEND_HEALTH_URL="http://127.0.0.1:3000/api/health"
FRONTEND_HEALTH_URL="http://127.0.0.1:5173/"
CURL_TIMEOUT=8

log() {
  printf '[watchdog] %s\n' "$*"
}

service_active() {
  systemctl --user is-active --quiet "$1"
}

http_ok() {
  curl -fsS -m "$CURL_TIMEOUT" "$1" >/dev/null 2>&1
}

restart_service() {
  local service="$1"
  log "Restarting ${service}"
  systemctl --user restart "$service"
}

check_backend() {
  if ! service_active "$BACKEND_SERVICE"; then
    log "Backend service inactive"
    restart_service "$BACKEND_SERVICE"
    return
  fi

  if ! http_ok "$BACKEND_HEALTH_URL"; then
    log "Backend health check failed"
    restart_service "$BACKEND_SERVICE"
  fi
}

check_frontend() {
  if ! service_active "$FRONTEND_SERVICE"; then
    log "Frontend service inactive"
    restart_service "$FRONTEND_SERVICE"
    return
  fi

  if ! http_ok "$FRONTEND_HEALTH_URL"; then
    log "Frontend health check failed"
    restart_service "$FRONTEND_SERVICE"
  fi
}

check_backend
check_frontend

