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
billing_webhook_secret="$(python3 - <<'PY'
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
NUR_AI_DETERMINISTIC_DELAY_MS=0
NUR_BILLING_PROVIDER=disabled
NUR_BILLING_TEST_MODE=true
NUR_BILLING_LIVE_ENABLED=false
NUR_BILLING_WEBHOOK_SECRET=$billing_webhook_secret
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

set_env_value() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$env_file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$env_file"
  fi
}

assert_provider() {
  local expected="$1"
  local actual
  actual="$(curl -fsS "http://127.0.0.1:$api_port/healthz" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("ai_provider", ""))')"
  if [[ "$actual" != "$expected" ]]; then
    printf 'REAL_STACK_RELEASE_GATE=FAIL expected_provider=%s actual_provider=%s\n' \
      "$expected" "$actual" >&2
    return 1
  fi
}

service_pid() {
  local service="$1"
  local container
  container="$(compose ps -q "$service")"
  [[ -n "$container" ]] || return 1
  docker inspect -f '{{.State.Pid}}' "$container"
}

wait_service_running() {
  local service="$1"
  local deadline=$((SECONDS + 90))
  until pid="$(service_pid "$service" 2>/dev/null)" && [[ "$pid" =~ ^[1-9][0-9]*$ ]]; do
    if (( SECONDS >= deadline )); then
      printf 'REAL_STACK_RELEASE_GATE=FAIL service_not_running=%s\n' "$service" >&2
      return 1
    fi
    sleep 1
  done
}

wait_service_healthy() {
  local service="$1"
  local deadline=$((SECONDS + 90))
  local container health
  until container="$(compose ps -q "$service")" \
    && [[ -n "$container" ]] \
    && health="$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null)" \
    && [[ "$health" == "healthy" ]]; do
    if (( SECONDS >= deadline )); then
      printf 'REAL_STACK_RELEASE_GATE=FAIL service_not_healthy=%s\n' "$service" >&2
      return 1
    fi
    sleep 1
  done
}

wait_api_state() {
  local expected="$1"
  local deadline=$((SECONDS + 90))
  local actual
  while true; do
    if curl -fsS --max-time 2 "http://127.0.0.1:$api_port/readyz" >/dev/null 2>&1; then
      actual="ready"
    else
      actual="unready"
    fi
    [[ "$actual" == "$expected" ]] && return 0
    if (( SECONDS >= deadline )); then
      printf 'REAL_STACK_RELEASE_GATE=FAIL api_expected=%s api_actual=%s\n' "$expected" "$actual" >&2
      return 1
    fi
    sleep 1
  done
}

crash_and_restart_service() {
  local service="$1"
  local old_pid new_pid
  old_pid="$(service_pid "$service")"
  compose kill -s SIGKILL "$service" >/dev/null
  compose up -d --no-deps "$service" >/dev/null
  wait_service_running "$service"
  new_pid="$(service_pid "$service")"
  if [[ "$old_pid" == "$new_pid" ]]; then
    printf 'REAL_STACK_RELEASE_GATE=FAIL service_pid_unchanged=%s pid=%s\n' "$service" "$old_pid" >&2
    return 1
  fi
  printf 'PASS service crash/restart: %s %s -> %s\n' "$service" "$old_pid" "$new_pid"
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

assert_provider disabled
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
  e2e/phase-h-lifecycle-real-stack.spec.ts \
  e2e/core-product-lifecycle-real-stack.spec.ts \
  --project=chromium-desktop \
  --project=chromium-mobile \
  --workers=1 2>&1 | tee "$artifact_dir/phase-h-e2e.log"

printf '== Deterministic non-production Talk stream, replay, and cancel proof ==\n'
set_env_value NUR_AI_PROVIDER deterministic
set_env_value NUR_AI_DETERMINISTIC_DELAY_MS 3000
compose up -d --no-deps --force-recreate api >/dev/null
wait_service_healthy api
assert_provider deterministic
NUR_REAL_STACK_BASE_URL="http://127.0.0.1:$web_port" \
NUR_REAL_STACK_REPORT_DIR="$artifact_dir/talk-answer-report" \
NUR_REAL_STACK_OUTPUT_DIR="$artifact_dir/talk-answer-results" \
NUR_REDIS_PORT="$redis_port" \
NUR_REDIS_KEY_NAMESPACE="$project" \
npm --workspace apps/web run e2e -- \
  --config=playwright.real-stack.config.ts \
  e2e/talk-answer-real-stack.spec.ts \
  --project=chromium-desktop \
  --workers=1 2>&1 | tee "$artifact_dir/talk-answer-e2e.log"
set_env_value NUR_AI_PROVIDER disabled
set_env_value NUR_AI_DETERMINISTIC_DELAY_MS 0
compose up -d --no-deps --force-recreate api >/dev/null
wait_service_healthy api
assert_provider disabled

printf '== Deterministic non-production billing handoff proof ==\n'
set_env_value NUR_BILLING_PROVIDER test
compose up -d --no-deps --force-recreate api >/dev/null
wait_service_healthy api
NUR_REAL_STACK_BASE_URL="http://127.0.0.1:$web_port" \
NUR_REAL_STACK_REPORT_DIR="$artifact_dir/billing-handoff-report" \
NUR_REAL_STACK_OUTPUT_DIR="$artifact_dir/billing-handoff-results" \
NUR_REDIS_PORT="$redis_port" \
NUR_REDIS_KEY_NAMESPACE="$project" \
npm --workspace apps/web run e2e -- \
  --config=playwright.real-stack.config.ts \
  e2e/billing-handoff-real-stack.spec.ts \
  --project=chromium-desktop \
  --workers=1 2>&1 | tee "$artifact_dir/billing-handoff-e2e.log"
set_env_value NUR_BILLING_PROVIDER disabled
compose up -d --no-deps --force-recreate api >/dev/null
wait_service_healthy api
assert_provider disabled

printf '== Talk -> Agency -> worker -> durable Plan proof ==\n'
NUR_REAL_STACK_BASE_URL="http://127.0.0.1:$web_port" \
NUR_REAL_STACK_REPORT_DIR="$artifact_dir/plan-agency-report" \
NUR_REAL_STACK_OUTPUT_DIR="$artifact_dir/plan-agency-results" \
NUR_REDIS_PORT="$redis_port" \
NUR_REDIS_KEY_NAMESPACE="$project" \
npm --workspace apps/web run e2e -- \
  --config=playwright.real-stack.config.ts \
  e2e/plan-agency-real-stack.spec.ts \
  e2e/agentic-approval-real-stack.spec.ts \
  --project=chromium-desktop \
  --workers=1 2>&1 | tee "$artifact_dir/plan-agency-e2e.log"

printf '== Ten-cycle Capsule create -> share -> redeem -> reload -> isolation proof ==\n'
NUR_REAL_STACK_BASE_URL="http://127.0.0.1:$web_port" \
NUR_REAL_STACK_REPORT_DIR="$artifact_dir/capsule-durability-report" \
NUR_REAL_STACK_OUTPUT_DIR="$artifact_dir/capsule-durability-results" \
NUR_REDIS_PORT="$redis_port" \
NUR_REDIS_KEY_NAMESPACE="$project" \
npm --workspace apps/web run e2e -- \
  --config=playwright.real-stack.config.ts \
  e2e/capsule-durability-real-stack.spec.ts \
  --project=chromium-desktop \
  --workers=1 2>&1 | tee "$artifact_dir/capsule-durability-e2e.log"

printf '== Seed isolated performance owner ==\n'
API_ORIGIN="http://127.0.0.1:$api_port" \
APP_ENV=development \
bash infra/scripts/seed-demo-nur.sh 2>&1 | tee "$artifact_dir/performance-seed.log"

printf '== Real-stack runtime, performance, reduced-motion, and engine proof ==\n'
NUR_REAL_STACK_BASE_URL="http://127.0.0.1:$web_port" \
NUR_REAL_STACK_REPORT_DIR="$artifact_dir/runtime-quality-report" \
NUR_REAL_STACK_OUTPUT_DIR="$artifact_dir/runtime-quality-results" \
NUR_REDIS_PORT="$redis_port" \
NUR_REDIS_KEY_NAMESPACE="$project" \
npm --workspace apps/web run e2e -- \
  --config=playwright.real-stack.config.ts \
  e2e/v197-performance-acceptance.spec.ts \
  e2e/v197-performance.spec.ts \
  --project=chromium-desktop \
  --project=chromium-mobile \
  --project=webkit-desktop \
  --workers=1 2>&1 | tee "$artifact_dir/runtime-quality-e2e.log"

printf '== Real-stack mobile WebKit parity proof ==\n'
NUR_REAL_STACK_BASE_URL="http://127.0.0.1:$web_port" \
NUR_REAL_STACK_REPORT_DIR="$artifact_dir/mobile-webkit-report" \
NUR_REAL_STACK_OUTPUT_DIR="$artifact_dir/mobile-webkit-results" \
NUR_REDIS_PORT="$redis_port" \
NUR_REDIS_KEY_NAMESPACE="$project" \
npm --workspace apps/web run e2e -- \
  --config=playwright.real-stack.config.ts \
  e2e/track-a-mobile-webkit.spec.ts \
  --project=webkit-mobile \
  --workers=1 2>&1 | tee "$artifact_dir/mobile-webkit-e2e.log"

if [[ "${NUR_REAL_STACK_SOAK:-0}" == "1" ]]; then
  printf '== Ten-minute reference-browser stability soak ==\n'
  NUR_REAL_STACK_BASE_URL="http://127.0.0.1:$web_port" \
  NUR_REAL_STACK_REPORT_DIR="$artifact_dir/soak-report" \
  NUR_REAL_STACK_OUTPUT_DIR="$artifact_dir/soak-results" \
  NUR_G04_SOAK=1 \
  NUR_REDIS_PORT="$redis_port" \
  NUR_REDIS_KEY_NAMESPACE="$project" \
  npm --workspace apps/web run e2e -- \
    --config=playwright.real-stack.config.ts \
    e2e/v197-performance-acceptance.spec.ts \
    --project=chromium-desktop \
    --grep='ten-minute runtime soak' \
    --workers=1 2>&1 | tee "$artifact_dir/soak-e2e.log"
else
  printf 'Ten-minute stability soak not requested; set NUR_REAL_STACK_SOAK=1 for the exact-candidate run.\n'
fi

printf '== Isolated API, worker, Beat, and Redis crash/recovery proof ==\n'
{
  crash_and_restart_service api
  wait_api_state ready
  crash_and_restart_service worker
  crash_and_restart_service beat

  redis_pid="$(service_pid redis)"
  compose kill -s SIGKILL redis >/dev/null
  wait_api_state unready
  compose up -d --no-deps redis >/dev/null
  wait_service_healthy redis
  wait_api_state ready
  wait_service_running worker
  wait_service_running beat
  new_redis_pid="$(service_pid redis)"
  [[ "$redis_pid" != "$new_redis_pid" ]]
  printf 'PASS service crash/recovery: redis %s -> %s; dependants reconnected\n' \
    "$redis_pid" "$new_redis_pid"
} 2>&1 | tee "$artifact_dir/runtime-recovery.log"

printf '== Isolated database and object backup/restore parity proof ==\n'
compose stop worker beat >/dev/null
NUR_DR_SUPERUSER_DSN="postgresql://postgres:postgres@127.0.0.1:$postgres_port" \
NUR_DR_SOURCE_DB=nur \
NUR_DR_TARGET_OWNER=nur_admin \
NUR_DR_RUNTIME_BASE_DSN="postgresql://nur_app:nur_app_pw@127.0.0.1:$postgres_port" \
bash infra/scripts/dr-drill.sh 2>&1 | tee "$artifact_dir/dr-drill.log"

printf 'REAL_STACK_RELEASE_GATE=PASS project=%s head=%s artifacts=%s\n' \
  "$project" "$(git rev-parse HEAD)" "$artifact_dir"
