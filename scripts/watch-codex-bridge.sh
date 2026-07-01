#!/bin/zsh
set -euo pipefail

if /usr/bin/curl -fsS --max-time 5 http://127.0.0.1:11435/health >/dev/null 2>&1; then
  exit 0
fi

/bin/launchctl kickstart -k "gui/$(/usr/bin/id -u)/com.brdavies.everybody-llmbo" >/dev/null 2>&1 || true
