from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from aero.models.base import TimestampedModel
from aero.models.enums import UserRole

if TYPE_CHECKING:
    from aero.models.audit import PlannedOperationAudit
    from aero.models.planned_operation import PlannedOperation


class User(TimestampedModel):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    planned_operations_created: Mapped[list[PlannedOperation]] = relationship(back_populates="creator")
    audit_entries: Mapped[list[PlannedOperationAudit]] = relationship(back_populates="actor")
