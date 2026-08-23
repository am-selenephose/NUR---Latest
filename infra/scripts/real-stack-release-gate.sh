#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

for tool in curl docker git npm python3; do
  command -v "$tool" >/dev/null 2>&1 || {
    printf 'REAL_STACK_RELEASE_GATE=FAIL missing_tool=%s\n' "$tool" >&2
    exit 1
  }
done
docker compose version >/dev/null

raw_run_id="${NUR_REAL_STACK_RUN_ID:-${GITHUB_RUN_ID:-local}-$$}"
safe_run_id="$(printf '%s' "$raw_run_id" | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]' | cut -c1-32)"
[[ -n "$safe_run_id" ]] || safe_run_id="local$$"
project="nurreal${safe_run_id}"
temp_dir="$(mktemp -d)"
env_file="$temp_dir/real-stack.env"
artifact_dir="${NUR_REAL_STACK_ARTIFACT_DIR:-$ROOT/.nur-runtime/real-stack-gates/$safe_run_id}"
mkdir -p "$artifact_dir"

read -r auto_postgres_port auto_redis_port auto_api_port auto_web_port < <(
  python3 - <<'PY'
import socket

sockets = []
for _ in range(4):
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sockets.append(sock)
print(*(sock.getsockname()[1] for sock in sockets))
PY
)
postgres_port="${NUR_REAL_STACK_POSTGRES_PORT:-$auto_postgres_port}"
redis_port="${NUR_REAL_STACK_REDIS_PORT:-$auto_redis_port}"
api_port="${NUR_REAL_STACK_API_PORT:-$auto_api_port}"
web_port="${NUR_REAL_STACK_WEB_PORT:-$auto_web_port}"
build_network="${NUR_REAL_STACK_BUILD_NETWORK:-default}"
postgres_container="${project}_postgres"
redis_container="${project}_redis"

session_secret="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
csrf_secret="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"

cat >"$env_file" <<EOF
APP_ENV=development
WEB_ORIGIN=http://127.0.0.1:$web_port
API_ORIGIN=http://127.0.0.1:$api_port
SESSION_SECRET=$session_secret
CSRF_SECRET=$csrf_secret
NUR_AI_PROVIDER=disabled
NUR_BILLING_PROVIDER=disabled
NUR_BILLING_TEST_MODE=true
NUR_BILLING_LIVE_ENABLED=false
PASSWORD_RESET_DELIVERY=local_capture
NUR_OMEGA_ENABLED=true
NUR_OMEGA_SCHEDULED_CONSOLIDATION=true
NUR_AGENTIC_DISPATCH_ENABLED=true
NUR_AGENTIC_DISPATCH_INTERVAL_SECONDS=1
NUR_AGENTIC_RECOVERY_INTERVAL_SECONDS=5
NUR_POSTGRES_PORT=$postgres_port
NUR_REDIS_PORT=$redis_port
NUR_API_PORT=$api_port
NUR_WEB_PORT=$web_port
NUR_WEB_ORIGIN=http://127.0.0.1:$web_port
NUR_API_ORIGIN=http://127.0.0.1:$api_port
NUR_POSTGRES_CONTAINER_NAME=$postgres_container
NUR_REDIS_CONTAINER_NAME=$redis_container
NUR_REDIS_KEY_NAMESPACE=$project
NUR_ENV_FILE=$env_file
EOF
chmod 600 "$env_file"

compose() {
  docker compose --env-file "$env_file" --profile full -p "$project" "$@"
}

cleanup() {
  status=$?
  trap - EXIT INT TERM
  if (( status != 0 )); then
    compose ps --all >"$artifact_dir/compose-ps.txt" 2>&1 || true
    compose logs --no-color >"$artifact_dir/compose.log" 2>&1 || true
  fi
  compose down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$temp_dir"
  exit "$status"
}
trap cleanup EXIT INT TERM

{
  printf 'run_id=%s\n' "$raw_run_id"
  printf 'project=%s\n' "$project"
  printf 'head=%s\n' "$(git rev-parse HEAD)"
  printf 'branch=%s\n' "$(git branch --show-current)"
  printf 'dirty_files=%s\n' "$(git status --porcelain=v1 | wc -l | tr -d ' ')"
  printf 'build_network=%s\n' "$build_network"
  printf 'postgres_port=%s\nredis_port=%s\napi_port=%s\nweb_port=%s\n' \
    "$postgres_port" "$redis_port" "$api_port" "$web_port"
} >"$artifact_dir/run-metadata.txt"

printf '== Real-stack image build (%s) ==\n' "$build_network"
docker build --network="$build_network" -f apps/api/Dockerfile -t "$project-api" . \
  2>&1 | tee "$artifact_dir/api-image-build.log"
docker tag "$project-api" "$project-worker"
docker tag "$project-api" "$project-beat"
docker build --network="$build_network" -f apps/web/Dockerfile -t "$project-web" . \
  2>&1 | tee "$artifact_dir/web-image-build.log"

printf '== Real-stack cold boot ==\n'
compose up -d --no-build

ready=0
for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$api_port/readyz" >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:$web_port/healthz" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if (( ready != 1 )); then
  printf 'REAL_STACK_RELEASE_GATE=FAIL reason=services_not_ready\n' >&2
  exit 1
fi

provider="$(curl -fsS "http://127.0.0.1:$api_port/healthz" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("ai_provider", ""))')"
if [[ "$provider" != "disabled" ]]; then
  printf 'REAL_STACK_RELEASE_GATE=FAIL expected_provider=disabled actual_provider=%s\n' "$provider" >&2
  exit 1
fi
compose ps >"$artifact_dir/compose-ps.txt"

printf '== Canonical surface proof (desktop + mobile) ==\n'
NUR_REAL_STACK_BASE_URL="http://127.0.0.1:$web_port" \
NUR_REAL_STACK_REPORT_DIR="$artifact_dir/phase-h-report" \
NUR_REAL_STACK_OUTPUT_DIR="$artifact_dir/phase-h-results" \
NUR_REDIS_PORT="$redis_port" \
NUR_REDIS_KEY_NAMESPACE="$project" \
npm --workspace apps/web run e2e -- \
  --config=playwright.real-stack.config.ts \
  e2e/phase-h-real-stack.spec.ts \
  --project=chromium-desktop \
  --project=chromium-mobile \
  --workers=1 2>&1 | tee "$artifact_dir/phase-h-e2e.log"

printf '== Talk -> Agency -> worker -> durable Plan proof ==\n'
NUR_REAL_STACK_BASE_URL="http://127.0.0.1:$web_port" \
NUR_REAL_STACK_REPORT_DIR="$artifact_dir/plan-agency-report" \
NUR_REAL_STACK_OUTPUT_DIR="$artifact_dir/plan-agency-results" \
NUR_REDIS_PORT="$redis_port" \
NUR_REDIS_KEY_NAMESPACE="$project" \
npm --workspace apps/web run e2e -- \
  --config=playwright.real-stack.config.ts \
  e2e/plan-agency-real-stack.spec.ts \
  --project=chromium-desktop \
  --workers=1 2>&1 | tee "$artifact_dir/plan-agency-e2e.log"

printf 'REAL_STACK_RELEASE_GATE=PASS project=%s head=%s artifacts=%s\n' \
  "$project" "$(git rev-parse HEAD)" "$artifact_dir"
