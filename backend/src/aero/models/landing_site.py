from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aero.models.base import TimestampedModel

if TYPE_CHECKING:
    from aero.models.flight_order import FlightOrder


class LandingSite(TimestampedModel):
    __tablename__ = "landing_sites"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    departing_flight_orders: Mapped[list[FlightOrder]] = relationship(
        back_populates="start_site",
        foreign_keys="FlightOrder.start_site_id",
    )
    arriving_flight_orders: Mapped[list[FlightOrder]] = relationship(
        back_populates="end_site",
        foreign_keys="FlightOrder.end_site_id",
    )
