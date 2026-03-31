from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Date, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aero.models.base import TimestampedModel
from aero.models.enums import CrewRole

if TYPE_CHECKING:
    from aero.models.flight_order import FlightOrder


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
    flight_orders_as_pilot: Mapped[list[FlightOrder]] = relationship(
        back_populates="pilot",
        foreign_keys="FlightOrder.pilot_id",
    )
    assigned_flight_orders: Mapped[list[FlightOrder]] = relationship(
        secondary="flight_order_crew_members",
        back_populates="crew_members",
    )
