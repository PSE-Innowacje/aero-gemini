from typing import Annotated

from pydantic import EmailStr, Field

from aero.models.enums import UserRole
from aero.schemas.common import ORMModel


class UserCreate(ORMModel):
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    email: Annotated[EmailStr, Field(max_length=100)]
    password: str
    role: UserRole


class UserUpdate(ORMModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    role: UserRole | None = None


class UserRead(ORMModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    role: UserRole
