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
grep -Fq 'e2e/plan-agency-real-stack.spec.ts' "$SCRIPT"
grep -Fq -- '--project=chromium-desktop' "$SCRIPT"
grep -Fq -- '--project=chromium-mobile' "$SCRIPT"

grep -Fq '${NUR_ENV_FILE:-.env}' "$COMPOSE"
grep -Fq 'NUR_REAL_STACK_BASE_URL is required' "$CONFIG"
grep -Fq 'NUR_REAL_STACK_REPORT_DIR' "$CONFIG"
grep -Fq '"real-stack:gate": "bash infra/scripts/real-stack-release-gate.sh"' "$PACKAGE"

printf 'real-stack release gate contract passed.\n'
