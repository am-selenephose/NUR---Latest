#!/usr/bin/env bash
# Deterministic NUR release gate runner (Masterplan V5 §26.5).
#
#   bash infra/scripts/nur-gate.sh <GATE>
#   bash infra/scripts/nur-gate.sh ALL
#   bash infra/scripts/nur-gate.sh --list
#
# For a full ALL run, space the browser gates so repeated demo-owner sign-ins do not
# exhaust the login rate-limit window (10 per 300s per ip+email):
#   NUR_GATE_BROWSER_SPACING_SECONDS=310 bash infra/scripts/nur-gate.sh ALL
#
# Gates: G00_EVIDENCE … G16_FULL_RELEASE.
#
# Every run writes, per gate:
#   evidence/<timestamp>/<GATE>/result.json
#   evidence/<timestamp>/<GATE>/report.md
#   evidence/<timestamp>/<GATE>/<step>.log
#
# Each result records the commit, dirty-state manifest, environment class, start/end time,
# every command with its exit code, and a verdict. Verdicts are:
#
#   PASS                     every required step exited 0
#   FAIL                     a required step failed
#   BLOCKED_EXTERNAL         needs a credential, provider, or environment nobody here can supply
#   FOUNDER_ACTION_REQUIRED  needs a founder decision or account action
#   INCOMPLETE               everything that ran passed, but required checks are still unimplemented
#   NOT_IMPLEMENTED          the gate's checks do not exist yet, and saying so is the honest result
#
# A gate with no executable checks reports NOT_IMPLEMENTED. It never reports PASS by silence.
# Gate functions are selected dynamically by name in run_gate().
# shellcheck disable=SC2329
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

RUN_STAMP="${NUR_GATE_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
EVIDENCE_ROOT="${NUR_GATE_EVIDENCE_ROOT:-$ROOT/evidence/$RUN_STAMP}"
COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
BRANCH="$(git branch --show-current 2>/dev/null || echo detached)"
ENV_CLASS="${NUR_ENV_CLASS:-local}"

GATES=(
  G00_EVIDENCE G01_STATIC G02_AUTH G03_V197 G04_PERFORMANCE G05_LIVE_AI G06_RECOVERY
  G07_INTELLIGENCE G08_REVENUE G09_GLOW G10_SYSTEMS G11_LANGUAGE G12_COMMUNITY
  G13_GROUP_RESEARCH G14_PROJECTS G15_SCALE_OPS G16_FULL_RELEASE
)

# --- per-gate state -----------------------------------------------------------------------
GATE_DIR=""
STEPS_JSON=""
GATE_FAILED=0
GATE_NOTES=""

json_escape() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }

note() { GATE_NOTES="${GATE_NOTES}${GATE_NOTES:+ | }$1"; }

# run <step-name> <command...> — required step; a non-zero exit fails the gate.
run() {
  local name="$1"; shift
  local log="$GATE_DIR/$name.log"
  local start; start="$(date -u +%s)"
  printf '$ %s\n\n' "$*" >"$log"
  "$@" >>"$log" 2>&1
  local code=$?
  local end; end="$(date -u +%s)"
  [ "$code" -ne 0 ] && GATE_FAILED=1
  STEPS_JSON="${STEPS_JSON}${STEPS_JSON:+,}$(printf '{"step":%s,"command":%s,"exit_code":%d,"seconds":%d,"log":%s}' \
    "$(json_escape "$name")" "$(json_escape "$*")" "$code" "$((end-start))" "$(json_escape "$name.log")")"
  printf '  %-34s exit=%-3d %ss\n' "$name" "$code" "$((end-start))"
  return "$code"
}

# skip <step-name> <reason> — records an unmet requirement without pretending it ran.
skip() {
  local name="$1" reason="$2"
  STEPS_JSON="${STEPS_JSON}${STEPS_JSON:+,}$(printf '{"step":%s,"command":null,"exit_code":null,"skipped_reason":%s}' \
    "$(json_escape "$name")" "$(json_escape "$reason")")"
  printf '  %-34s SKIPPED — %s\n' "$name" "$reason"
}

# --- gate bodies --------------------------------------------------------------------------
# Each gate_* function sets GATE_VERDICT_OVERRIDE when its honest verdict is not PASS/FAIL.

gate_G00_EVIDENCE() {
  run git_head git rev-parse --verify 'HEAD^{commit}'
  run git_status git status --short --branch
  run dependency_locks git ls-files --error-unmatch \
    package-lock.json apps/api/requirements.lock apps/api/requirements-dev.lock
  run v197_integrity npm run --silent v197:integrity
  run secret_scan npm run --silent secret-scan
  # A repository scan can prove the candidate is clean; it cannot prove a
  # previously exposed provider credential was revoked outside this repository.
  GATE_VERDICT_OVERRIDE="FOUNDER_ACTION_REQUIRED"
  note "FOUNDER_ACTION_REQUIRED_VERIFY_CREDENTIAL_ROTATION — local secret scan passed, provider-side revocation remains external"
  skip credential_rotation "requires provider-side revocation evidence; never infer rotation from repository contents"
}

gate_G01_STATIC() {
  run ruff apps/api/.venv/bin/ruff check apps/api
  run backend_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q'
  run alembic_single_head bash -c 'cd apps/api && ../../apps/api/.venv/bin/alembic heads | grep -c "(head)" | grep -qx 1'
  run migration_upgrade_and_roundtrip bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/agentic/test_upgrade_from_released_db.py app/tests/agentic/test_migration_roundtrip_db.py app/tests/agentic/test_migration_reconciliation_db.py app/tests/agentic/test_orm_schema_parity.py'
  run mutation_security npm run --silent api:mutation-security
  run openapi_drift npm run --silent api:openapi-drift
  run web_typecheck npm run --silent web:typecheck
  run web_unit_tests npm run --silent web:test
  run web_build npm run --silent web:build
  run v197_integrity npm run --silent v197:integrity
  run secret_scan npm run --silent secret-scan
  run release_naming npm run --silent release:naming-scan
  run diff_check git diff --check
  if [ -f apps/mobile/package.json ]; then
    run mobile_typecheck npm run --silent mobile:typecheck
  else
    skip mobile_typecheck "apps/mobile is not present in this candidate"
  fi
  run node_dependency_audit npm audit --audit-level=high
  run python_dependency_consistency apps/api/.venv/bin/python -m pip check
  run sbom_freshness bash infra/tests/sbom-freshness.test.sh
  run fresh_extract_package_contract bash infra/tests/release-package-fresh-extract.test.sh
}

playwright_ready() { [ -d "$HOME/.cache/ms-playwright" ] || [ -d "$ROOT/node_modules/playwright-core/.local-browsers" ]; }

api_ready() {
  curl -fsS --max-time 3 -o /dev/null "${NUR_API_ORIGIN:-http://localhost:8000}/healthz" 2>/dev/null
}

browser_gate_projects() { # <comma-separated-projects> <spec...>
  local project_csv="$1"; shift
  if ! playwright_ready; then
    GATE_VERDICT_OVERRIDE="BLOCKED_EXTERNAL"
    note "Playwright browsers not installed — run: npx playwright install --with-deps"
    skip browser_suite "Playwright browsers unavailable"
    return
  fi
  # Playwright's webServer starts Vite only. Specs that exercise real auth proxy to
  # the API, so without it they fail with ECONNREFUSED — an environment gap, not a
  # product defect, and it must not be recorded as one.
  if ! api_ready; then
    GATE_VERDICT_OVERRIDE="BLOCKED_EXTERNAL"
    note "API not reachable at ${NUR_API_ORIGIN:-http://localhost:8000}/healthz — start the stack: bash RUN_NUR.sh"
    skip browser_suite "API stack not running"
    return
  fi
  # Every browser gate signs in as the same demo owner, and login is rate limited to
  # 10 attempts per 300s per ip+email. Six browser gates back to back therefore exhaust
  # the window and later gates fail at sign-in with an empty universe stage — which
  # looks exactly like a presentation defect. Space consecutive browser gates rather
  # than raising the production limit or weakening the specs.
  local spacing="${NUR_GATE_BROWSER_SPACING_SECONDS:-0}"
  if [ "$spacing" -gt 0 ] && [ -n "${NUR_GATE_BROWSER_RAN:-}" ]; then
    printf '  %-34s waiting %ss for the login rate-limit window\n' "browser_spacing" "$spacing"
    sleep "$spacing"
  fi
  NUR_GATE_BROWSER_RAN=1
  local projects=()
  local project
  IFS=',' read -r -a projects <<<"$project_csv"
  local project_args=()
  for project in "${projects[@]}"; do
    [ -n "$project" ] && project_args+=("--project=$project")
  done
  run browser_suite npm --workspace apps/web run e2e -- "$@" "${project_args[@]}" --workers=1
}

browser_gate() { # <spec...>
  browser_gate_projects "chromium-desktop" "$@"
}

gate_G02_AUTH() {
  run auth_backend_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_auth.py app/tests/test_password_recovery.py app/tests/test_rls.py app/tests/test_hardness_db_rls.py app/tests/test_mutation_security_matrix.py'
  browser_gate \
    e2e/fresh-signup.spec.ts \
    e2e/landing-auth.spec.ts \
    e2e/presentation-auth-recovery.spec.ts \
    e2e/account-privacy-ui.spec.ts
}

gate_G03_V197() {
  run v197_integrity npm run --silent v197:integrity
  run control_matrix_regen node apps/web/scripts/rebuild-v197-control-matrix.mjs
  run control_matrix_fresh git diff --exit-code -- docs/release/v197-control-matrix.json
  run control_matrix_fingerprint bash -c 'python3 -c "import json,re,sys;m=json.load(open(\"docs/release/v197-control-matrix.json\"));sys.exit(0 if m.get(\"generation_policy\")==\"deterministic-source-fingerprint-v1\" and re.fullmatch(r\"[0-9a-f]{64}\",m.get(\"source_fingerprint\",\"\")) else 1)"'
  run no_broken_controls bash -c 'python3 -c "
import json,sys
m=json.load(open(\"docs/release/v197-control-matrix.json\"))
bad={k:m[\"totals\"].get(k,0) for k in (\"DEAD\",\"DUPLICATE\",\"MISLEADING\")}
sys.exit(1 if any(bad.values()) else 0)"'
  browser_gate \
    e2e/v197-control-matrix.spec.ts \
    e2e/v197-host-parity.spec.ts \
    e2e/v197-forensic-shell.spec.ts \
    e2e/v197-runtime-lifecycle.spec.ts \
    e2e/surface-navigation.spec.ts \
    e2e/owner-product-surfaces.spec.ts
  skip deferred_controls "3 controls remain NOT_IMPLEMENTED_VISIBLE (G03-007)"
}

gate_G04_PERFORMANCE() {
  browser_gate_projects "chromium-desktop,chromium-mobile" \
    e2e/v197-performance-acceptance.spec.ts \
    e2e/v197-performance.spec.ts \
    e2e/v197-responsive-accessibility.spec.ts
  if [ "${NUR_G04_SOAK:-0}" = "1" ]; then
    run ten_minute_heap_soak env NUR_G04_SOAK=1 npm --workspace apps/web run e2e -- \
      --config=playwright.g04.config.ts \
      e2e/v197-performance-acceptance.spec.ts \
      --project=chromium-desktop-g04 \
      --workers=1
  else
    skip heap_soak "implemented; set NUR_G04_SOAK=1 to execute the explicit ten-minute release soak"
  fi
}

gate_G05_LIVE_AI() {
  run provider_contract_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_ai_provider_failures.py app/tests/test_ai_structured_outputs.py app/tests/test_verifier_grounding.py app/tests/test_cognition_streaming.py'
  run budget_enforcement_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_rate_quota_hardening.py app/tests/test_mind_brain_capability_closure.py app/tests/agentic/test_policy.py app/tests/agentic/test_policy_runtime_state_db.py'
  run secret_scan npm run --silent secret-scan
  if [ ! -f "$ROOT/.env.local" ]; then
    GATE_VERDICT_OVERRIDE="FOUNDER_ACTION_REQUIRED"
    note "FOUNDER_ACTION_REQUIRED_CONFIGURE_OPENAI — no .env.local on this candidate; a proof from another worktree must not be inherited"
    skip live_two_turn_proof "no server-side provider credential configured here"
  else
    run live_two_turn_proof node infra/scripts/live-talk-two-turn-proof.mjs
  fi
}

gate_G06_RECOVERY() {
  run recovery_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_password_recovery.py'
  run recovery_delivery_resilience bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_password_recovery.py -k "delivery or smtp"'
  GATE_VERDICT_OVERRIDE="FOUNDER_ACTION_REQUIRED"
  note "FOUNDER_ACTION_REQUIRED_CONFIGURE_EMAIL_PROVIDER — local file capture is development-only"
  skip production_delivery "transactional email provider, sender verification, and provider-side bounce callback remain external"
}

gate_G07_INTELLIGENCE() {
  run intelligence_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_live_intelligence.py app/tests/test_intelligence_contracts.py app/tests/test_personal_memory.py app/tests/test_teach_nur.py app/tests/test_omega.py app/tests/test_rls.py'
  run evaluation_suite bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_brain_semantic_addendum.py app/tests/test_prompt_tool_injection_corpus.py app/tests/test_hardness_unit.py app/tests/test_hardness_e2e.py'
  run bounded_tool_registry bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/agentic/test_tool_registry.py app/tests/agentic/test_empty_permission_gate.py app/tests/agentic/test_tool_call_approval_binding_db.py app/tests/agentic/test_tool_version_gate_db.py'
  run intelligence_lifecycle bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_capability_loop_integration.py app/tests/test_capability_runtime_e2e.py app/tests/test_outcome_learning_loop.py app/tests/test_track_a_vertical_slice.py app/tests/agentic/test_owner_lifecycle_http_db.py app/tests/agentic/test_approval_http_e2e.py'
}

gate_G08_REVENUE() {
  GATE_VERDICT_OVERRIDE="FOUNDER_ACTION_REQUIRED"
  note "FOUNDER_ACTION_REQUIRED_CONFIGURE_BILLING_TEST_PROVIDER"
  run billing_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_billing.py app/tests/test_feature_lock_endpoints.py'
  browser_gate e2e/owner-product-surfaces.spec.ts
  skip provider_test_mode "merchant account, signed sandbox webhook secret, and provider checkout remain external"
}

gate_G09_GLOW() {
  run glow_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_notifications.py app/tests/test_sol_living_system.py app/tests/test_track_a_vertical_slice.py app/tests/test_cognition.py app/tests/test_community_completion.py'
  GATE_VERDICT_OVERRIDE="FOUNDER_ACTION_REQUIRED"
  note "FOUNDER_ACTION_REQUIRED_CONFIGURE_NOTIFICATION_PROVIDER — in-app delivery is tested; push/email delivery remains external"
  skip notification_delivery "push/email delivery provider and sender credentials remain external"
}

gate_G10_SYSTEMS() {
  run systems_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_sol_living_system.py app/tests/test_live_universe.py app/tests/test_product_surfaces.py app/tests/test_track_a_vertical_slice.py'
  browser_gate e2e/sol-living-v197.spec.ts e2e/universe-lenses.spec.ts
}

gate_G11_LANGUAGE() {
  GATE_VERDICT_OVERRIDE="FOUNDER_ACTION_REQUIRED"
  note "FOUNDER_ACTION_REQUIRED_LOCALE_HUMAN_REVIEW — an agent may not label its own output native-reviewed"
  run translation_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_translations.py'
  browser_gate e2e/v197-language-wordmark.spec.ts e2e/v197-responsive-accessibility.spec.ts
  run string_extraction npm run --silent web:i18n-extraction
}

gate_G12_COMMUNITY() {
  run community_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_community_completion.py app/tests/test_group_nur.py app/tests/test_rls.py'
  browser_gate e2e/community-group-nur.spec.ts
}

gate_G13_GROUP_RESEARCH() {
  run group_research_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_group_research_completion.py app/tests/test_consultations.py app/tests/test_group_nur.py'
  GATE_VERDICT_OVERRIDE="BLOCKED_EXTERNAL"
  note "research live fetch is BLOCKED_BY_EXTERNAL_PROVIDER in the control matrix"
  skip live_research "lawful research retrieval provider and production credentials remain external"
}

gate_G14_PROJECTS() {
  run project_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_am_projects.py app/tests/test_am_project_execution.py app/tests/test_am_project_storage.py app/tests/test_am_project_quota.py app/tests/test_am_project_recovery.py app/tests/test_capsules.py app/tests/test_storage_hygiene.py'
  run bounded_agent_runtime bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/agentic/test_tool_registry.py app/tests/agentic/test_vertical_slices_db.py app/tests/agentic/test_owner_lifecycle_http_db.py app/tests/agentic/test_durable_handlers.py app/tests/agentic/test_approvals.py app/tests/agentic/test_policy_runtime_state_db.py'
  browser_gate e2e/project-deliverables.spec.ts e2e/capsule.spec.ts e2e/agentic-owner-ui.spec.ts
}

gate_G15_SCALE_OPS() {
  GATE_VERDICT_OVERRIDE="FOUNDER_ACTION_REQUIRED"
  note "FOUNDER_ACTION_REQUIRED_STAGING_ACCESS — no staging environment, no CI run on this candidate"
  run ops_tests bash -c 'cd apps/api && .venv/bin/python -m pytest -q app/tests/test_health.py app/tests/test_ops_diagnostics.py app/tests/test_dr.py app/tests/test_bounded_load.py app/tests/test_account_privacy.py'
  run production_web_contract bash infra/tests/production-web-serving.test.sh
  run cold_boot_contract bash infra/tests/cold-boot-compose.test.sh
  run api_container_contract bash infra/tests/api-container-build-contract.test.sh
  browser_gate e2e/account-privacy-ui.spec.ts
  skip staging_deploy "production-like staging environment and access remain external"
  if [ "${NUR_G15_DRILL:-0}" = "1" ]; then
    run timed_restore_drill bash infra/scripts/dr-drill.sh
  else
    skip timed_restore_drill "implemented; set NUR_G15_DRILL=1 to execute the measured restore drill"
  fi
}

gate_G16_FULL_RELEASE() {
  GATE_VERDICT_OVERRIDE="FOUNDER_ACTION_REQUIRED"
  note "FOUNDER_ACTION_REQUIRED_RELEASE_APPROVAL — and G00..G15 are not all PASS"
  run proof_hygiene npm run --silent proof-hygiene
  run release_package_contract bash infra/tests/release-package-contract.test.sh
  run sbom_freshness bash infra/tests/sbom-freshness.test.sh
  run release_package_fresh_extract bash infra/tests/release-package-fresh-extract.test.sh
  skip all_gates_pass "prerequisite gates are not all PASS (G16-002)"
}

# --- driver -------------------------------------------------------------------------------
run_gate() {
  local gate="$1"
  GATE_DIR="$EVIDENCE_ROOT/$gate"
  mkdir -p "$GATE_DIR"
  STEPS_JSON=""; GATE_FAILED=0; GATE_NOTES=""; GATE_VERDICT_OVERRIDE=""
  local started; started="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '\n=== %s ===\n' "$gate"

  "gate_$gate"

  local ended; ended="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # A skipped step is an unmet requirement, so it can never round up to PASS.
  # Without this, a gate whose one runnable check passes would report PASS while
  # four requirements sat unimplemented — a fake PASS by omission.
  local skipped=0
  case "$STEPS_JSON" in *'"skipped_reason"'*) skipped=1 ;; esac

  local verdict
  if [ "$GATE_FAILED" -ne 0 ]; then
    verdict="FAIL"
  elif [ -n "$GATE_VERDICT_OVERRIDE" ]; then
    verdict="$GATE_VERDICT_OVERRIDE"
  elif [ -z "$STEPS_JSON" ]; then
    verdict="NOT_IMPLEMENTED"
  elif [ "$skipped" -ne 0 ]; then
    verdict="INCOMPLETE"
  else
    verdict="PASS"
  fi

  local dirty; dirty="$(git status --porcelain | head -200)"
  python3 - "$GATE_DIR" "$gate" "$verdict" "$started" "$ended" "$COMMIT" "$BRANCH" "$ENV_CLASS" \
           "$GATE_NOTES" "$dirty" "[$STEPS_JSON]" <<'PY'
import json, sys, pathlib
d, gate, verdict, started, ended, commit, branch, env, notes, dirty, steps = sys.argv[1:12]
steps = json.loads(steps)
result = {
    "gate": gate, "verdict": verdict, "commit": commit, "branch": branch,
    "environment_class": env, "started_at": started, "ended_at": ended,
    "dirty_state_manifest": [l for l in dirty.splitlines() if l.strip()],
    "steps": steps, "notes": notes or None,
}
p = pathlib.Path(d)
(p / "result.json").write_text(json.dumps(result, indent=2) + "\n")
lines = [f"# {gate} — {verdict}", "",
         f"- commit: `{commit}`", f"- branch: `{branch}`",
         f"- environment: `{env}`", f"- window: {started} → {ended}",
         f"- dirty entries: {len(result['dirty_state_manifest'])}", ""]
if notes:
    lines += ["## Notes", "", notes, ""]
lines += ["## Steps", "", "| step | exit | seconds | log |", "| --- | --- | --- | --- |"]
for s in steps:
    if s.get("command") is None:
        lines.append(f"| {s['step']} | skipped | — | {s.get('skipped_reason','')} |")
    else:
        lines.append(f"| {s['step']} | {s['exit_code']} | {s.get('seconds','')} | `{s['log']}` |")
lines.append("")
(p / "report.md").write_text("\n".join(lines))
print(f"  -> {verdict}  ({d}/result.json)")
PY
  [ "$verdict" = "PASS" ] && return 0 || return 1
}

case "${1:-}" in
  --list|"") printf '%s\n' "${GATES[@]}"; exit 0 ;;
  ALL)
    mkdir -p "$EVIDENCE_ROOT"
    overall=0
    for g in "${GATES[@]}"; do run_gate "$g" || overall=1; done
    printf '\n=== SUMMARY (%s) ===\n' "$RUN_STAMP"
    for g in "${GATES[@]}"; do
      printf '%-22s %s\n' "$g" "$(python3 -c "import json;print(json.load(open('$EVIDENCE_ROOT/$g/result.json'))['verdict'])")"
    done
    printf '\nevidence: %s\n' "$EVIDENCE_ROOT"
    exit $overall ;;
  *)
    for g in "${GATES[@]}"; do
      if [ "$g" = "$1" ]; then mkdir -p "$EVIDENCE_ROOT"; run_gate "$g"; exit $?; fi
    done
    echo "Unknown NUR gate: $1" >&2
    printf '%s\n' "${GATES[@]}" >&2
    exit 2 ;;
esac
