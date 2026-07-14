#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "==> Pulling latest commits..."
git pull --ff-only

echo "==> Building..."
pnpm build

echo "==> Starting preview server (Ctrl+C to stop)..."
pnpm desktop:site:browser
