from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from aero.core.database import get_db
from aero.schemas.auth import LoginRequest, TokenResponse
from aero.schemas.user import UserCreate, UserRead
from aero.services.auth import login, register_user

router = APIRouter()


@router.post("/auth/register", response_model=UserRead)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    return UserRead.model_validate(register_user(db, payload))


@router.post("/auth/login", response_model=TokenResponse)
def authenticate(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return login(db, payload)
