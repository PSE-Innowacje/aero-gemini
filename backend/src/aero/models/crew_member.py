from datetime import date

from sqlalchemy import Date, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from aero.models.base import TimestampedModel
from aero.models.enums import CrewRole


class CrewMember(TimestampedModel):
    __tablename__ = "crew_members"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True, index=True)
    weight: Mapped[int] = mapped_column(Integer, nullable=False)
    role: Mapped[CrewRole] = mapped_column(Enum(CrewRole), nullable=False)
    pilot_license_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    license_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    training_valid_until: Mapped[date] = mapped_column(Date, nullable=False)
