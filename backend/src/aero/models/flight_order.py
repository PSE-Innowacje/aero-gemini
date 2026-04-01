from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aero.core.database import Base
from aero.models.base import TimestampedModel
from aero.models.enums import FlightOrderStatus

if TYPE_CHECKING:
    from aero.models.crew_member import CrewMember
    from aero.models.helicopter import Helicopter
    from aero.models.landing_site import LandingSite
    from aero.models.planned_operation import PlannedOperation


flight_order_crew_members = Table(
    "flight_order_crew_members",
    Base.metadata,
    Column("flight_order_id", ForeignKey("flight_orders.id"), primary_key=True),
    Column("crew_member_id", ForeignKey("crew_members.id"), primary_key=True),
)


class FlightOrder(TimestampedModel):
    __tablename__ = "flight_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    planned_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    planned_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pilot_id: Mapped[int] = mapped_column(ForeignKey("crew_members.id"), nullable=False)
    helicopter_id: Mapped[int] = mapped_column(ForeignKey("helicopters.id"), nullable=False)
    start_site_id: Mapped[int] = mapped_column(ForeignKey("landing_sites.id"), nullable=False)
    end_site_id: Mapped[int] = mapped_column(ForeignKey("landing_sites.id"), nullable=False)
    crew_weight: Mapped[int] = mapped_column(Integer, default=0)
    estimated_distance: Mapped[float] = mapped_column(Float, default=0.0)
    actual_distance: Mapped[float | None] = mapped_column(Float, nullable=True, default=None)
    status: Mapped[FlightOrderStatus] = mapped_column(
        Enum(FlightOrderStatus),
        default=FlightOrderStatus.NEW,
    )

    pilot: Mapped[CrewMember] = relationship(
        back_populates="flight_orders_as_pilot",
        foreign_keys=[pilot_id],
    )
    helicopter: Mapped[Helicopter] = relationship(back_populates="flight_orders")
    start_site: Mapped[LandingSite] = relationship(
        back_populates="departing_flight_orders",
        foreign_keys=[start_site_id],
    )
    end_site: Mapped[LandingSite] = relationship(
        back_populates="arriving_flight_orders",
        foreign_keys=[end_site_id],
    )
    crew_members: Mapped[list[CrewMember]] = relationship(
        secondary=flight_order_crew_members,
        back_populates="assigned_flight_orders",
    )
    planned_operations: Mapped[list[PlannedOperation]] = relationship(
        secondary="flight_order_planned_operations",
        back_populates="flight_orders",
    )
