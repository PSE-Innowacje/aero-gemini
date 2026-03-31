from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.orm import Session

from aero.api.deps import require_roles
from aero.core.database import get_db
from aero.models.enums import UserRole
from aero.models.user import User
from aero.repositories.base import BaseRepository
from aero.schemas.user import UserRead, UserUpdate

router = APIRouter()


@router.get("", response_model=list[UserRead])
def list_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    sort_by: str = "id",
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.SUPERVISOR)),
) -> list[UserRead]:
    repo = BaseRepository(db, User)
    items = [UserRead.model_validate(item) for item in repo.list(skip=skip, limit=limit, sort_by=sort_by, sort_dir=sort_dir)]
    logger.bind(event="user_api", action="list", result_count=len(items)).debug("user_list_completed")
    return items


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN)),
) -> UserRead:
    repo = BaseRepository(db, User)
    user = repo.get(user_id)
    if not user:
        logger.bind(event="user_api", action="update", user_id=user_id).warning("user_update_not_found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    updated = repo.update(user, payload.model_dump(exclude_unset=True))
    logger.bind(event="user_api", action="update", user_id=updated.id).info("user_update_completed")
    return UserRead.model_validate(updated)
