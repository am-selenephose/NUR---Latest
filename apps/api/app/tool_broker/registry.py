from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from app.tool_broker.contracts import (
    AdapterSpec,
    AuditClassification,
    CapabilityKey,
    CapabilityRequest,
    CapabilityResult,
)


class BrokerError(RuntimeError):
    pass


class UnknownCapability(BrokerError):
    pass


class AgencyAuthorizationRequired(BrokerError):
    pass


class AdapterNotRunnable(BrokerError):
    pass


class AdapterNotAllowlisted(BrokerError):
    pass


class DuplicateAdapter(BrokerError):
    pass


class AdapterUnbound(BrokerError):
    pass


AdapterHandler = Callable[..., Awaitable[CapabilityResult]]


RUNNABLE = {AuditClassification.USE, AuditClassification.REWRITE}


class CapabilityBrokerRegistry:
    def __init__(self, *, allowed_adapter_keys: set[str] | frozenset[str] | None = None):
        self._allowed = frozenset(allowed_adapter_keys or ())
        self._adapters: dict[str, AdapterSpec] = {}
        self._handlers: dict[str, AdapterHandler] = {}

    def register(self, adapter: AdapterSpec) -> None:
        if adapter.key in self._adapters:
            raise DuplicateAdapter(adapter.key)
        self._adapters[adapter.key] = adapter

    def resolve(
        self, capability: CapabilityKey | str, *, agency_authorized: bool, adapter_key: str | None = None
    ) -> AdapterSpec:
        try:
            cap = CapabilityKey(capability)
        except ValueError as exc:
            raise UnknownCapability(str(capability)) from exc
        if not agency_authorized:
            raise AgencyAuthorizationRequired(cap.value)
        candidates = [
            adapter for adapter in self._adapters.values()
            if cap in adapter.capabilities and (adapter_key is None or adapter.key == adapter_key)
        ]
        if not candidates:
            raise AdapterNotRunnable(f"no audited adapter registered for {cap.value}")
        for adapter in sorted(candidates, key=lambda item: item.key):
            if adapter.classification not in RUNNABLE:
                if adapter_key is not None:
                    raise AdapterNotRunnable(
                        f"adapter {adapter.key} classification={adapter.classification.value} is study-only/blocked"
                    )
                continue
            if adapter.key not in self._allowed:
                if adapter_key is not None or len(candidates) == 1:
                    raise AdapterNotAllowlisted(adapter.key)
                continue
            return adapter
        if any(adapter.classification in RUNNABLE for adapter in candidates):
            raise AdapterNotAllowlisted(f"no code-allowlisted adapter for {cap.value}")
        raise AdapterNotRunnable(f"no runnable audited adapter for {cap.value}")

    def bind(self, adapter_key: str, handler: AdapterHandler) -> None:
        if adapter_key not in self._adapters:
            raise AdapterNotRunnable(f"cannot bind unknown adapter {adapter_key}")
        self._handlers[adapter_key] = handler

    async def execute(self, request: CapabilityRequest, **context: Any) -> CapabilityResult:
        adapter = self.resolve(
            request.capability,
            agency_authorized=request.agency_authorized,
            adapter_key=request.adapter_key,
        )
        handler = self._handlers.get(adapter.key)
        if handler is None:
            raise AdapterUnbound(f"adapter {adapter.key} has no execution binding")
        result = await handler(adapter=adapter, request=request, **context)
        if result.adapter_key != adapter.key or result.adapter_version != adapter.version:
            raise BrokerError("adapter result identity does not match resolved adapter")
        if result.capability != request.capability:
            raise BrokerError("adapter result capability does not match request")
        return result

    def catalog(self) -> tuple[AdapterSpec, ...]:
        return tuple(self._adapters[key] for key in sorted(self._adapters))


def default_registry() -> CapabilityBrokerRegistry:
    from app.tool_broker.adapters.first_party import SPEC, invoke

    broker = CapabilityBrokerRegistry(allowed_adapter_keys={SPEC.key})
    broker.register(SPEC)
    broker.bind(SPEC.key, invoke)
    return broker
