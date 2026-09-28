#!/usr/bin/env bash
# Boots the API and checks public routes respond, using only bundled data (no network)
set -euo pipefail

port="${PORT:-8787}"
base="http://localhost:${port}"

bun run build:data

bun run start &
server=$!
trap 'kill "${server}" 2>/dev/null || true' EXIT

# Wait for the server to accept connections
for _ in $(seq 1 30); do
  curl -fsS "${base}/v1/health" >/dev/null 2>&1 && break
  sleep 1
done

health=$(curl -fsS "${base}/v1/health")
echo "${health}" | grep -q '"status":"ok"' || { echo "❌ health check failed"; exit 1; }

# Stats are derived from the bundled dataset, so this proves data loaded
stats=$(curl -fsS "${base}/v1/stats")
echo "${stats}" | grep -q '"categories"' || { echo "❌ stats check failed"; exit 1; }

echo "✅ Smoke test passed"
