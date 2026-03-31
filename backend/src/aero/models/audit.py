from __future__ import annotations

from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aero.models.base import TimestampedModel

if TYPE_CHECKING:
    from aero.models.planned_operation import PlannedOperation
    from aero.models.user import User


class PlannedOperationAudit(TimestampedModel):
    __tablename__ = "planned_operation_audit"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    planned_operation_id: Mapped[int] = mapped_column(ForeignKey("planned_operations.id"), index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    before_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    after_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    planned_operation: Mapped[PlannedOperation] = relationship(back_populates="audits")
    actor: Mapped[User] = relationship(back_populates="audit_entries")
