from datetime import date
from time import perf_counter

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from aero.models.crew_member import CrewMember
from aero.models.flight_order import FlightOrder
from aero.models.helicopter import Helicopter
from aero.models.planned_operation import PlannedOperation


def validate_flight_order_constraints(
    db: Session,
    helicopter_id: int,
    pilot_id: int,
    crew_ids: list[int],
    estimated_distance: float,
) -> tuple[Helicopter, CrewMember, list[CrewMember], int]:
    started = perf_counter()
    logger.bind(
        event="flight_order_validation",
        helicopter_id=helicopter_id,
        pilot_id=pilot_id,
        crew_ids=crew_ids,
        estimated_distance=estimated_distance,
    ).info("validation_started")
    helicopter = db.scalar(select(Helicopter).where(Helicopter.id == helicopter_id))
    pilot = db.scalar(select(CrewMember).where(CrewMember.id == pilot_id))
    requested_crew_ids = set(crew_ids)
    crew_by_id = {
        member.id: member
        for member in db.scalars(select(CrewMember).where(CrewMember.id.in_(requested_crew_ids)))
    }
    crew = [crew_by_id[crew_id] for crew_id in crew_ids if crew_id in crew_by_id]

    if helicopter is None or pilot is None or len(crew) != len(crew_ids):
        logger.warning(
            "Related entity not found for flight order: helicopter_id={}, pilot_id={}, crew_ids={}",
            helicopter_id,
            pilot_id,
            crew_ids,
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Related entity not found"
        )

    today = date.today()
    if helicopter.inspection_valid_until and helicopter.inspection_valid_until < today:
        logger.bind(
            event="flight_order_validation",
            helicopter_id=helicopter_id,
            inspection_valid_until=str(helicopter.inspection_valid_until),
            checked_on=str(today),
        ).warning("helicopter_inspection_expired")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Helicopter inspection expired"
        )
    if pilot.license_valid_until and pilot.license_valid_until < today:
        logger.bind(
            event="flight_order_validation",
            pilot_id=pilot_id,
            license_valid_until=str(pilot.license_valid_until),
            checked_on=str(today),
        ).warning("pilot_license_expired")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pilot license expired")
    if any(member.training_valid_until and member.training_valid_until < today for member in crew):
        logger.bind(
            event="flight_order_validation",
            crew_ids=crew_ids,
            checked_on=str(today),
        ).warning("crew_training_expired")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Crew training expired")

    crew_weight = int(sum(member.weight for member in crew))
    if crew_weight > helicopter.max_crew_weight:
        logger.bind(
            event="flight_order_validation",
            helicopter_id=helicopter_id,
            crew_weight=crew_weight,
            max_crew_weight=helicopter.max_crew_weight,
        ).warning("crew_weight_exceeded")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Crew weight exceeds helicopter limit"
        )
    if estimated_distance > helicopter.range_km:
        logger.bind(
            event="flight_order_validation",
            helicopter_id=helicopter_id,
            estimated_distance=estimated_distance,
            range_km=helicopter.range_km,
        ).warning("estimated_distance_exceeded")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Estimated distance exceeds range"
        )

    logger.bind(
        event="flight_order_validation",
        helicopter_id=helicopter_id,
        pilot_id=pilot_id,
        crew_count=len(crew),
        crew_weight=crew_weight,
        duration_ms=round((perf_counter() - started) * 1000, 2),
    ).info("validation_completed")
    return helicopter, pilot, crew, crew_weight


def get_planned_operations(db: Session, planned_operation_ids: list[int]) -> list[PlannedOperation]:
    if not planned_operation_ids:
        return []

    started = perf_counter()
    logger.bind(
        event="flight_order_planned_operations",
        requested_ids=planned_operation_ids,
    ).debug("resolve_planned_operations_started")
    requested_ids = set(planned_operation_ids)
    operation_by_id = {
        operation.id: operation
        for operation in db.scalars(
            select(PlannedOperation).where(PlannedOperation.id.in_(requested_ids))
        )
    }
    resolved = [operation_by_id[operation_id] for operation_id in planned_operation_ids if operation_id in operation_by_id]
    logger.bind(
        event="flight_order_planned_operations",
        requested_count=len(planned_operation_ids),
        resolved_count=len(resolved),
        duration_ms=round((perf_counter() - started) * 1000, 2),
    ).debug("resolve_planned_operations_completed")
    return resolved


def assign_relationships(
    order: FlightOrder,
    pilot: CrewMember,
    helicopter: Helicopter,
    crew: list[CrewMember],
    planned_operations: list[PlannedOperation] | None = None,
) -> None:
    logger.bind(
        event="flight_order_relationships",
        order_id=order.id,
        pilot_id=pilot.id,
        helicopter_id=helicopter.id,
        crew_count=len(crew),
        planned_operations_count=0 if planned_operations is None else len(planned_operations),
    ).debug("assign_relationships_started")
    order.pilot = pilot
    order.helicopter = helicopter
    order.crew_members = crew
    if planned_operations is not None:
        order.planned_operations = planned_operations
    logger.bind(
        event="flight_order_relationships",
        order_id=order.id,
        pilot_id=pilot.id,
        helicopter_id=helicopter.id,
        crew_count=len(crew),
        planned_operations_count=0 if planned_operations is None else len(planned_operations),
    ).debug("assign_relationships_completed")
