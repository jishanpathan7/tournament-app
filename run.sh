#!/usr/bin/env bash
#
# run.sh — start / stop the entire Tournament Platform (web + api [+ postgres]) in one command.
#
#   ./run.sh start      Start Postgres (Docker, if available), API, and Web
#   ./run.sh stop       Stop everything this script started
#   ./run.sh restart    Stop then start
#   ./run.sh status     Show what is running
#   ./run.sh logs       Tail API + Web logs (Ctrl-C to detach)
#
# Flags:
#   --no-db             Don't touch Docker/Postgres (run API against no DB)
#
# PIDs and logs live in ./.run/ (gitignored). Safe to re-run start; it stops stale procs first.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT/.run"
API_DIR="$ROOT/apps/api"
WEB_DIR="$ROOT/apps/web"

API_PID="$RUN_DIR/api.pid"
WEB_PID="$RUN_DIR/web.pid"
API_LOG="$RUN_DIR/api.log"
WEB_LOG="$RUN_DIR/web.log"

API_HOST="127.0.0.1"
API_PORT="8000"
WEB_PORT="3000"

USE_DB=1
for arg in "$@"; do
  [ "$arg" = "--no-db" ] && USE_DB=0
done

c_grn=$'\033[0;32m'; c_yel=$'\033[0;33m'; c_red=$'\033[0;31m'; c_dim=$'\033[2m'; c_rst=$'\033[0m'
info()  { printf '%s==>%s %s\n' "$c_grn" "$c_rst" "$*"; }
warn()  { printf '%s==>%s %s\n' "$c_yel" "$c_rst" "$*"; }
err()   { printf '%s==>%s %s\n' "$c_red" "$c_rst" "$*" >&2; }

# pid_alive <pidfile> -> 0 if a live process is recorded
pid_alive() {
  local f="$1"
  [ -f "$f" ] || return 1
  local pid; pid="$(cat "$f" 2>/dev/null || true)"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

kill_pidfile() {
  local f="$1" name="$2"
  if pid_alive "$f"; then
    local pid; pid="$(cat "$f")"
    info "Stopping $name (pid $pid)"
    # kill the whole process group so child reloaders/workers die too
    kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do pid_alive "$f" || break; sleep 0.3; done
    pid_alive "$f" && { warn "$name didn't exit, forcing"; kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true; }
  else
    printf '%s    %s not running%s\n' "$c_dim" "$name" "$c_rst"
  fi
  rm -f "$f"
}

docker_available() { command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; }

start_db() {
  [ "$USE_DB" -eq 1 ] || { warn "Skipping Postgres (--no-db)"; return; }
  if docker_available; then
    info "Starting Postgres (docker compose)"
    docker compose -f "$ROOT/docker-compose.yml" up -d >/dev/null
  else
    warn "Docker not available — skipping Postgres. API runs without a DB (health/db = unavailable)."
  fi
}

stop_db() {
  if [ "$USE_DB" -eq 1 ] && docker_available; then
    info "Stopping Postgres (docker compose)"
    docker compose -f "$ROOT/docker-compose.yml" down >/dev/null 2>&1 || true
  fi
}

start_api() {
  if pid_alive "$API_PID"; then warn "API already running (pid $(cat "$API_PID"))"; return; fi
  if [ ! -x "$API_DIR/.venv/bin/python" ]; then
    err "No Python venv at apps/api/.venv — run: cd apps/api && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
    exit 1
  fi
  info "Starting API on http://$API_HOST:$API_PORT"
  (
    cd "$API_DIR"
    exec .venv/bin/python -m uvicorn app.main:app --host "$API_HOST" --port "$API_PORT" --reload
  ) >"$API_LOG" 2>&1 &
  echo $! >"$API_PID"
}

start_web() {
  if pid_alive "$WEB_PID"; then warn "Web already running (pid $(cat "$WEB_PID"))"; return; fi
  if [ ! -d "$ROOT/node_modules" ]; then
    err "No node_modules — run: yarn install"
    exit 1
  fi
  info "Starting Web on http://localhost:$WEB_PORT"
  (
    cd "$WEB_DIR"
    exec yarn dev
  ) >"$WEB_LOG" 2>&1 &
  echo $! >"$WEB_PID"
}

cmd_start() {
  mkdir -p "$RUN_DIR"
  start_db
  start_api
  start_web
  echo
  info "Up. Logs: ${c_dim}./run.sh logs${c_rst}   Stop: ${c_dim}./run.sh stop${c_rst}"
  printf '    Web  %shttp://localhost:%s%s\n' "$c_dim" "$WEB_PORT" "$c_rst"
  printf '    API  %shttp://%s:%s/docs%s\n' "$c_dim" "$API_HOST" "$API_PORT" "$c_rst"
}

cmd_stop() {
  kill_pidfile "$WEB_PID" "Web"
  kill_pidfile "$API_PID" "API"
  stop_db
  info "Stopped."
}

cmd_status() {
  pid_alive "$API_PID" && info "API  running (pid $(cat "$API_PID"))" || warn "API  stopped"
  pid_alive "$WEB_PID" && info "Web  running (pid $(cat "$WEB_PID"))" || warn "Web  stopped"
  if docker_available; then
    docker compose -f "$ROOT/docker-compose.yml" ps --status running 2>/dev/null | grep -q postgres \
      && info "DB   running (docker)" || warn "DB   stopped"
  fi
}

cmd_logs() {
  mkdir -p "$RUN_DIR"; touch "$API_LOG" "$WEB_LOG"
  info "Tailing API + Web logs (Ctrl-C to detach; apps keep running)"
  tail -n 20 -f "$API_LOG" "$WEB_LOG"
}

case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_stop; echo; cmd_start ;;
  status)  cmd_status ;;
  logs)    cmd_logs ;;
  *) echo "Usage: ./run.sh {start|stop|restart|status|logs} [--no-db]"; exit 1 ;;
esac
