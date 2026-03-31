from pydantic import Field

from aero.schemas.common import ORMModel


class LandingSiteBase(ORMModel):
    name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class LandingSiteCreate(LandingSiteBase):
    pass


class LandingSiteUpdate(ORMModel):
    name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


class LandingSiteRead(LandingSiteBase):
    id: int
