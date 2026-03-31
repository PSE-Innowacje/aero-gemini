from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import secrets

import jwt
from loguru import logger

from aero.core.config import settings


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return f"{salt}:{digest}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, expected = password_hash.split(":", maxsplit=1)
    except ValueError:
        logger.bind(event="security", operation="verify_password").warning("password_hash_malformed")
        return False
    digest = hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()
    return hmac.compare_digest(digest, expected)


def create_access_token(subject: str, role: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    logger.bind(
        event="security",
        operation="create_access_token",
        subject=subject,
        role=role,
        expires_in_minutes=settings.access_token_expire_minutes,
    ).debug("access_token_created")
    return token


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except Exception:  # noqa: BLE001
        logger.bind(event="security", operation="decode_access_token").warning("access_token_decode_failed")
        raise
    logger.bind(
        event="security",
        operation="decode_access_token",
        subject=payload.get("sub"),
        role=payload.get("role"),
    ).debug("access_token_decoded")
    return payload
