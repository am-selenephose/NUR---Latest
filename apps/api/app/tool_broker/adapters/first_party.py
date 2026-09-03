from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.tool_broker.contracts import (
    AdapterSpec,
    AuditClassification,
    CapabilityKey,
    CapabilityRequest,
    CapabilityResult,
)

SPEC = AdapterSpec(
    key="nur.first_party",
    version="1",
    capabilities={CapabilityKey.APP_READ, CapabilityKey.APP_WRITE},
    classification=AuditClassification.USE,
    audit_evidence=("first-party NUR implementation; no donor code executed",),
)


async def invoke(
    *,
    adapter: AdapterSpec,
    request: CapabilityRequest,
    db: AsyncSession,
    owner_user_id: uuid.UUID,
    tool_key: str,
    arguments: dict[str, Any],
    approval=None,
) -> CapabilityResult:
    from app.agentic import registry as agentic_registry
    from app.agentic.handlers import invoke_bound_handler

    declared = agentic_registry.spec(tool_key)
    expected = declared.broker_capability
    if request.capability != expected:
        raise PermissionError(
            f"broker capability mismatch for {tool_key}: {request.capability} != {expected}"
        )
    data = await invoke_bound_handler(
        db,
        owner_user_id,
        tool_key=tool_key,
        arguments=arguments,
        approval=approval,
    )
    artifact_refs = [
        value
        for key in declared.artifact_ref_keys
        if isinstance((value := data.get(key)), str)
    ]
    rollback_ref = None
    if declared.rollback_ref_key:
        value = data.get(declared.rollback_ref_key)
        if isinstance(value, str):
            rollback_ref = value
    return CapabilityResult(
        capability=request.capability,
        adapter_key=adapter.key,
        adapter_version=adapter.version,
        ok=True,
        data=data,
        artifact_refs=artifact_refs,
        external_effects=list(declared.writes),
        rollback_ref=rollback_ref,
    )
