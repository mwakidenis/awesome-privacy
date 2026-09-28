#!/usr/bin/env bash
# Builds the Docker image and checks the container serves the health route
set -euo pipefail

docker build -t awesome-privacy-api .
cid=$(docker run -d -p 8787:8787 awesome-privacy-api)
trap 'docker rm -f "${cid}" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 30); do
  curl -fsS http://localhost:8787/v1/health >/dev/null 2>&1 && break
  sleep 2
done

curl -fsS http://localhost:8787/v1/health | grep -q '"status":"ok"' || {
  echo "❌ Docker health check failed"
  docker logs "${cid}"
  exit 1
}
echo "✅ Docker smoke passed"
