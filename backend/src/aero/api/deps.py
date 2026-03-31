from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from loguru import logger
from sqlalchemy.orm import Session

from aero.core.database import get_db
from aero.core.security import decode_access_token
from aero.models.enums import UserRole
from aero.models.user import User

auth_scheme = HTTPBearer()


def current_user(
    creds: HTTPAuthorizationCredentials = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> User:
    token_fingerprint = creds.credentials[:8]
    logger.bind(event="auth", token_fingerprint=token_fingerprint).debug("decode_token_started")
    try:
        payload = decode_access_token(creds.credentials)
    except Exception as exc:  # noqa: BLE001
        logger.bind(event="auth", token_fingerprint=token_fingerprint).warning("decode_token_failed")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user = db.get(User, int(payload["sub"]))
    if not user:
        logger.bind(
            event="auth",
            token_fingerprint=token_fingerprint,
            user_id=payload.get("sub"),
        ).warning("user_not_found_for_token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    logger.bind(event="auth", user_id=user.id, role=user.role.value).debug("current_user_resolved")
    return user


def require_roles(*roles: UserRole) -> Callable:
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            logger.bind(
                event="rbac",
                user_id=user.id,
                user_role=user.role.value,
                required_roles=[role.value for role in roles],
            ).warning("rbac_check_failed")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden for current role")
        logger.bind(
            event="rbac",
            user_id=user.id,
            user_role=user.role.value,
            required_roles=[role.value for role in roles],
        ).debug("rbac_check_passed")
        return user

    return checker
