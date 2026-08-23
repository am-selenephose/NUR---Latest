# NUR Test Evidence - 2026-08-23 Closure Candidate

Candidate identity: the commit containing this file. Results below were first
established on the reviewed working tree and must be replayed by the complete
gate on the clean commit before push. GitHub Actions must then pass on that
exact pushed SHA.

## Static And Contract Evidence

| Command or gate | Result |
| --- | --- |
| API Ruff, full tree | PASS |
| API pytest | PASS: 1109 passed in 196.48s |
| OpenAPI/client drift | PASS: 144 client operations, 420 OpenAPI operations, 0 missing |
| Migration graph/head | PASS: single head `0061_pw_delivery_resilience` |
| Secret scan | PASS |
| Web TypeScript | PASS |
| Web unit tests | PASS: 26 files, 131 tests |
| Web production build | PASS: 51 modules; chunk-size advisory only |
| Mocked Playwright readiness | PASS: 19 passed, 1 intentional skip, 0 failed |
| Mobile TypeScript | PASS |
| npm audit high | PASS: 0 vulnerabilities |
| Mutation security matrix | PASS |
| SBOM freshness and fresh-extract package | PASS |
| `nur-gate` shell contracts | PASS: 17 gate contracts |
| ShellCheck | PASS |

## Real-Stack Evidence

All rows use production Nginx, FastAPI, PostgreSQL and Redis; worker/Beat are
included where the behavior requires them. HTTP behavior is not intercepted,
except that the fictional external `billing.test` destination is held locally
after the real backend checkout response.

| Scenario | Result |
| --- | --- |
| Canonical Phase-H lifecycle | PASS: 4, with 2 project-intentional mobile lifecycle skips |
| Deterministic Talk answer/replay/cancel | PASS: 1 |
| Agency APPROVE/EDIT/REJECT and durable verified result | PASS: 3 |
| Focused Plan/Agency append-only lifecycle after backend event fix | PASS: 1 in 14.2s |
| Billing real checkout handoff and no premature entitlement | PASS: 1 in 9.6s |
| Capsule durability | PASS: 10 consecutive create/reload/isolation cycles |
| Runtime/performance/accessibility matrix | PASS: 7, with 5 intentional applicability skips |
| WebKit mobile routes | PASS: 2 |
| API, worker, Beat and Redis crash/restart drills | PASS |
| DR backup/restore | PASS: 192 tables hashed, 2 object digests; backup about 173ms, restore about 1667ms |

The diagnostic runs that exposed real defects were retained in the engineering
log but are not counted as green evidence: popup success was initially
misclassified as blocked, initial popup navigation raced `about:blank`, and the
Mind-to-Agency bridge initially omitted the first two lifecycle events. Each
root cause was fixed without weakening assertions, force-clicking, arbitrary
sleeps or timeout inflation.

## Exact Candidate Gate

Run from repository root on a clean commit:

```bash
bash infra/scripts/nur-gate.sh G01_STATIC
NUR_REAL_STACK_SOAK=1 bash infra/scripts/real-stack-release-gate.sh
```

Together these commands include static contracts, real-stack browser proof,
production serving, performance/accessibility, crash recovery, DR and the exact
10-minute soak. Push is prohibited if either command fails. After push,
`.github/workflows/readiness.yml` must succeed on the same SHA before K2 is
marked verified.
