from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy.orm import Session

from aero.api.deps import require_roles
from aero.core.database import get_db
from aero.models.crew_member import CrewMember
from aero.models.enums import UserRole
from aero.repositories.base import BaseRepository
from aero.schemas.crew_member import CrewMemberCreate, CrewMemberRead, CrewMemberUpdate

router = APIRouter()


@router.post("", response_model=CrewMemberRead)
def create_crew_member(
    payload: CrewMemberCreate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> CrewMemberRead:
    repo = BaseRepository(db, CrewMember)
    result = CrewMemberRead.model_validate(repo.create(payload.model_dump()))
    logger.bind(event="crew_member_api", action="create", crew_member_id=result.id).info("crew_member_create_completed")
    return result


@router.get("", response_model=list[CrewMemberRead])
def list_crew_members(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    sort_by: str = "id",
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR, UserRole.PILOT)),
) -> list[CrewMemberRead]:
    repo = BaseRepository(db, CrewMember)
    items = [
        CrewMemberRead.model_validate(item)
        for item in repo.list(skip=skip, limit=limit, sort_by=sort_by, sort_dir=sort_dir)
    ]
    logger.bind(event="crew_member_api", action="list", result_count=len(items)).debug("crew_member_list_completed")
    return items


@router.patch("/{crew_member_id}", response_model=CrewMemberRead)
def update_crew_member(
    crew_member_id: int,
    payload: CrewMemberUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> CrewMemberRead:
    repo = BaseRepository(db, CrewMember)
    model = repo.get(crew_member_id)
    if not model:
        logger.bind(event="crew_member_api", action="update", crew_member_id=crew_member_id).warning(
            "crew_member_update_not_found"
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crew member not found")
    result = CrewMemberRead.model_validate(repo.update(model, payload.model_dump(exclude_unset=True)))
    logger.bind(event="crew_member_api", action="update", crew_member_id=result.id).info("crew_member_update_completed")
    return result
