import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import NURTalkOutput
from app.models import Prediction


async def persist_predictions(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    orbit_id: uuid.UUID | None,
    source_event_id: uuid.UUID,
    output: NURTalkOutput,
) -> list[Prediction]:
    """Do not promote free-form hypotheses into the calibrated prediction ledger.

    NURTalkOutput currently exposes hypotheses as plain strings, without the metric,
    operator, target, confidence, and review horizon required by the canonical
    prediction contract. They remain hypotheses until a structured observable
    contract exists; inventing one here would create fake calibration data.
    """
    _ = (db, owner_user_id, orbit_id, source_event_id, output)
    return []
