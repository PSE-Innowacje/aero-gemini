from datetime import date

from pydantic import EmailStr, Field, model_validator

from aero.models.enums import CrewRole
from aero.schemas.common import ORMModel


class CrewMemberBase(ORMModel):
    first_name: str
    last_name: str
    email: EmailStr
    weight: int = Field(ge=30, le=200)
    role: CrewRole
    pilot_license_number: str | None = None
    license_valid_until: date | None = None
    training_valid_until: date

    @model_validator(mode="after")
    def validate_pilot_fields(self) -> "CrewMemberBase":
        if self.role == CrewRole.PILOT and (not self.pilot_license_number or not self.license_valid_until):
            raise ValueError("pilot license number and validity are required for PILOT role")
        return self


class CrewMemberCreate(CrewMemberBase):
    pass


class CrewMemberUpdate(ORMModel):
    first_name: str | None = None
    last_name: str | None = None
    weight: int | None = Field(default=None, ge=30, le=200)
    role: CrewRole | None = None
    pilot_license_number: str | None = None
    license_valid_until: date | None = None
    training_valid_until: date | None = None


class CrewMemberRead(CrewMemberBase):
    id: int
