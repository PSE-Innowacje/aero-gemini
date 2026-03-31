from pydantic import EmailStr

from aero.models.enums import UserRole
from aero.schemas.common import ORMModel


class UserCreate(ORMModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: UserRole


class UserUpdate(ORMModel):
    first_name: str | None = None
    last_name: str | None = None
    role: UserRole | None = None


class UserRead(ORMModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    role: UserRole
