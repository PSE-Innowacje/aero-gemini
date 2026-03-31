from datetime import date

from pydantic import Field, model_validator

from aero.models.enums import ResourceStatus
from aero.schemas.common import ORMModel


class HelicopterBase(ORMModel):
    registration_number: str = Field(max_length=30)
    type: str
    description: str | None = Field(default=None, max_length=100)
    max_crew: int = Field(ge=1, le=10)
    max_crew_weight: int = Field(ge=1, le=1000)
    status: ResourceStatus = ResourceStatus.ACTIVE
    inspection_valid_until: date | None = None
    range_km: int = Field(ge=1)

    @model_validator(mode="after")
    def validate_inspection_for_active(self) -> "HelicopterBase":
        if self.status == ResourceStatus.ACTIVE and self.inspection_valid_until is None:
            raise ValueError("inspection_valid_until is required when helicopter is active")
        return self


class HelicopterCreate(HelicopterBase):
    pass


class HelicopterUpdate(ORMModel):
    registration_number: str | None = Field(default=None, max_length=30)
    type: str | None = None
    description: str | None = Field(default=None, max_length=100)
    max_crew: int | None = Field(default=None, ge=1, le=10)
    max_crew_weight: int | None = Field(default=None, ge=1, le=1000)
    status: ResourceStatus | None = None
    inspection_valid_until: date | None = None
    range_km: int | None = Field(default=None, ge=1)


class HelicopterRead(HelicopterBase):
    id: int
