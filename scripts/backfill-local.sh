#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: scripts/backfill-local.sh [backfill options]

Starts the local API if needed, applies migrations, and resumes the provider backfill.
Examples:
  scripts/backfill-local.sh
  scripts/backfill-local.sh --max=1000 --concurrency=8
USAGE
  exit 0
fi

if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

: "${DATABASE_URL:?Set DATABASE_URL in .env or your environment.}"
port="${PORT:-3000}"
api_url="http://127.0.0.1:${port}"
started=0
server_pid=""

cleanup() {
  if [[ "$started" == "1" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

npm install
npm run db:migrate

if ! curl --silent --fail "${api_url}/health" >/dev/null; then
  npm run start >/tmp/scarletx-api.log 2>&1 &
  server_pid=$!
  started=1
  for _attempt in {1..30}; do
    if curl --silent --fail "${api_url}/health" >/dev/null; then break; fi
    sleep 1
  done
fi

curl --silent --fail "${api_url}/health" >/dev/null
npm run backfill -- --api="${api_url}" "$@"
