#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$ROOT/infra/scripts/real-stack-release-gate.sh"
COMPOSE="$ROOT/docker-compose.yml"
CONFIG="$ROOT/apps/web/playwright.real-stack.config.ts"
PACKAGE="$ROOT/package.json"

[[ -x "$SCRIPT" ]]
bash -n "$SCRIPT"

grep -Fq 'mktemp -d' "$SCRIPT"
grep -Fq 'trap cleanup EXIT INT TERM' "$SCRIPT"
grep -Fq 'NUR_REAL_STACK_RUN_ID' "$SCRIPT"
grep -Fq 'NUR_REAL_STACK_BUILD_NETWORK' "$SCRIPT"
grep -Fq 'NUR_POSTGRES_CONTAINER_NAME' "$SCRIPT"
grep -Fq 'NUR_REDIS_CONTAINER_NAME' "$SCRIPT"
grep -Fq 'down -v --remove-orphans' "$SCRIPT"
grep -Fq 'e2e/phase-h-real-stack.spec.ts' "$SCRIPT"
grep -Fq 'e2e/phase-h-lifecycle-real-stack.spec.ts' "$SCRIPT"
grep -Fq 'e2e/core-product-lifecycle-real-stack.spec.ts' "$SCRIPT"
grep -Fq 'e2e/talk-answer-real-stack.spec.ts' "$SCRIPT"
grep -Fq 'e2e/billing-handoff-real-stack.spec.ts' "$SCRIPT"
grep -Fq 'e2e/plan-agency-real-stack.spec.ts' "$SCRIPT"
grep -Fq 'e2e/agentic-approval-real-stack.spec.ts' "$SCRIPT"
grep -Fq 'e2e/capsule-durability-real-stack.spec.ts' "$SCRIPT"
grep -Fq 'infra/scripts/seed-demo-nur.sh' "$SCRIPT"
grep -Fq 'e2e/v197-performance-acceptance.spec.ts' "$SCRIPT"
grep -Fq 'e2e/v197-performance.spec.ts' "$SCRIPT"
grep -Fq 'e2e/track-a-mobile-webkit.spec.ts' "$SCRIPT"
grep -Fq 'NUR_REAL_STACK_SOAK' "$SCRIPT"
grep -Fq 'ten-minute runtime soak' "$SCRIPT"
grep -Fq 'NUR_AI_DETERMINISTIC_DELAY_MS=0' "$SCRIPT"
grep -Fq 'set_env_value NUR_AI_PROVIDER deterministic' "$SCRIPT"
grep -Fq 'assert_provider deterministic' "$SCRIPT"
grep -Fq 'set_env_value NUR_AI_PROVIDER disabled' "$SCRIPT"
grep -Fq 'assert_provider disabled' "$SCRIPT"
grep -Fq 'set_env_value NUR_BILLING_PROVIDER test' "$SCRIPT"
grep -Fq 'set_env_value NUR_BILLING_PROVIDER disabled' "$SCRIPT"
grep -Fq 'crash_and_restart_service api' "$SCRIPT"
grep -Fq 'crash_and_restart_service worker' "$SCRIPT"
grep -Fq 'crash_and_restart_service beat' "$SCRIPT"
grep -Fq 'wait_api_state unready' "$SCRIPT"
grep -Fq 'infra/scripts/dr-drill.sh' "$SCRIPT"
grep -Fq -- '--project=chromium-desktop' "$SCRIPT"
grep -Fq -- '--project=chromium-mobile' "$SCRIPT"
grep -Fq -- '--project=webkit-desktop' "$SCRIPT"
grep -Fq -- '--project=webkit-mobile' "$SCRIPT"

# The contract must find the literal Compose expansion.
# shellcheck disable=SC2016
grep -Fq '${NUR_ENV_FILE:-.env}' "$COMPOSE"
grep -Fq 'NUR_REAL_STACK_BASE_URL is required' "$CONFIG"
grep -Fq 'NUR_REAL_STACK_REPORT_DIR' "$CONFIG"
grep -Fq '"real-stack:gate": "bash infra/scripts/real-stack-release-gate.sh"' "$PACKAGE"

printf 'real-stack release gate contract passed.\n'
