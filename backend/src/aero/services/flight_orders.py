from datetime import UTC, date, datetime
from itertools import pairwise
from math import isfinite
from time import monotonic
from typing import Any, cast

from fastapi import HTTPException, status
from geopy.distance import geodesic
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from aero.core.logging import log_duration
from aero.models.crew_member import CrewMember
from aero.models.enums import CrewRole, FlightOrderStatus, ResourceStatus, WorkflowStatus
from aero.models.flight_order import FlightOrder
from aero.models.helicopter import Helicopter
from aero.models.landing_site import LandingSite
from aero.models.planned_operation import PlannedOperation
from aero.models.user import User
from aero.services.flight_order_routing import optimize_flight_order_routing

_PREVIEW_CACHE_TTL_SECONDS = 10.0
_PREVIEW_CACHE_MAX_ITEMS = 256
_PREVIEW_MAX_OPERATIONS = 200
_preview_cache: dict[tuple[str, int, int, int, tuple[int, ...]], tuple[float, dict[str, Any]]] = {}


def _resolve_related_entities(
    db: Session,
    helicopter_id: int,
    pilot_id: int,
    crew_ids: list[int],
    validation_logger,
) -> tuple[Helicopter, CrewMember, list[CrewMember]]:
    helicopter = db.scalar(select(Helicopter).where(Helicopter.id == helicopter_id))
    pilot = db.scalar(select(CrewMember).where(CrewMember.id == pilot_id))
    requested_crew_ids = set(crew_ids)
    crew_by_id = {
        member.id: member
        for member in db.scalars(select(CrewMember).where(CrewMember.id.in_(requested_crew_ids)))
    }
    crew = [crew_by_id[crew_id] for crew_id in crew_ids if crew_id in crew_by_id]

    if helicopter is None or pilot is None or len(crew) != len(crew_ids):
        validation_logger.warning("validation_related_entity_not_found")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Related entity not found"
        )
    if helicopter.status != ResourceStatus.ACTIVE:
        validation_logger.bind(helicopter_status=helicopter.status.value).warning("helicopter_not_active")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Helicopter must be active",
        )
    if pilot.role != CrewRole.PILOT:
        validation_logger.bind(pilot_role=pilot.role.value).warning("crew_member_is_not_pilot")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected pilot is not a PILOT crew member",
        )

    return helicopter, pilot, crew


def _validate_certification_dates(
    helicopter: Helicopter,
    pilot: CrewMember,
    crew: list[CrewMember],
    validation_logger,
) -> None:
    today = date.today()
    if helicopter.inspection_valid_until and helicopter.inspection_valid_until < today:
        validation_logger.bind(
            inspection_valid_until=str(helicopter.inspection_valid_until),
            checked_on=str(today),
        ).warning("helicopter_inspection_expired")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Helicopter inspection expired"
        )

    if pilot.license_valid_until and pilot.license_valid_until < today:
        validation_logger.bind(
            license_valid_until=str(pilot.license_valid_until),
            checked_on=str(today),
        ).warning("pilot_license_expired")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pilot license expired")

    if any(member.training_valid_until and member.training_valid_until < today for member in crew):
        validation_logger.bind(checked_on=str(today)).warning("crew_training_expired")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Crew training expired")


def _validate_weight_and_range(
    helicopter: Helicopter,
    pilot: CrewMember,
    crew: list[CrewMember],
    estimated_distance: float,
    validation_logger,
) -> int:
    unique_member_weights = {member.id: member.weight for member in crew}
    unique_member_weights[pilot.id] = pilot.weight
    crew_weight = int(sum(unique_member_weights.values()))
    if crew_weight > helicopter.max_crew_weight:
        validation_logger.bind(
            crew_weight=crew_weight,
            max_crew_weight=helicopter.max_crew_weight,
        ).warning("crew_weight_exceeded")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Crew weight exceeds helicopter limit"
        )

    if estimated_distance > helicopter.range_km:
        validation_logger.bind(
            estimated_distance=estimated_distance,
            range_km=helicopter.range_km,
        ).warning("estimated_distance_exceeded")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Estimated distance exceeds range"
        )

    return crew_weight


@log_duration(
    event="flight_order_validation",
    started_message="validation_started",
    completed_message="validation_completed",
    context=lambda args: {
        "helicopter_id": args["helicopter_id"],
        "pilot_id": args["pilot_id"],
        "crew_ids": args["crew_ids"],
        "estimated_distance": args["estimated_distance"],
    },
)
def validate_flight_order_constraints(
    db: Session,
    helicopter_id: int,
    pilot_id: int,
    crew_ids: list[int],
    estimated_distance: float,
) -> tuple[Helicopter, CrewMember, list[CrewMember], int]:
    validation_logger = logger.bind(
        event="flight_order_validation",
        helicopter_id=helicopter_id,
        pilot_id=pilot_id,
        crew_ids=crew_ids,
        estimated_distance=estimated_distance,
    )
    helicopter, pilot, crew = _resolve_related_entities(
        db=db,
        helicopter_id=helicopter_id,
        pilot_id=pilot_id,
        crew_ids=crew_ids,
        validation_logger=validation_logger,
    )
    _validate_certification_dates(
        helicopter=helicopter,
        pilot=pilot,
        crew=crew,
        validation_logger=validation_logger,
    )
    crew_weight = _validate_weight_and_range(
        helicopter=helicopter,
        pilot=pilot,
        crew=crew,
        estimated_distance=estimated_distance,
        validation_logger=validation_logger,
    )

    validation_logger.bind(crew_count=len(crew), crew_weight=crew_weight).debug("validation_result")
    return helicopter, pilot, crew, crew_weight


def resolve_pilot_from_logged_user(db: Session, user: User) -> CrewMember:
    pilot = db.scalar(
        select(CrewMember).where(
            CrewMember.email == user.email,
            CrewMember.role == CrewRole.PILOT,
        )
    )
    if pilot is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logged user is not mapped to PILOT crew member",
        )
    return pilot


def validate_flight_order_status_transition(
    *,
    current_status: FlightOrderStatus,
    new_status: FlightOrderStatus,
    actual_start,
    actual_end,
) -> None:
    if new_status in {FlightOrderStatus.PARTIALLY_COMPLETED, FlightOrderStatus.COMPLETED} and (
        actual_start is None or actual_end is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="actual_start and actual_end are required before status 5 or 6",
        )


def _as_utc_timestamp(value: datetime) -> float:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC).timestamp()
    return value.astimezone(UTC).timestamp()


def validate_flight_order_time_order(
    *,
    planned_start: datetime | None,
    planned_end: datetime | None,
    actual_start: datetime | None = None,
    actual_end: datetime | None = None,
) -> None:
    if planned_start is not None and planned_end is not None:
        if _as_utc_timestamp(planned_end) <= _as_utc_timestamp(planned_start):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="planned_end must be later than planned_start",
            )
    if actual_start is not None and actual_end is not None:
        if _as_utc_timestamp(actual_end) <= _as_utc_timestamp(actual_start):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="actual_end must be later than actual_start",
            )


def _lonlat_points_from_route_geometry(route_geometry: dict[str, Any] | None) -> list[tuple[float, float]]:
    if not route_geometry or route_geometry.get("type") != "LineString":
        return []
    coords = route_geometry.get("coordinates") or []
    out: list[tuple[float, float]] = []
    for pair in coords:
        if not isinstance(pair, (list, tuple)) or len(pair) < 2:
            continue
        lon, lat = float(pair[0]), float(pair[1])
        if isfinite(lon) and isfinite(lat):
            out.append((lon, lat))
    return out


def _dedupe_consecutive_lonlat(coords: list[tuple[float, float]]) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for lon, lat in coords:
        if not out or out[-1] != (lon, lat):
            out.append((lon, lat))
    return out


def _polyline_length_km(lonlat: list[tuple[float, float]]) -> float:
    if len(lonlat) < 2:
        return 0.0
    lat_lon = [(lat, lon) for lon, lat in lonlat]
    total = sum(geodesic(start, end).kilometers for start, end in pairwise(lat_lon))
    return round(total, 2)


def build_flight_order_path_lon_lat(
    start_lon: float,
    start_lat: float,
    end_lon: float,
    end_lat: float,
    operations_in_order: list[PlannedOperation],
) -> list[tuple[float, float]]:
    positions: list[tuple[float, float]] = [(start_lon, start_lat)]
    for op in operations_in_order:
        positions.extend(_lonlat_points_from_route_geometry(op.route_geometry))
    positions.append((end_lon, end_lat))
    return _dedupe_consecutive_lonlat(positions)


def estimate_flight_order_distance_km(
    db: Session,
    *,
    start_site_id: int,
    end_site_id: int,
    planned_operation_ids: list[int] | None,
) -> float:
    start = db.scalar(select(LandingSite).where(LandingSite.id == start_site_id))
    end = db.scalar(select(LandingSite).where(LandingSite.id == end_site_id))
    if start is None or end is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Landing site not found")
    operations = cast(list[PlannedOperation], get_planned_operations(db, planned_operation_ids or []))
    path = build_flight_order_path_lon_lat(
        start.longitude,
        start.latitude,
        end.longitude,
        end.latitude,
        operations,
    )
    return _polyline_length_km(path)


def _operation_preview_items(operations: list[PlannedOperation]) -> list[dict[str, Any]]:
    ordered_operations: list[dict[str, Any]] = []
    for operation in operations:
        coordinates = _lonlat_points_from_route_geometry(operation.route_geometry)
        if not coordinates:
            continue
        ordered_operations.append(
            {
                "planned_operation_id": operation.id,
                "direction": "forward",
                "entry_point": {
                    "longitude": coordinates[0][0],
                    "latitude": coordinates[0][1],
                },
                "exit_point": {
                    "longitude": coordinates[-1][0],
                    "latitude": coordinates[-1][1],
                },
                "traversal_distance_km": _polyline_length_km(coordinates),
            }
        )
    return ordered_operations


def _evict_preview_cache(now: float) -> None:
    expired_keys = [cache_key for cache_key, (expires_at, _) in _preview_cache.items() if expires_at <= now]
    for cache_key in expired_keys:
        _preview_cache.pop(cache_key, None)
    if len(_preview_cache) > _PREVIEW_CACHE_MAX_ITEMS:
        for cache_key in list(_preview_cache.keys())[: len(_preview_cache) - _PREVIEW_CACHE_MAX_ITEMS]:
            _preview_cache.pop(cache_key, None)


@log_duration(
    event="flight_order_preview",
    started_message="preview_started",
    completed_message="preview_completed",
    context=lambda args: {
        "start_site_id": args["start_site_id"],
        "end_site_id": args["end_site_id"],
        "helicopter_id": args["helicopter_id"],
        "operations_count": len(args["planned_operation_ids"]),
        "strategy": args["strategy"],
    },
)
def preview_flight_order(
    db: Session,
    *,
    start_site_id: int,
    end_site_id: int,
    helicopter_id: int,
    planned_operation_ids: list[int],
    strategy: str,
) -> dict[str, Any]:
    if len(planned_operation_ids) > _PREVIEW_MAX_OPERATIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Maximum {_PREVIEW_MAX_OPERATIONS} planned operations are allowed in preview",
        )
    if len(set(planned_operation_ids)) != len(planned_operation_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="planned_operation_ids must contain unique values",
        )

    helicopter = db.scalar(select(Helicopter).where(Helicopter.id == helicopter_id))
    if helicopter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Helicopter not found")

    operation_ids_key = tuple(planned_operation_ids)
    cache_key = (strategy, start_site_id, end_site_id, helicopter_id, operation_ids_key)
    now = monotonic()
    _evict_preview_cache(now)
    cache_item = _preview_cache.get(cache_key)
    preview_logger = logger.bind(
        event="flight_order_preview",
        start_site_id=start_site_id,
        end_site_id=end_site_id,
        helicopter_id=helicopter_id,
        strategy=strategy,
        operations_count=len(planned_operation_ids),
    )
    if cache_item and cache_item[0] > now:
        cached_response = dict(cache_item[1])
        cached_response["cache_hit"] = True
        preview_logger.bind(cache_hit=True).debug("preview_cache_hit")
        return cached_response

    started_at = monotonic()
    if strategy == "optimized":
        route_result = optimize_flight_order_routing(
            db,
            start_site_id=start_site_id,
            end_site_id=end_site_id,
            planned_operation_ids=planned_operation_ids,
        )
        ordered_operations = route_result["ordered_operations"]
        total_distance_km = float(route_result["total_distance_km"])
    else:
        operations = cast(list[PlannedOperation], get_planned_operations(db, planned_operation_ids))
        resolved_ids = {operation.id for operation in operations}
        missing_ids = [operation_id for operation_id in planned_operation_ids if operation_id not in resolved_ids]
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Planned operation not found: {missing_ids}",
            )
        ordered_operations = _operation_preview_items(operations)
        total_distance_km = estimate_flight_order_distance_km(
            db,
            start_site_id=start_site_id,
            end_site_id=end_site_id,
            planned_operation_ids=planned_operation_ids,
        )

    total_distance_km = round(total_distance_km, 2)
    range_margin_km = round(float(helicopter.range_km) - total_distance_km, 2)
    within_helicopter_range = range_margin_km >= 0
    response = {
        "ordered_operations": ordered_operations,
        "total_distance_km": total_distance_km,
        "within_helicopter_range": within_helicopter_range,
        "range_margin_km": range_margin_km,
        "blocking_reasons": [] if within_helicopter_range else ["RANGE_EXCEEDED"],
        "cache_hit": False,
    }
    _preview_cache[cache_key] = (monotonic() + _PREVIEW_CACHE_TTL_SECONDS, response)
    preview_logger.bind(
        cache_hit=False,
        total_distance_km=total_distance_km,
        within_helicopter_range=within_helicopter_range,
        preview_duration_ms=round((monotonic() - started_at) * 1000, 2),
    ).info("preview_completed_with_distance")
    return response


@log_duration(
    event="flight_order_planned_operations",
    started_message="resolve_planned_operations_started",
    completed_message="resolve_planned_operations_completed",
    context=lambda args: {"requested_ids": args["planned_operation_ids"]},
    level="debug",
)
def get_planned_operations(db: Session, planned_operation_ids: list[int]) -> list[PlannedOperation]:
    if not planned_operation_ids:
        return []

    operations_logger = logger.bind(
        event="flight_order_planned_operations",
        requested_ids=planned_operation_ids,
    )
    requested_ids = set(planned_operation_ids)
    operation_by_id = {
        operation.id: operation
        for operation in db.scalars(
            select(PlannedOperation).where(PlannedOperation.id.in_(requested_ids))
        )
    }
    resolved = [operation_by_id[operation_id] for operation_id in planned_operation_ids if operation_id in operation_by_id]
    operations_logger.bind(requested_count=len(planned_operation_ids), resolved_count=len(resolved)).debug(
        "resolve_planned_operations_resolved_counts"
    )
    return resolved


def validate_selected_planned_operations(
    db: Session,
    planned_operation_ids: list[int],
) -> list[PlannedOperation]:
    operations = get_planned_operations(db, planned_operation_ids)
    resolved_ids = {operation.id for operation in operations}
    missing_ids = [operation_id for operation_id in planned_operation_ids if operation_id not in resolved_ids]
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Planned operation not found: {missing_ids}",
        )
    invalid_status_ids = [
        operation.id for operation in operations if operation.status != WorkflowStatus.APPROVED
    ]
    if invalid_status_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All selected planned operations must have status 3",
        )
    return operations


def assign_relationships(
    order: FlightOrder,
    pilot: CrewMember,
    helicopter: Helicopter,
    crew: list[CrewMember],
    planned_operations: list[PlannedOperation] | None = None,
) -> None:
    relationships_logger = logger.bind(
        event="flight_order_relationships",
        order_id=order.id,
        pilot_id=pilot.id,
        helicopter_id=helicopter.id,
        crew_count=len(crew),
        planned_operations_count=0 if planned_operations is None else len(planned_operations),
    )
    relationships_logger.debug("assign_relationships_started")
    order.pilot = pilot
    order.helicopter = helicopter
    order.crew_members = crew
    if planned_operations is not None:
        order.planned_operations = planned_operations
    relationships_logger.debug("assign_relationships_completed")
