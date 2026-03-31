import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import ValidationError
from loguru import logger
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
    normalize_route,
    validate_edit_window,
)

router = APIRouter()


def _create_operation_from_payload(payload: PlannedOperationCreate, db: Session, user: User) -> PlannedOperationRead:
    repo = BaseRepository(db, PlannedOperation)
    data = payload.model_dump(exclude={"route_geometry", "kml_content"}, exclude_none=True)
    route_data = normalize_route(
        payload.route_geometry.model_dump(mode="json") if payload.route_geometry else None,
        payload.kml_content,
    )
    data.update(route_data)
    data["created_by"] = user.id
    operation = repo.create(data)
    add_audit(db, operation.id, "create", user.id, None, {"status": operation.status.value})
    db.commit()
    logger.bind(
        event="planned_operation_api",
        action="create",
        operation_id=operation.id,
        user_id=user.id,
    ).info("planned_operation_create_completed")
    return PlannedOperationRead.model_validate(operation)


@router.post("", response_model=PlannedOperationRead)
def create_planned_operation(
    payload: PlannedOperationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> PlannedOperationRead:
    logger.bind(event="planned_operation_api", action="create", user_id=user.id).info("planned_operation_create_started")
    return _create_operation_from_payload(payload, db, user)


@router.post("/upload-kml", response_model=PlannedOperationRead)
async def create_planned_operation_from_kml_upload(
    payload_json: str = Form(...),
    kml_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ADMIN, UserRole.PLANNER, UserRole.SUPERVISOR)),
) -> PlannedOperationRead:
    logger.bind(event="planned_operation_api", action="upload_kml_create", user_id=user.id).info(
        "planned_operation_upload_kml_create_started"
    )
    try:
        raw_payload = json.loads(payload_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="payload_json must be a valid JSON object",
        ) from exc

    if not isinstance(raw_payload, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="payload_json must be a valid JSON object",
        )

    kml_content = (await kml_file.read()).decode("utf-8", errors="ignore")
    try:
        payload = PlannedOperationCreate.model_validate(
            {
                **raw_payload,
                "kml_content": kml_content,
                "route_geometry": None,
            }
        )
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc

    return _create_operation_from_payload(payload, db, user)


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
    logger.bind(
        event="planned_operation_api",
        action="list",
        status_filter=status_filter,
        skip=skip,
        limit=limit,
        result_count=len(items),
    ).debug("planned_operation_list_completed")
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
        logger.bind(event="planned_operation_api", action="update", operation_id=operation_id, user_id=user.id).warning(
            "planned_operation_update_not_found"
        )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planned operation not found")
    validate_edit_window(op, user)
    before = {"status": op.status.value, "description": op.short_description}
    update_data = payload.model_dump(
        exclude_unset=True,
        exclude={"route_geometry", "kml_content"},
    )
    if payload.route_geometry is not None or payload.kml_content is not None:
        route_data = normalize_route(
            payload.route_geometry.model_dump(mode="json") if payload.route_geometry else None,
            payload.kml_content,
        )
        update_data.update(route_data)
    op = repo.update(op, update_data)
    add_audit(db, op.id, "update", user.id, before, {"status": op.status.value, "description": op.short_description})
    db.commit()
    logger.bind(event="planned_operation_api", action="update", operation_id=op.id, user_id=user.id).info(
        "planned_operation_update_completed"
    )
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
        logger.bind(
            event="planned_operation_api",
            action="status_change",
            operation_id=operation_id,
            requested_status=payload.status.value,
            user_id=user.id,
        ).warning("planned_operation_status_change_not_found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planned operation not found")
    enforce_status_transition(op.status, payload.status, user)
    before = {"status": op.status.value}
    op = repo.update(op, {"status": payload.status})
    add_audit(db, op.id, "status_change", user.id, before, {"status": op.status.value})
    db.commit()
    logger.bind(
        event="planned_operation_api",
        action="status_change",
        operation_id=op.id,
        requested_status=payload.status.value,
        user_id=user.id,
    ).info("planned_operation_status_change_completed")
    return PlannedOperationRead.model_validate(op)
