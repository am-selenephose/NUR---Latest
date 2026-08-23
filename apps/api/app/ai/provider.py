import asyncio
from typing import Any, Protocol

from app.ai.schemas import AIProviderResult, AIStreamSink, NURTalkOutput, TalkProviderRequest
from app.core.config import get_settings


class AIProvider(Protocol):
    name: str

    async def complete_private_talk(
        self,
        request: TalkProviderRequest,
        event_sink: AIStreamSink | None = None,
    ) -> AIProviderResult: ...


class DisabledAIProvider:
    name = "disabled"
    REASON = "AI provider is disabled. Configure NUR_AI_PROVIDER=openai with a server-only key to generate model output."

    async def complete_private_talk(
        self,
        request: TalkProviderRequest,  # noqa: ARG002
        event_sink: AIStreamSink | None = None,
    ) -> AIProviderResult:
        result = AIProviderResult(
            provider=self.name,
            model=None,
            available=False,
            reason=self.REASON,
            output=NURTalkOutput(
                direct_response="I can hold this in your private Talk ledger, but live AI is not enabled on this server yet.",
                observed=[],
                inferred=[],
                hypotheses=[],
                uncertainty=["No model output was generated because the AI provider is disabled."],
                next_move="Keep one concrete line in the ledger, then enable the server-only provider when you are ready.",
                memory_candidates=[],
                source_refs=[],
            ),
        )
        if event_sink is not None:
            await event_sink("provider.disabled", {"reason": self.REASON})
        return result


class DeterministicProofAIProvider:
    """Non-production server adapter for full-stack protocol proofs.

    This adapter never represents live model output. Its explicit provider and
    model names keep evidence honest while exercising the same SSE, Mind,
    Brain, persistence, replay, cancellation, and browser paths as a live
    provider.
    """

    name = "deterministic"
    model = "nur-deterministic-proof-v1"
    direct_response = "NUR received this line through its server-side cognitive stream."

    def __init__(self, settings: Any = None) -> None:
        self._settings = settings or get_settings()

    async def complete_private_talk(
        self,
        request: TalkProviderRequest,  # noqa: ARG002
        event_sink: AIStreamSink | None = None,
    ) -> AIProviderResult:
        response_id = "deterministic-proof-response"
        if event_sink is not None:
            await event_sink("provider.created", {"response_id": response_id})
        delay_ms = int(self._settings.ai_deterministic_delay_ms)
        if delay_ms:
            await asyncio.sleep(delay_ms / 1000)
        midpoint = len(self.direct_response) // 2
        if event_sink is not None:
            await event_sink("response.text.delta", {"delta": self.direct_response[:midpoint]})
            await event_sink("response.text.delta", {"delta": self.direct_response[midpoint:]})
            await event_sink(
                "provider.completed",
                {"response_id": response_id, "schema_valid": True},
            )
        return AIProviderResult(
            provider=self.name,
            model=self.model,
            available=True,
            raw_response_id=response_id,
            usage={"input_tokens": 0, "output_tokens": 0},
            output=NURTalkOutput(
                direct_response=self.direct_response,
                observed=[],
                inferred=[],
                hypotheses=[],
                uncertainty=["This response came from NUR's deterministic non-production proof adapter."],
                next_move="Verify the durable response after a reload.",
                memory_candidates=[],
                source_refs=[],
            ),
        )


def get_ai_provider() -> AIProvider:
    s = get_settings()
    if s.ai_provider == "disabled":
        return DisabledAIProvider()
    if s.ai_provider == "deterministic":
        return DeterministicProofAIProvider(s)
    from app.ai.openai_provider import OpenAITalkProvider

    return OpenAITalkProvider()
