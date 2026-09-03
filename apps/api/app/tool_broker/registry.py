from __future__ import annotations

from app.tool_broker.contracts import AdapterSpec, AuditClassification, CapabilityKey


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


RUNNABLE = {AuditClassification.USE, AuditClassification.REWRITE}


class CapabilityBrokerRegistry:
    def __init__(self, *, allowed_adapter_keys: set[str] | frozenset[str] | None = None):
        self._allowed = frozenset(allowed_adapter_keys or ())
        self._adapters: dict[str, AdapterSpec] = {}

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

    def catalog(self) -> tuple[AdapterSpec, ...]:
        return tuple(self._adapters[key] for key in sorted(self._adapters))
