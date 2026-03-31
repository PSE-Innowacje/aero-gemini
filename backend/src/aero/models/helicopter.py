from datetime import date

from sqlalchemy import Date, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from aero.models.base import TimestampedModel
from aero.models.enums import ResourceStatus


class Helicopter(TimestampedModel):
    __tablename__ = "helicopters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    registration_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    max_crew: Mapped[int] = mapped_column(Integer, nullable=False)
    max_crew_weight: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ResourceStatus] = mapped_column(Enum(ResourceStatus), default=ResourceStatus.ACTIVE)
    inspection_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    range_km: Mapped[int] = mapped_column(Integer, nullable=False)
