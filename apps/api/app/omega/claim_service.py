import datetime as dt
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.mind.why_changed import ChangeClass
from app.models import OmegaClaim
from app.omega.canonical_claim_service import (
    confirm_claim_authority,
    create_canonical_claim,
    mutate_canonical_claim,
)
from app.omega.evidence_graph import link_evidence
from app.omega.schemas import OmegaClaimIn


async def create_claim(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    payload: OmegaClaimIn,
) -> OmegaClaim:
    return await create_canonical_claim(
        db, owner_user_id=owner_user_id, payload=payload
    )


async def list_claims(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    orbit_id: uuid.UUID | None = None,
    status: str | None = None,
    claim_type: str | None = None,
    limit: int = 50,
) -> list[OmegaClaim]:
    q = (
        select(OmegaClaim)
        .where(OmegaClaim.owner_user_id == owner_user_id)
        .order_by(OmegaClaim.updated_at.desc(), OmegaClaim.created_at.desc())
        .limit(min(limit, 200))
    )
    if orbit_id:
        q = q.where(OmegaClaim.orbit_id == orbit_id)
    if status:
        q = q.where(OmegaClaim.truth_status == status)
    if claim_type:
        q = q.where(OmegaClaim.claim_type == claim_type)
    return list((await db.execute(q)).scalars())


async def confirm_claim(
    db: AsyncSession, *, owner_user_id: uuid.UUID, claim_id: uuid.UUID
) -> OmegaClaim:
    row, _ = await confirm_claim_authority(
        db, owner_user_id=owner_user_id, claim_id=claim_id
    )
    return row


async def retire_claim(
    db: AsyncSession, *, owner_user_id: uuid.UUID, claim_id: uuid.UUID
) -> OmegaClaim:
    row, _ = await mutate_canonical_claim(
        db,
        owner_user_id=owner_user_id,
        claim_id=claim_id,
        patch={"truth_status": "RETIRED", "epistemic_status": "RETIRED"},
        change_class=ChangeClass.RETRACTED,
        trigger="Owner retired this canonical claim.",
        actor="owner",
        affected_future_behavior="Retired claims are excluded from active cognition.",
    )
    return row


async def weaken_claim_for_correction(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
    claim_id: uuid.UUID,
    correction_event_id: uuid.UUID,
    note: str,
) -> OmegaClaim:
    row = await _claim(db, owner_user_id=owner_user_id, claim_id=claim_id)
    await link_evidence(
        db,
        owner_user_id=owner_user_id,
        claim_id=row.id,
        evidence_kind="CORRECTION",
        evidence_id=correction_event_id,
        relation="CONTRADICTS",
        strength=1.0,
        note=note,
    )
    row.confidence = max(0.05, float(row.confidence or 0.5) - 0.25)
    row.updated_at = dt.datetime.now(dt.timezone.utc)
    await db.flush()
    return row


async def _claim(db: AsyncSession, *, owner_user_id: uuid.UUID, claim_id: uuid.UUID) -> OmegaClaim:
    row = (await db.execute(select(OmegaClaim).where(
        OmegaClaim.id == claim_id,
        OmegaClaim.owner_user_id == owner_user_id,
    ))).scalar_one_or_none()
    if not row:
        raise PermissionError("Claim not found.")
    return row
