from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from aero.core.security import create_access_token, hash_password, verify_password
from aero.models.user import User
from aero.schemas.auth import LoginRequest, TokenResponse
from aero.schemas.user import UserCreate


def register_user(db: Session, payload: UserCreate) -> User:
    exists = db.scalar(select(User).where(User.email == str(payload.email)))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=str(payload.email),
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(db: Session, payload: LoginRequest) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == str(payload.email)))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role)
