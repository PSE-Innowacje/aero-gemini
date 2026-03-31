from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from aero.core.logging import log_duration
from aero.core.security import create_access_token, hash_password, verify_password
from aero.models.user import User
from aero.schemas.auth import LoginRequest, TokenResponse
from aero.schemas.user import UserCreate


@log_duration(
    event="register",
    started_message="register_started",
    completed_message="register_completed",
    context=lambda args: {"email": str(args["payload"].email), "role": args["payload"].role.value},
)
def register_user(db: Session, payload: UserCreate) -> User:
    email = str(payload.email)
    exists = db.scalar(select(User).where(User.email == str(payload.email)))
    if exists:
        logger.bind(event="register", email=email).warning("register_email_conflict")
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.bind(event="register", user_id=user.id, email=email).info("register_user_created")
    return user


@log_duration(
    event="login",
    started_message="login_started",
    completed_message="login_completed",
    context=lambda args: {"email": str(args["payload"].email)},
)
def login(db: Session, payload: LoginRequest) -> TokenResponse:
    email = str(payload.email)
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(payload.password, user.password_hash):
        logger.bind(event="login", email=email).warning("login_invalid_credentials")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token(subject=str(user.id), role=user.role.value)
    logger.bind(event="login", user_id=user.id, email=email, role=user.role.value).info("login_token_created")
    return TokenResponse(access_token=token, role=user.role)
