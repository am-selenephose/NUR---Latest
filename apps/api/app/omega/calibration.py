from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import ROUND_FLOOR, Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Prediction

Q6 = Decimal("0.000001")


@dataclass(frozen=True)
class CalibrationBucket:
    bucket: Decimal
    count: int
    mean_forecast: Decimal
    observed_frequency: Decimal
    absolute_calibration_error: Decimal
    brier_score: Decimal


async def calibration_report(
    db: AsyncSession,
    *,
    owner_user_id: uuid.UUID,
) -> list[CalibrationBucket]:
    rows = (await db.execute(select(Prediction).where(
        Prediction.owner_user_id == owner_user_id,
        Prediction.confidence.is_not(None),
        Prediction.resolution.in_(["CONFIRMED", "CONTRADICTED"]),
    ))).scalars().all()
    grouped: dict[Decimal, list[tuple[Decimal, Decimal]]] = {}
    for row in rows:
        forecast = Decimal(row.confidence)
        observed = Decimal(1) if row.resolution == "CONFIRMED" else Decimal(0)
        bucket = (forecast * 10).to_integral_value(rounding=ROUND_FLOOR) / Decimal(10)
        grouped.setdefault(bucket, []).append((forecast, observed))

    report: list[CalibrationBucket] = []
    for bucket in sorted(grouped):
        values = grouped[bucket]
        count = len(values)
        mean_forecast = sum((p for p, _ in values), Decimal(0)) / count
        observed_frequency = sum((o for _, o in values), Decimal(0)) / count
        brier = sum(((p - o) ** 2 for p, o in values), Decimal(0)) / count
        report.append(CalibrationBucket(
            bucket=bucket.quantize(Decimal("0.1")),
            count=count,
            mean_forecast=mean_forecast.quantize(Q6),
            observed_frequency=observed_frequency.quantize(Q6),
            absolute_calibration_error=abs(mean_forecast - observed_frequency).quantize(Q6),
            brier_score=brier.quantize(Q6),
        ))
    return report
