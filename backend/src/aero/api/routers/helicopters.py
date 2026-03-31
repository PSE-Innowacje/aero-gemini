from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from aero.api.deps import require_roles
from aero.core.database import get_db
from aero.models.enums import UserRole
from aero.models.helicopter import Helicopter
from aero.repositories.base import BaseRepository
from aero.schemas.helicopter import HelicopterCreate, HelicopterRead, HelicopterUpdate

router = APIRouter()


@router.post("", response_model=HelicopterRead)
def create_helicopter(
    payload: HelicopterCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER)),
) -> HelicopterRead:
    repo = BaseRepository(db, Helicopter)
    return HelicopterRead.model_validate(repo.create(payload.model_dump()))


@router.get("", response_model=list[HelicopterRead])
def list_helicopters(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    sort_by: str = "id",
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR, UserRole.PILOT)),
) -> list[HelicopterRead]:
    repo = BaseRepository(db, Helicopter)
    return [HelicopterRead.model_validate(item) for item in repo.list(skip=skip, limit=limit, sort_by=sort_by, sort_dir=sort_dir)]


@router.patch("/{helicopter_id}", response_model=HelicopterRead)
def update_helicopter(
    helicopter_id: int,
    payload: HelicopterUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER)),
) -> HelicopterRead:
    repo = BaseRepository(db, Helicopter)
    model = repo.get(helicopter_id)
    if not model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Helicopter not found")
    return HelicopterRead.model_validate(repo.update(model, payload.model_dump(exclude_unset=True)))
