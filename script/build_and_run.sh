#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_PATTERN="$ROOT_DIR/desktop/main.mjs"

stop_running() {
  pkill -f "$APP_PATTERN" >/dev/null 2>&1 || true
}

build_app() {
  cd "$ROOT_DIR"
  pnpm exec tsc -b --pretty false
}

run_app() {
  cd "$ROOT_DIR"
  pnpm desktop:site
}

case "$MODE" in
  run)
    stop_running
    build_app
    run_app
    ;;
  --debug|debug)
    stop_running
    build_app
    cd "$ROOT_DIR"
    pnpm exec electron --inspect=9229 ./desktop/main.mjs
    ;;
  --logs|logs|--telemetry|telemetry)
    stop_running
    build_app
    run_app &
    /usr/bin/log stream --info --style compact --predicate 'process CONTAINS "Electron"'
    ;;
  --verify|verify)
    stop_running
    build_app
    run_app &
    sleep 3
    pgrep -f "$APP_PATTERN" >/dev/null
    ;;
  *)
    echo "usage: $0 [run|--debug|--logs|--telemetry|--verify]" >&2
    exit 2
    ;;
esac
