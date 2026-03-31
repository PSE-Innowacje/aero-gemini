from collections.abc import Iterable
from datetime import date
from itertools import pairwise
from typing import TypeAlias

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


LonLat: TypeAlias = tuple[float, float]
LatLon: TypeAlias = tuple[float, float]


def _to_geopy_points(coords: list[LonLat]) -> list[LatLon]:
    # Canonical storage/API order is (lon, lat), geopy requires (lat, lon).
    return [(lat, lon) for lon, lat in coords]


def _distance_km(coords: list[LonLat]) -> float:
    geopy_points = _to_geopy_points(coords)
    total = sum(geodesic(start, end).kilometers for start, end in pairwise(geopy_points))
    return round(total, 2)


def _iter_features(node: object) -> Iterable[object]:
    features = getattr(node, "features", None)
    if features is None:
        return

    iterable = features() if callable(features) else features
    for feature in iterable:
        yield feature
        yield from _iter_features(feature)


def _iter_geometry_coords(geometry: object) -> Iterable[LonLat]:
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
        yield float(lon), float(lat)


@log_duration(
    event="route_validation",
    started_message="route_validation_started",
    completed_message="route_validation_completed",
)
def _validate_route_coordinates(coords: list[LonLat]) -> None:
    if len(coords) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Route must contain at least 2 points")

    for lon, lat in coords:
        if not (-180.0 <= lon <= 180.0 and -90.0 <= lat <= 90.0):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Route contains invalid coordinates",
            )


def _bbox(coords: list[LonLat]) -> list[float]:
    lons = [lon for lon, _lat in coords]
    lats = [lat for _lon, lat in coords]
    return [min(lons), min(lats), max(lons), max(lats)]


@log_duration(
    event="kml_parse",
    started_message="kml_parse_started",
    completed_message="kml_parse_completed",
)
def parse_kml_coordinates(kml_content: str) -> list[LonLat]:
    try:
        document = kml.KML.from_string(kml_content.encode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        logger.bind(event="kml_parse").exception("kml_parse_failed")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid KML content") from exc

    coords: list[LonLat] = []
    for feature in _iter_features(document):
        geometry = getattr(feature, "geometry", None)
        if callable(geometry):
            geometry = geometry()
        coords.extend(_iter_geometry_coords(geometry))

    if not coords:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="KML contains no route coordinates")
    return coords


def route_start_end(route_geometry: dict | None) -> tuple[dict[str, float] | None, dict[str, float] | None]:
    if not route_geometry:
        return None, None

    coordinates = route_geometry.get("coordinates")
    if not coordinates:
        return None, None

    start_lon, start_lat = coordinates[0]
    end_lon, end_lat = coordinates[-1]
    return (
        {"longitude": float(start_lon), "latitude": float(start_lat)},
        {"longitude": float(end_lon), "latitude": float(end_lat)},
    )


@log_duration(
    event="route_normalization",
    started_message="route_normalization_started",
    completed_message="route_normalization_completed",
)
def normalize_route(
    route_geometry: dict | None,
    kml_content: str | None,
) -> dict[str, object]:
    if route_geometry and kml_content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide only one route source: route_geometry or kml_content",
        )
    if not route_geometry and not kml_content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either route_geometry or kml_content",
        )

    coords: list[LonLat]
    if route_geometry:
        geometry_type = route_geometry.get("type")
        if geometry_type != "LineString":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Only LineString route geometry is supported",
            )
        raw_coordinates = route_geometry.get("coordinates")
        if not isinstance(raw_coordinates, list):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid route geometry format",
            )
        try:
            coords = [(float(lon), float(lat)) for lon, lat in raw_coordinates]
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid route geometry coordinates",
            ) from exc
    else:
        assert kml_content is not None
        coords = parse_kml_coordinates(kml_content)

    _validate_route_coordinates(coords)

    normalized_geometry = {
        "type": "LineString",
        "coordinates": [[lon, lat] for lon, lat in coords],
    }
    return {
        "route_geometry": normalized_geometry,
        "distance_km": _distance_km(coords),
        "route_bbox": _bbox(coords),
        "points_count": len(coords),
    }


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
