from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from aero.api.deps import current_user, require_roles
from aero.core.database import get_db
from aero.models.enums import UserRole, WorkflowStatus
from aero.models.planned_operation import PlannedOperation
from aero.models.user import User
from aero.repositories.base import BaseRepository
from aero.schemas.planned_operation import (
    PlannedOperationCreate,
    PlannedOperationRead,
    PlannedOperationStatusUpdate,
    PlannedOperationUpdate,
)
from aero.services.planned_operations import (
    add_audit,
    enforce_status_transition,
    parse_kml_distance,
    validate_edit_window,
)

router = APIRouter()


@router.post("", response_model=PlannedOperationRead)
def create_planned_operation(
    payload: PlannedOperationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> PlannedOperationRead:
    repo = BaseRepository(db, PlannedOperation)
    data = payload.model_dump()
    data["created_by"] = user.id
    data["distance_km"] = parse_kml_distance(payload.kml_file_path)
    operation = repo.create(data)
    add_audit(db, operation.id, "create", user.id, None, {"status": operation.status.value})
    db.commit()
    return PlannedOperationRead.model_validate(operation)


@router.get("", response_model=list[PlannedOperationRead])
def list_planned_operations(
    status_filter: int | None = Query(default=None, ge=1, le=7),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR, UserRole.PILOT)),
) -> list[PlannedOperationRead]:
    stmt = select(PlannedOperation).offset(skip).limit(limit)
    if status_filter is not None:
        stmt = stmt.where(PlannedOperation.status == WorkflowStatus(status_filter))
    items = list(db.scalars(stmt))
    return [PlannedOperationRead.model_validate(item) for item in items]


@router.patch("/{operation_id}", response_model=PlannedOperationRead)
def update_planned_operation(
    operation_id: int,
    payload: PlannedOperationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> PlannedOperationRead:
    repo = BaseRepository(db, PlannedOperation)
    op = repo.get(operation_id)
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planned operation not found")
    validate_edit_window(op, user)
    before = {"status": op.status.value, "description": op.short_description}
    op = repo.update(op, payload.model_dump(exclude_unset=True))
    add_audit(db, op.id, "update", user.id, before, {"status": op.status.value, "description": op.short_description})
    db.commit()
    return PlannedOperationRead.model_validate(op)


@router.post("/{operation_id}/status", response_model=PlannedOperationRead)
def change_operation_status(
    operation_id: int,
    payload: PlannedOperationStatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> PlannedOperationRead:
    repo = BaseRepository(db, PlannedOperation)
    op = repo.get(operation_id)
    if not op:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planned operation not found")
    enforce_status_transition(op.status, payload.status, user)
    before = {"status": op.status.value}
    op = repo.update(op, {"status": payload.status})
    add_audit(db, op.id, "status_change", user.id, before, {"status": op.status.value})
    db.commit()
    return PlannedOperationRead.model_validate(op)
