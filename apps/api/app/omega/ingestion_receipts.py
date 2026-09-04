from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import and_, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CognitiveEvent
from app.models.omega import OmegaIngestionReceipt

TERMINAL_STATUSES = {"PROCESSED", "IGNORED", "QUARANTINED", "INVALIDATED"}
SOURCE_KIND = "COGNITIVE_EVENT"
MAX_ATTEMPTS = 3
SAFE_ERROR_SUMMARY = "Source processing failed; raw error details withheld."


async def next_unprocessed_sources(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    orbit_id: uuid.UUID | None,
    limit: int,
) -> list[CognitiveEvent]:
    bounded = max(0, min(int(limit), 500))
    if bounded == 0:
        return []

    receipt_join = and_(
        OmegaIngestionReceipt.owner_user_id == CognitiveEvent.owner_user_id,
        OmegaIngestionReceipt.source_kind == SOURCE_KIND,
        OmegaIngestionReceipt.source_id == CognitiveEvent.id,
    )
    stmt = (
        select(CognitiveEvent)
        .outerjoin(OmegaIngestionReceipt, receipt_join)
        .where(
            CognitiveEvent.owner_user_id == owner_user_id,
            or_(
                OmegaIngestionReceipt.id.is_(None),
                and_(
                    OmegaIngestionReceipt.status == "RETRYABLE",
                    OmegaIngestionReceipt.attempt_count < MAX_ATTEMPTS,
                ),
            ),
        )
        .order_by(CognitiveEvent.created_at.asc(), CognitiveEvent.id.asc())
        .limit(bounded)
    )
    if orbit_id is not None:
        stmt = stmt.where(CognitiveEvent.orbit_id == orbit_id)
    return list((await db.execute(stmt)).scalars())


async def get_or_create_receipt(
    db: AsyncSession, *, owner_user_id: uuid.UUID, source_id: uuid.UUID
) -> OmegaIngestionReceipt:
    stmt = (
        pg_insert(OmegaIngestionReceipt)
        .values(
            owner_user_id=owner_user_id,
            source_kind=SOURCE_KIND,
            source_id=source_id,
            status="RETRYABLE",
        )
        .on_conflict_do_nothing(
            index_elements=["owner_user_id", "source_kind", "source_id"]
        )
    )
    await db.execute(stmt)
    query = (
        select(OmegaIngestionReceipt)
        .where(
            OmegaIngestionReceipt.owner_user_id == owner_user_id,
            OmegaIngestionReceipt.source_kind == SOURCE_KIND,
            OmegaIngestionReceipt.source_id == source_id,
        )
        .with_for_update()
    )
    return (await db.execute(query)).scalar_one()


def begin_attempt(receipt: OmegaIngestionReceipt) -> None:
    receipt.attempt_count += 1
    receipt.last_attempt_at = dt.datetime.now(dt.UTC)
    receipt.error_code = None
    receipt.error_summary = None


def mark_processed(
    receipt: OmegaIngestionReceipt, *, experience_id: uuid.UUID
) -> None:
    receipt.status = "PROCESSED"
    receipt.experience_id = experience_id
    receipt.error_code = None
    receipt.error_summary = None
    receipt.completed_at = dt.datetime.now(dt.UTC)


def mark_failure(receipt: OmegaIngestionReceipt, exc: Exception) -> None:
    receipt.error_code = exc.__class__.__name__[:96]
    receipt.error_summary = SAFE_ERROR_SUMMARY
    if receipt.attempt_count >= MAX_ATTEMPTS:
        receipt.status = "QUARANTINED"
        receipt.completed_at = dt.datetime.now(dt.UTC)
    else:
        receipt.status = "RETRYABLE"
        receipt.completed_at = None
