from datetime import UTC, datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from aero.core.database import Base


class TimestampedModel(Base):
    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
