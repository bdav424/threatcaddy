#!/bin/zsh
set -euo pipefail

export PYTHONUNBUFFERED=1

exec /opt/homebrew/bin/python3 \
  /Users/brdavies/workspace/everybody_llmbo/everybody_llmbo/codex_rest_server.py \
  --codex-bin /opt/homebrew/bin/codex \
  --host 127.0.0.1 \
  --port 11435 \
  --served-model-name gpt-5.4 \
  --token codex-local-dev \
  --cors-origin '*' \
  --default-config-override 'model_reasoning_effort="low"'
