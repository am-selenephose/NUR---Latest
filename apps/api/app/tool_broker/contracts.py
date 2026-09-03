from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class CapabilityKey(StrEnum):
    BROWSER_NAVIGATE = "browser.navigate"
    BROWSER_EXTRACT = "browser.extract"
    RESEARCH_FETCH = "research.fetch"
    WORKER_BACKGROUND = "worker.background"
    WORKER_CODE = "worker.code"
    APP_READ = "app.read"
    APP_WRITE = "app.write"
    MODEL_RUN = "model.run"


class AuditClassification(StrEnum):
    USE = "USE"
    DONOR = "DONOR"
    REWRITE = "REWRITE"
    QUARANTINE = "QUARANTINE"
    KILL = "KILL"


class AdapterSpec(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    version: str = Field(min_length=1, max_length=80)
    capabilities: frozenset[CapabilityKey | str]
    classification: AuditClassification
    audit_evidence: tuple[str, ...] = ()

    @field_validator("capabilities")
    @classmethod
    def known_capabilities(cls, value):
        return frozenset(CapabilityKey(item) for item in value)


class CapabilityRequest(BaseModel):
    capability: CapabilityKey
    agency_authorized: bool = False
    adapter_key: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class CapabilityResult(BaseModel):
    capability: CapabilityKey
    adapter_key: str
    adapter_version: str
    ok: bool
    data: dict[str, Any] = Field(default_factory=dict)
    artifact_refs: list[str] = Field(default_factory=list)
    external_effects: list[str] = Field(default_factory=list)
    rollback_ref: str | None = None
