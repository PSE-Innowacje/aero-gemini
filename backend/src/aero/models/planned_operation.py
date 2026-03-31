from datetime import date

from sqlalchemy import Column, Date, Enum, Float, ForeignKey, Integer, JSON, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aero.core.database import Base
from aero.models.base import TimestampedModel
from aero.models.enums import WorkflowStatus


flight_order_planned_operations = Table(
    "flight_order_planned_operations",
    Base.metadata,
    Column("flight_order_id", ForeignKey("flight_orders.id"), primary_key=True),
    Column("planned_operation_id", ForeignKey("planned_operations.id"), primary_key=True),
)


class PlannedOperation(TimestampedModel):
    __tablename__ = "planned_operations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    short_description: Mapped[str] = mapped_column(String(500), nullable=False)
    kml_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    proposed_date_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    proposed_date_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_date_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_date_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    activities: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    extra_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    distance_km: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[WorkflowStatus] = mapped_column(Enum(WorkflowStatus), default=WorkflowStatus.DRAFT)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    contacts: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    post_realization_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    creator = relationship("User")
    flight_orders = relationship(
        "FlightOrder",
        secondary=flight_order_planned_operations,
        back_populates="planned_operations",
    )
