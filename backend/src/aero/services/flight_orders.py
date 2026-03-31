from datetime import date
from itertools import pairwise
from math import isfinite
from typing import Any, cast

from fastapi import HTTPException, status
from geopy.distance import geodesic
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from aero.core.logging import log_duration
from aero.models.crew_member import CrewMember
from aero.models.flight_order import FlightOrder
from aero.models.helicopter import Helicopter
from aero.models.landing_site import LandingSite
from aero.models.planned_operation import PlannedOperation


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
    crew: list[CrewMember],
    estimated_distance: float,
    validation_logger,
) -> int:
    crew_weight = int(sum(member.weight for member in crew))
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
        crew=crew,
        estimated_distance=estimated_distance,
        validation_logger=validation_logger,
    )

    validation_logger.bind(crew_count=len(crew), crew_weight=crew_weight).debug("validation_result")
    return helicopter, pilot, crew, crew_weight


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
