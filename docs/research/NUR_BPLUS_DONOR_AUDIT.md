# NUR B+ Donor Audit

> Read-only local evidence audit. No donor setup/install/hook/code was executed.

| Donor | Classification | License | HEAD | Evidence |
|---|---|---|---|---|
| OpenClaw/Animantum | DONOR | unknown | 7aff0269e425 | license not established from local root; study-only; network references in 1 scanned files; secret/config references in 5 scanned files; values not collected |
| Playwright | USE | Apache-2.0 | — | local evidence shows a low-side-effect, licensed surface |
| browser-use | QUARANTINE | MIT | d379a328879f | high-risk install/hook shell pattern requires manual isolation review; network references in 64 scanned files; secret/config references in 30 scanned files; values not collected |
| Letta | REWRITE | Apache-2.0 | 4511fa0bc91f | useful donor surface exists but must be wrapped/reimplemented behind NUR boundary; network references in 9 scanned files; secret/config references in 3 scanned files; values not collected |
| Graphiti | REWRITE | Apache-2.0 | 8b61fce9f003 | useful donor surface exists but must be wrapped/reimplemented behind NUR boundary; network references in 37 scanned files; secret/config references in 30 scanned files; values not collected |
| Mem0 | REWRITE | Apache-2.0 | 19cb89aff472 | useful donor surface exists but must be wrapped/reimplemented behind NUR boundary; network references in 31 scanned files; secret/config references in 30 scanned files; values not collected |
| LangGraph | REWRITE | MIT | 11ee185999b8 | useful donor surface exists but must be wrapped/reimplemented behind NUR boundary; network references in 67 scanned files; secret/config references in 30 scanned files; values not collected |
| OpenHands | QUARANTINE | MIT | 91e4f98479c4 | high-risk install/hook shell pattern requires manual isolation review; install/package hooks declared: postinstall, prepare; network references in 34 scanned files; secret/config references in 30 scanned files; values not collected |
| Agent Lightning | REWRITE | MIT | 88528bf4b736 | useful donor surface exists but must be wrapped/reimplemented behind NUR boundary; network references in 51 scanned files; secret/config references in 30 scanned files; values not collected |
| Composio | QUARANTINE | MIT | 961b0a041877 | high-risk install/hook shell pattern requires manual isolation review; install/package hooks declared: preinstall, prepare, prepublish; network references in 40 scanned files; secret/config references in 30 scanned files; values not collected |
| Nango | REWRITE | PRESENT_UNCLASSIFIED | a810a132afe2 | useful donor surface exists but must be wrapped/reimplemented behind NUR boundary; install/package hooks declared: prepare; network references in 71 scanned files; secret/config references in 30 scanned files; values not collected |
| Firecracker | QUARANTINE | Apache-2.0 | 3522ac594856 | high-risk install/hook shell pattern requires manual isolation review; network references in 87 scanned files; secret/config references in 30 scanned files; values not collected |
| gVisor | QUARANTINE | Apache-2.0 | 6ed83306f111 | high-risk install/hook shell pattern requires manual isolation review; network references in 146 scanned files; secret/config references in 30 scanned files; values not collected |
| cosign | REWRITE | Apache-2.0 | 58aae9e112fa | useful donor surface exists but must be wrapped/reimplemented behind NUR boundary; network references in 30 scanned files; secret/config references in 32 scanned files; values not collected |
| TUF | REWRITE | Apache-2.0 | 7573dc793024 | useful donor surface exists but must be wrapped/reimplemented behind NUR boundary; network references in 55 scanned files; secret/config references in 12 scanned files; values not collected |

## Runtime rule

Only code-level allowlisted adapters classified `USE` or `REWRITE` may be resolved, and only after Agency authorization. `DONOR`, `QUARANTINE`, and `KILL` are never runtime-resolvable.
