from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aero.core.database import Base
from aero.models.base import TimestampedModel
from aero.models.enums import WorkflowStatus


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
    status: Mapped[WorkflowStatus] = mapped_column(Enum(WorkflowStatus), default=WorkflowStatus.DRAFT)

    pilot = relationship("CrewMember", foreign_keys=[pilot_id])
    helicopter = relationship("Helicopter")
    start_site = relationship("LandingSite", foreign_keys=[start_site_id])
    end_site = relationship("LandingSite", foreign_keys=[end_site_id])
    crew_members = relationship("CrewMember", secondary=flight_order_crew_members)
    planned_operations = relationship(
        "PlannedOperation",
        secondary="flight_order_planned_operations",
        back_populates="flight_orders",
    )
