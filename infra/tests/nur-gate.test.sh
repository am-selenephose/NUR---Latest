#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

RUNNER="infra/scripts/nur-gate.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
bash -n "$RUNNER"

mapfile -t gates < <(bash "$RUNNER" --list)
[[ "${#gates[@]}" -eq 17 ]]
[[ "${gates[0]}" == "G00_EVIDENCE" ]]
[[ "${gates[16]}" == "G16_FULL_RELEASE" ]]

set +e
output="$(bash "$RUNNER" G99_NOT_REAL 2>&1)"
status=$?
set -e
[[ "$status" -eq 2 ]]
[[ "$output" == *"Unknown NUR gate"* ]]

# Exercise one real, lightweight gate. Its executable repository checks must
# pass, while the provider-side credential-rotation boundary keeps the verdict
# honest instead of producing a local-only PASS.
set +e
NUR_GATE_EVIDENCE_ROOT="$TMP/evidence" bash "$RUNNER" G00_EVIDENCE >"$TMP/g00.log" 2>&1
status=$?
set -e
[[ "$status" -eq 1 ]]
python3 - "$TMP/evidence/G00_EVIDENCE/result.json" <<'PY'
from __future__ import annotations

import json
import sys

result = json.load(open(sys.argv[1], encoding="utf-8"))
assert result["verdict"] == "FOUNDER_ACTION_REQUIRED", result
steps = {row["step"]: row for row in result["steps"]}
for step in ("git_head", "git_status", "dependency_locks", "v197_integrity", "secret_scan"):
    assert steps[step]["exit_code"] == 0, steps[step]
assert steps["credential_rotation"]["command"] is None
assert "provider-side revocation" in steps["credential_rotation"]["skipped_reason"]
PY

# The runner must execute the product proofs that now exist. These are runner
# wiring assertions, not substitutes for the commands themselves: each command
# is still executed by its owning gate and writes an evidence log.
required_wiring=(
  'npm audit --audit-level=high'
  'infra/tests/sbom-freshness.test.sh'
  'test_upgrade_from_released_db.py'
  'test_migration_roundtrip_db.py'
  'infra/tests/release-package-fresh-extract.test.sh'
  'e2e/owner-product-surfaces.spec.ts'
  'chromium-desktop,chromium-mobile'
  'playwright.g04.config.ts'
  'test_rate_quota_hardening.py'
  'recovery_delivery_resilience'
  'test_tool_registry.py'
  'test_community_completion.py'
  'test_group_research_completion.py'
  'bounded_agent_runtime'
  'test_account_privacy.py'
  'infra/tests/production-web-serving.test.sh'
  'npm run --silent proof-hygiene'
)
for marker in "${required_wiring[@]}"; do
  grep -Fq "$marker" "$RUNNER"
done

# These messages described code that now has executable proof. Reintroducing
# one would make the gate stale while still looking authoritative.
stale_claims=(
  'no SBOM generator'
  'no populated-revision upgrade test'
  'no downgrade execution test'
  'fresh-clone/extract boot not wired'
  'Personal Memory, Teach NUR and Billing unreachable'
  'reference device/browser tier not declared'
  'retry/dedup/bounce not implemented'
  'packages/evals does not exist'
  'no bounded tool registry'
  'no billing control in the V197 matrix'
  'no Glow fraud detection'
  'no leaderboard implementation'
  'no experiment engine'
  '35 locale slots not present'
  'no authenticated realtime gateway'
  'no feed ranking module'
  'no anti-abuse suite'
  'no expert verification module'
  'no agents module'
  'no privacy center'
)
for claim in "${stale_claims[@]}"; do
  if grep -Fq "$claim" "$RUNNER"; then
    printf 'stale NUR gate claim returned: %s\n' "$claim" >&2
    exit 1
  fi
done

# Provider, environment, human-review and founder approval boundaries must stay
# explicit. The internal harness may prove local behavior; it may not round that
# up to production readiness.
external_holds=(
  'provider-side revocation evidence'
  'FOUNDER_ACTION_REQUIRED_CONFIGURE_OPENAI'
  'transactional email provider'
  'merchant account'
  'push/email delivery provider'
  'FOUNDER_ACTION_REQUIRED_LOCALE_HUMAN_REVIEW'
  'lawful research retrieval provider'
  'production-like staging environment'
  'FOUNDER_ACTION_REQUIRED_RELEASE_APPROVAL'
)
for hold in "${external_holds[@]}"; do
  grep -Fq "$hold" "$RUNNER"
done

printf 'nur-gate contract: PASS (%s gates)\n' "${#gates[@]}"
