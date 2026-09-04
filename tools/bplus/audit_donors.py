#!/usr/bin/env python3
"""Read-only local donor audit for NUR B+.

The auditor reads files and read-only Git metadata only. It never imports donor
packages, runs package managers, setup scripts, hooks, binaries, or repo code.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from enum import StrEnum
from pathlib import Path
from typing import Any


class AuditClassification(StrEnum):
    USE = "USE"
    DONOR = "DONOR"
    REWRITE = "REWRITE"
    QUARANTINE = "QUARANTINE"
    KILL = "KILL"


SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "dist", "build", "target", "__pycache__"}
MANIFESTS = ("package.json", "pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Cargo.toml", "go.mod")
LICENSE_NAMES = ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING", "COPYING.md")
HOOK_NAMES = {"preinstall", "install", "postinstall", "prepare", "prepublish", "prepublishOnly"}
NETWORK_RE = re.compile(r"https?://|wss?://|curl\s|wget\s|requests\.|httpx\.|fetch\(", re.IGNORECASE)
SECRET_RE = re.compile(r"api[_-]?key|secret|token|password|credential|private[_-]?key", re.IGNORECASE)
KILL_RE = re.compile(r"rm\s+-rf\s+/(?:\s|$)|mkfs\.|dd\s+if=.*of=/dev/|credential\s*dump", re.IGNORECASE)
QUARANTINE_RE = re.compile(r"(?:curl|wget).*(?:\||;)\s*(?:sh|bash)|\bsudo\b|chmod\s+777", re.IGNORECASE)


class DonorAudit:
    def __init__(self, **kwargs: Any):
        self.__dict__.update(kwargs)

    def to_dict(self) -> dict[str, Any]:
        out = dict(self.__dict__)
        out["classification"] = self.classification.value
        out["path"] = str(self.path)
        return out


def _run_git(repo: Path, *args: str) -> str | None:
    if not (repo / ".git").exists():
        return None
    proc = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True, check=False, timeout=4
    )
    if proc.returncode != 0:
        return None
    return proc.stdout.strip() or None


def _license_hint(repo: Path) -> str | None:
    for name in LICENSE_NAMES:
        path = repo / name
        if not path.is_file():
            continue
        text = path.read_text(errors="ignore")[:12000].lower()
        if "apache license" in text and "2.0" in text:
            return "Apache-2.0"
        if "mit license" in text or "permission is hereby granted, free of charge" in text:
            return "MIT"
        if "gnu affero general public license" in text:
            return "AGPL"
        if "gnu general public license" in text:
            return "GPL"
        if "bsd" in text and "redistribution" in text:
            return "BSD"
        return "PRESENT_UNCLASSIFIED"
    return None


def _safe_text_files(repo: Path, limit: int = 2500):
    count = 0
    for path in repo.rglob("*"):
        if count >= limit:
            return
        if not path.is_file() or any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.stat().st_size > 1_000_000:
            continue
        is_env = path.name == ".env" or path.name.startswith(".env.")
        if (
            path.suffix.lower() not in {".json", ".toml", ".yaml", ".yml", ".py", ".js", ".ts", ".md", ".txt", ".env", ".sh"}
            and path.name not in MANIFESTS
            and not is_env
        ):
            continue
        count += 1
        yield path


def audit_repo(name: str, path: str | Path) -> DonorAudit:
    repo = Path(path).expanduser().resolve()
    if not repo.is_dir():
        return DonorAudit(
            name=name, path=repo, present=False, remote=None, head=None, license_hint=None,
            manifests=[], executable_hooks=[], network_references=[], secret_references=[],
            recent_commits=[], classification=AuditClassification.QUARANTINE,
            evidence=["local path not present; runtime adoption blocked until evidence exists"],
        )

    manifests = [item for item in MANIFESTS if (repo / item).is_file()]
    executable_hooks: list[str] = []
    network_refs: list[str] = []
    secret_refs: list[str] = []
    suspicious_text: list[str] = []
    hook_commands: list[str] = []

    package = repo / "package.json"
    if package.is_file():
        try:
            data = json.loads(package.read_text(errors="ignore"))
            for key, command in (data.get("scripts") or {}).items():
                if key in HOOK_NAMES:
                    executable_hooks.append(key)
                    hook_commands.append(str(command))
                    suspicious_text.append(str(command))
        except (json.JSONDecodeError, OSError):
            pass

    for file in _safe_text_files(repo):
        try:
            text = file.read_text(errors="ignore")
        except OSError:
            continue
        rel = str(file.relative_to(repo))
        if NETWORK_RE.search(text):
            network_refs.append(rel)
        if SECRET_RE.search(text) or file.name.startswith(".env"):
            secret_refs.append(rel)
        if file.suffix.lower() in {".sh", ".json", ".toml", ".yaml", ".yml"}:
            suspicious_text.append(text[:10000])
        if len(network_refs) >= 30 and len(secret_refs) >= 30:
            break

    combined = "\n".join(suspicious_text)
    hooks_combined = "\n".join(hook_commands)
    license_hint = _license_hint(repo)
    if KILL_RE.search(hooks_combined):
        classification = AuditClassification.KILL
        reason = "destructive pattern found in an automatically executed package hook"
    elif QUARANTINE_RE.search(hooks_combined) or KILL_RE.search(combined) or QUARANTINE_RE.search(combined):
        classification = AuditClassification.QUARANTINE
        reason = "high-risk install/hook shell pattern requires manual isolation review"
    elif license_hint is None:
        classification = AuditClassification.DONOR
        reason = "license not established from local root; study-only"
    elif executable_hooks or secret_refs or network_refs:
        classification = AuditClassification.REWRITE
        reason = "useful donor surface exists but must be wrapped/reimplemented behind NUR boundary"
    else:
        classification = AuditClassification.USE
        reason = "local evidence shows a low-side-effect, licensed surface"

    remote = _run_git(repo, "config", "--get", "remote.origin.url")
    head = _run_git(repo, "rev-parse", "HEAD")
    log = _run_git(repo, "log", "-5", "--format=%H|%cs|%s")
    commits = log.splitlines() if log else []
    evidence = [reason]
    if executable_hooks:
        evidence.append(f"install/package hooks declared: {', '.join(sorted(set(executable_hooks)))}")
    if network_refs:
        evidence.append(f"network references in {len(set(network_refs))} scanned files")
    if secret_refs:
        evidence.append(f"secret/config references in {len(set(secret_refs))} scanned files; values not collected")

    return DonorAudit(
        name=name, path=repo, present=True, remote=remote, head=head, license_hint=license_hint,
        manifests=manifests, executable_hooks=sorted(set(executable_hooks)),
        network_references=sorted(set(network_refs))[:30],
        secret_references=sorted(set(secret_refs))[:30], recent_commits=commits,
        classification=classification, evidence=evidence,
    )


def audit_many(items: list[tuple[str, str | Path]]) -> list[DonorAudit]:
    return [audit_repo(name, path) for name, path in items]


def render_markdown(rows: list[DonorAudit]) -> str:
    lines = [
        "# NUR B+ Donor Audit", "",
        "> Read-only local evidence audit. No donor setup/install/hook/code was executed.", "",
        "| Donor | Classification | License | HEAD | Evidence |", "|---|---|---|---|---|",
    ]
    for row in rows:
        head = (row.head or "—")[:12]
        evidence = "; ".join(row.evidence).replace("|", "\\|")
        lines.append(f"| {row.name} | {row.classification.value} | {row.license_hint or 'unknown'} | {head} | {evidence} |")
    lines.extend(["", "## Runtime rule", "", "Only code-level allowlisted adapters classified `USE` or `REWRITE` may be resolved, and only after Agency authorization. `DONOR`, `QUARANTINE`, and `KILL` are never runtime-resolvable."])
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", action="append", default=[], metavar="NAME=PATH")
    parser.add_argument("--output")
    parser.add_argument("--format", choices=("json", "markdown"), default="json")
    args = parser.parse_args()
    items = []
    for raw in args.repo:
        if "=" not in raw:
            parser.error("--repo must be NAME=PATH")
        name, path = raw.split("=", 1)
        items.append((name, path))
    rows = audit_many(items)
    content = render_markdown(rows) if args.format == "markdown" else json.dumps([r.to_dict() for r in rows], indent=2)
    if args.output:
        Path(args.output).write_text(content)
    else:
        print(content)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
