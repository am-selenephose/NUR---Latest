#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="$ROOT/apps/api"
WEB="$ROOT/apps/web"
PY="$API/.venv/bin/python"
FAILURES=0
RAN=0
FAILED_GATES=()
REQUESTED=("$@")

if [[ ! -x "$PY" ]]; then
  printf 'B+ gate runner requires %s\n' "$PY" >&2
  exit 2
fi

want_gate() {
  local id="$1"
  [[ ${#REQUESTED[@]} -eq 0 ]] && return 0
  local item
  for item in "${REQUESTED[@]}"; do
    [[ "$item" == "$id" ]] && return 0
  done
  return 1
}

require_paths() {
  local path
  for path in "$@"; do
    [[ -e "$ROOT/$path" ]] || { printf 'Missing required proof path: %s\n' "$path" >&2; return 1; }
  done
}
run_gate() {
  local id="$1" title="$2" fn="$3"
  want_gate "$id" || return 0
  RAN=$((RAN + 1))
  printf '\n=== %s — %s ===\n' "$id" "$title"
  if "$fn"; then
    printf 'PASS %s\n' "$id"
  else
    printf 'FAIL %s\n' "$id" >&2
    FAILURES=$((FAILURES + 1))
    FAILED_GATES+=("$id")
  fi
}

pytest_gate() {
  (cd "$API" && "$PY" -m pytest -q "$@")
}

web_cmd() {
  (cd "$WEB" && "$@")
}

b00() {
  require_paths \
    apps/api/app/tests/test_bplus_epistemic_core.py \
    apps/api/app/tests/test_bplus_jarvis_continuity.py \
    apps/web/e2e/bplus-jarvis-continuity.spec.ts \
    infra/scripts/nur-bplus-gate.sh || return
  bash -n "$ROOT/infra/scripts/nur-bplus-gate.sh" || return
  local heads
  heads="$(cd "$API" && "$PY" -m alembic.config heads)" || return
  printf '%s\n' "$heads"
  [[ "$(grep -c '(head)' <<<"$heads")" -eq 1 ]] || return 1
  (cd "$ROOT" && git diff --check)
}

b01() { pytest_gate app/tests/test_bplus_epistemic_core.py; }
b02() { pytest_gate app/tests/test_bplus_claim_versioning.py; }
b03() { pytest_gate app/tests/test_bplus_projections.py; }

b04() { pytest_gate app/tests/test_bplus_scope_attention.py; }
b05() { pytest_gate app/tests/test_bplus_consolidation_v2.py; }
b06() { pytest_gate app/tests/test_bplus_predictions.py; }
b07() { pytest_gate app/tests/test_bplus_contradictions.py; }
b08() { pytest_gate app/tests/test_bplus_learning_replay.py; }
b09() { pytest_gate app/tests/test_bplus_tool_broker.py app/tests/agentic/test_tool_registry.py; }
b10() {
  pytest_gate \
    app/tests/test_bplus_execution_receipts.py \
    app/tests/agentic/test_tool_call_approval_binding_db.py \
    app/tests/agentic/test_real_broker_e2e_db.py \
    app/tests/test_agency_bridge_strict.py
}
b11() {
  pytest_gate \
    app/tests/test_bplus_unified_loop.py \
    app/tests/test_mind_brain_vertical_slice.py \
    app/tests/test_cognition.py \
    app/tests/test_cognition_streaming.py
}

BPLUS_LIVE_MATRIX_PASSED=0
BPLUS_JARVIS_E2E_PASSED=0

live_bplus_browser_matrix() {
  [[ "$BPLUS_LIVE_MATRIX_PASSED" -eq 1 ]] && return 0
  "$PY" - "$ROOT" <<'PY'
import os
import pathlib
import signal
import socket
import subprocess
import sys
import time
import urllib.request

REPO = pathlib.Path(sys.argv[1])
API = REPO / "apps/api"
WEB = REPO / "apps/web"
sys.path.insert(0, str(API))
os.chdir(API)
os.environ["NUR_TEST_RUN_ID"] = f"bplus_gate_{os.getpid()}"

import app.tests.conftest as test_bootstrap  # noqa: E402


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])

api_port = free_port()
web_port = free_port()
fixture = getattr(test_bootstrap.database, "__wrapped__", test_bootstrap.database)
db_lifecycle = fixture()
api_proc = None
result_code = 1
vite_path = WEB / "vite.config.ts"
pw_path = WEB / "playwright.config.ts"
vite_original = vite_path.read_text()
pw_original = pw_path.read_text()
env_file = REPO / ".env"
created_env_file = False

try:
    next(db_lifecycle)
    if not env_file.exists():
        env_file.write_text((REPO / ".env.example").read_text())
        created_env_file = True
    env = os.environ.copy()
    env.update({
        "DATABASE_URL": test_bootstrap.APP_URL,
        "ALEMBIC_DATABASE_URL": test_bootstrap.ADMIN_URL,
        "NUR_REDIS_KEY_NAMESPACE": test_bootstrap.REDIS_NAMESPACE,
        "WEB_ORIGIN": f"http://localhost:{web_port}",
        "VITE_API_BASE_URL": f"http://localhost:{api_port}",
        "API_ORIGIN": f"http://localhost:{api_port}",
        "NUR_REDIS_HOST": "127.0.0.1",
        "NUR_REDIS_PORT": "6379",
        "NUR_BPLUS_CANONICAL_CLAIMS": "true",
        "VITE_NUR_ENABLE_OMEGA_RESEARCH": "true",
        "NUR_ENABLE_OMEGA_RESEARCH": "true",
    })
    api_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(api_port)],
        cwd=API,
        env=env,
    )
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(
                f"http://127.0.0.1:{api_port}/readyz", timeout=1
            ) as response:
                if response.status == 200:
                    break
        except Exception:
            time.sleep(0.25)
    else:
        raise RuntimeError("isolated B+ API did not become ready")

    subprocess.run(["bash", "infra/scripts/seed-demo-nur.sh"], cwd=REPO, env=env, check=True)
    vite_path.write_text(
        vite_original.replace("http://localhost:8000", f"http://localhost:{api_port}")
    )
    pw_text = pw_original.replace("http://localhost:4173", f"http://localhost:{web_port}")
    pw_text = pw_text.replace("--port 4173", f"--port {web_port}")
    pw_path.write_text(pw_text)
    print(
        f"BPLUS_LIVE_E2E db={test_bootstrap.TEST_DB} api={api_port} web={web_port}",
        flush=True,
    )
    cmd = [
        "npm", "--workspace", "apps/web", "run", "e2e", "--",
        "e2e/bplus-ambient-cognition.spec.ts",
        "e2e/omega-research.spec.ts",
        "e2e/insights-seeded-review.spec.ts",
        "e2e/timeline-surface.spec.ts",
        "e2e/map-surface.spec.ts",
        "--project=chromium-desktop", "--workers=1",
    ]
    result_code = subprocess.run(cmd, cwd=REPO, env=env).returncode
finally:
    vite_path.write_text(vite_original)
    pw_path.write_text(pw_original)
    if created_env_file and env_file.exists():
        env_file.unlink()
    if api_proc is not None:
        api_proc.send_signal(signal.SIGTERM)
        try:
            api_proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            api_proc.kill()
            api_proc.wait()
    try:
        next(db_lifecycle)
    except StopIteration:
        pass

raise SystemExit(result_code)
PY
  local code=$?
  [[ "$code" -eq 0 ]] || return "$code"
  BPLUS_LIVE_MATRIX_PASSED=1
}

jarvis_browser_e2e() {
  [[ "$BPLUS_JARVIS_E2E_PASSED" -eq 1 ]] && return 0
  web_cmd npm run e2e -- \
    e2e/bplus-jarvis-continuity.spec.ts \
    --project=chromium-desktop --workers=1 || return
  BPLUS_JARVIS_E2E_PASSED=1
}

b12() {
  web_cmd npm run test -- --run \
    src/v197/bplus-cognition-contract.test.ts \
    src/v197/performance-profile.test.ts \
    src/v197/adaptive-performance.test.ts \
    src/v197/accessibility.test.ts \
    src/v197/responsive-accessibility.test.ts \
    src/v197/search-input-performance.test.ts || return
  live_bplus_browser_matrix
}

b13() {
  pytest_gate app/tests/test_bplus_jarvis_continuity.py || return
  jarvis_browser_e2e
}

b14() {
  pytest_gate \
    app/tests/agentic/test_migration_roundtrip_db.py \
    app/tests/agentic/test_upgrade_from_released_db.py \
    app/tests/agentic/test_migration_role_rls_db.py \
    app/tests/agentic/test_migration_reconciliation_db.py \
    app/tests/test_rls.py \
    app/tests/test_hardness_db_rls.py
}

b15() {
  (cd "$ROOT" && git diff --check) || return
  "$API/.venv/bin/ruff" check \
    "$API/app/mind/cognitive_loop.py" \
    "$API/app/mind/context.py" \
    "$API/app/mind/unified_state.py" \
    "$API/app/omega/canonical_claim_service.py" \
    "$API/app/omega/prediction_v2.py" \
    "$API/app/tests/test_bplus_jarvis_continuity.py" || return
  pytest_gate app/tests || return
  web_cmd npm run typecheck || return
  web_cmd npm run test -- --run || return
  web_cmd npm run build || return
  (cd "$ROOT" && bash infra/scripts/check-v197-integrity.sh) || return
  (cd "$ROOT" && bash infra/scripts/secret-scan.sh) || return
  live_bplus_browser_matrix || return
  jarvis_browser_e2e
}

ALL_GATES=(B00 B01 B02 B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 B13 B14 B15)

for item in "${REQUESTED[@]}"; do
  case " ${ALL_GATES[*]} " in
    *" $item "*) ;;
    *) printf 'Unknown B+ gate: %s\n' "$item" >&2; exit 2 ;;
  esac
done

run_gate B00 "baseline / single Alembic head / diff hygiene" b00
run_gate B01 "Task 1 canonical Omega epistemics" b01
run_gate B02 "Task 2 canonical versions + WhyChanged" b02
run_gate B03 "Task 3 single-truth projections" b03
run_gate B04 "Task 4 scope-complete attention" b04
run_gate B05 "Task 5 starvation-free consolidation" b05
run_gate B06 "Task 6 prediction ledger + calibration" b06
run_gate B07 "Task 7 semantic contradiction verifier" b07
run_gate B08 "Task 8 Hardness policy replay" b08
run_gate B09 "Task 9 audited capability broker" b09
run_gate B10 "Task 10 Agency execution receipts" b10
run_gate B11 "Task 11 unified cognitive state" b11
run_gate B12 "Task 12 ambient V197 cognition" b12
run_gate B13 "Task 13 persisted Jarvis continuity" b13
run_gate B14 "migration / RLS / Hardness isolation" b14
run_gate B15 "full B+ acceptance closure" b15

if [[ "$RAN" -eq 0 ]]; then
  printf 'No B+ gate selected.\n' >&2
  exit 2
fi

if [[ "$FAILURES" -ne 0 ]]; then
  printf '\nB+ GATE FAILURE: %d/%d gates failed: %s\n' \
    "$FAILURES" "$RAN" "${FAILED_GATES[*]}" >&2
  exit 1
fi

printf '\nB+ GATE PASS: %d/%d requested gates passed.\n' "$RAN" "$RAN"
