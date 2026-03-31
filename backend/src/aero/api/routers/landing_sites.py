from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.orm import Session

from aero.api.deps import require_roles
from aero.core.database import get_db
from aero.models.enums import UserRole
from aero.models.landing_site import LandingSite
from aero.repositories.base import BaseRepository
from aero.schemas.landing_site import LandingSiteCreate, LandingSiteRead, LandingSiteUpdate

router = APIRouter()


@router.post("", response_model=LandingSiteRead)
def create_landing_site(
    payload: LandingSiteCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> LandingSiteRead:
    repo = BaseRepository(db, LandingSite)
    result = LandingSiteRead.model_validate(repo.create(payload.model_dump()))
    logger.bind(event="landing_site_api", action="create", landing_site_id=result.id).info(
        "landing_site_create_completed"
    )
    return result


@router.get("", response_model=list[LandingSiteRead])
def list_landing_sites(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    sort_by: str = "id",
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR, UserRole.PILOT)),
) -> list[LandingSiteRead]:
    repo = BaseRepository(db, LandingSite)
    items = [
        LandingSiteRead.model_validate(item)
        for item in repo.list(skip=skip, limit=limit, sort_by=sort_by, sort_dir=sort_dir)
    ]
    logger.bind(event="landing_site_api", action="list", result_count=len(items)).debug("landing_site_list_completed")
    return items


@router.patch("/{landing_site_id}", response_model=LandingSiteRead)
def update_landing_site(
    landing_site_id: int,
    payload: LandingSiteUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> LandingSiteRead:
    repo = BaseRepository(db, LandingSite)
    model = repo.get(landing_site_id)
    if not model:
        logger.bind(event="landing_site_api", action="update", landing_site_id=landing_site_id).warning(
            "landing_site_update_not_found"
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Landing site not found")
    result = LandingSiteRead.model_validate(repo.update(model, payload.model_dump(exclude_unset=True)))
    logger.bind(event="landing_site_api", action="update", landing_site_id=result.id).info(
        "landing_site_update_completed"
    )
    return result
