from datetime import date
import math
import xml.etree.ElementTree as ET

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from aero.models.audit import PlannedOperationAudit
from aero.models.enums import UserRole, WorkflowStatus
from aero.models.planned_operation import PlannedOperation
from aero.models.user import User


ALLOWED_TRANSITIONS: dict[WorkflowStatus, set[WorkflowStatus]] = {
    WorkflowStatus.DRAFT: {WorkflowStatus.SUBMITTED, WorkflowStatus.APPROVED},
    WorkflowStatus.APPROVED: {WorkflowStatus.SCHEDULED},
    WorkflowStatus.SCHEDULED: {WorkflowStatus.IN_PROGRESS, WorkflowStatus.DONE, WorkflowStatus.APPROVED},
}


def _distance_km(coords: list[tuple[float, float]]) -> float:
    total = 0.0
    for i in range(1, len(coords)):
        x1, y1 = coords[i - 1]
        x2, y2 = coords[i]
        total += math.dist((x1, y1), (x2, y2)) * 111.0
    return round(total, 2)


def parse_kml_distance(path: str | None) -> float:
    if not path:
        return 0.0
    try:
        root = ET.parse(path).getroot()
    except Exception:  # noqa: BLE001
        return 0.0
    coords: list[tuple[float, float]] = []
    for elem in root.iter():
        if elem.tag.endswith("coordinates") and elem.text:
            for segment in elem.text.strip().split():
                lon, lat, *_ = segment.split(",")
                coords.append((float(lat), float(lon)))
    return _distance_km(coords)


def enforce_status_transition(current: WorkflowStatus, new: WorkflowStatus, user: User) -> None:
    if current == new:
        return
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if new not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status transition")
    if current == WorkflowStatus.DRAFT and new in {WorkflowStatus.SUBMITTED, WorkflowStatus.APPROVED}:
        if user.role not in {UserRole.SUPERVISOR, UserRole.ADMIN}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor role required")


def add_audit(
    db: Session,
    planned_operation_id: int,
    action: str,
    actor_user_id: int,
    before: dict | None,
    after: dict | None,
) -> None:
    db.add(
        PlannedOperationAudit(
            planned_operation_id=planned_operation_id,
            action=action,
            actor_user_id=actor_user_id,
            before_snapshot=before,
            after_snapshot=after,
        )
    )


def validate_edit_window(operation: PlannedOperation, user: User) -> None:
    if operation.status in {WorkflowStatus.DONE, WorkflowStatus.REJECTED} and user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only ADMIN can edit finalized operation")


def today() -> date:
    return date.today()
