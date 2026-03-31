from collections.abc import Iterable
from datetime import date
from itertools import pairwise
from pathlib import Path

from fastkml import kml
from fastapi import HTTPException, status
from loguru import logger  # pyright: ignore[reportMissingImports]
from sqlalchemy.orm import Session

from aero.core.logging import log_duration
from aero.models.audit import PlannedOperationAudit
from aero.models.enums import UserRole, WorkflowStatus
from aero.models.planned_operation import PlannedOperation
from aero.models.user import User
from geopy.distance import geodesic

ALLOWED_TRANSITIONS: dict[WorkflowStatus, set[WorkflowStatus]] = {
    WorkflowStatus.DRAFT: {WorkflowStatus.SUBMITTED, WorkflowStatus.APPROVED},
    WorkflowStatus.APPROVED: {WorkflowStatus.SCHEDULED},
    WorkflowStatus.SCHEDULED: {WorkflowStatus.IN_PROGRESS, WorkflowStatus.DONE, WorkflowStatus.APPROVED},
}


def _distance_km(coords: list[tuple[float, float]]) -> float:
    total = sum(geodesic(start, end).kilometers for start, end in pairwise(coords))
    return round(total, 2)


def _iter_features(node: object) -> Iterable[object]:
    features = getattr(node, "features", None)
    if features is None:
        return

    iterable = features() if callable(features) else features
    for feature in iterable:
        yield feature
        yield from _iter_features(feature)


def _iter_geometry_coords(geometry: object) -> Iterable[tuple[float, float]]:
    if geometry is None:
        return

    geoms = getattr(geometry, "geoms", None)
    if geoms is not None:
        for sub_geometry in geoms:
            yield from _iter_geometry_coords(sub_geometry)
        return

    coords = getattr(geometry, "coords", None)
    if coords is None:
        return

    for lon, lat, *_ in coords:
        yield float(lat), float(lon)


@log_duration(
    event="kml_parse",
    started_message="kml_parse_started",
    completed_message="kml_parse_completed",
    context=lambda args: {"kml_file_path": args["path"]},
)
def parse_kml_distance(path: str | None) -> float:
    if not path:
        return 0.0
    try:
        document = kml.KML.from_string(Path(path).read_bytes())
    except Exception:  # noqa: BLE001
        logger.exception("Failed to parse KML file: {}", path)
        return 0.0

    coords: list[tuple[float, float]] = []
    for feature in _iter_features(document):
        geometry = getattr(feature, "geometry", None)
        if callable(geometry):
            geometry = geometry()
        coords.extend(_iter_geometry_coords(geometry))

    distance_km = _distance_km(coords)
    logger.bind(
        event="kml_parse",
        kml_file_path=path,
        coordinates_count=len(coords),
        distance_km=distance_km,
    ).debug("kml_parse_result")
    return distance_km


@log_duration(
    event="workflow_transition",
    started_message="transition_check_started",
    completed_message="transition_check_completed",
    context=lambda args: {
        "current_status": args["current"].value,
        "requested_status": args["new"].value,
        "user_id": args["user"].id,
        "user_role": args["user"].role.value,
    },
)
def enforce_status_transition(current: WorkflowStatus, new: WorkflowStatus, user: User) -> None:
    transition_logger = logger.bind(
        event="workflow_transition",
        current_status=current.value,
        requested_status=new.value,
        user_id=user.id,
        user_role=user.role.value,
    )
    if current == new:
        transition_logger.debug("transition_noop")
        return

    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if new not in allowed:
        transition_logger.warning("transition_check_failed_invalid_transition")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status transition")

    if current == WorkflowStatus.DRAFT and new in {WorkflowStatus.SUBMITTED, WorkflowStatus.APPROVED}:
        if user.role not in {UserRole.SUPERVISOR, UserRole.ADMIN}:
            transition_logger.warning("transition_check_failed_forbidden_role")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor role required")


def add_audit(
    db: Session,
    planned_operation_id: int,
    action: str,
    actor_user_id: int,
    before: dict | None,
    after: dict | None,
) -> None:
    audit_logger = logger.bind(
        event="audit",
        planned_operation_id=planned_operation_id,
        action=action,
        actor_user_id=actor_user_id,
    )
    audit_logger.debug("audit_insert_started")
    db.add(
        PlannedOperationAudit(
            planned_operation_id=planned_operation_id,
            action=action,
            actor_user_id=actor_user_id,
            before_snapshot=before,
            after_snapshot=after,
        )
    )
    audit_logger.debug("audit_insert_completed")


def validate_edit_window(operation: PlannedOperation, user: User) -> None:
    edit_window_logger = logger.bind(
        event="edit_window",
        operation_id=operation.id,
        operation_status=operation.status.value,
        user_id=user.id,
        user_role=user.role.value,
    )
    if operation.status in {WorkflowStatus.DONE, WorkflowStatus.REJECTED} and user.role != UserRole.ADMIN:
        edit_window_logger.warning("edit_window_rejected")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only ADMIN can edit finalized operation")


def today() -> date:
    return date.today()
