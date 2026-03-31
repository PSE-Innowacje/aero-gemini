from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from aero.models.base import TimestampedModel


class LandingSite(TimestampedModel):
    __tablename__ = "landing_sites"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
